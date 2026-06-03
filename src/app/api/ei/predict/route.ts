import { NextResponse } from "next/server";
import { getSession, studioMedia } from "@/lib/ei-server";
import fs from "fs";
import path from "path";
import https from "https";
import sharp from "sharp";

export const runtime = "nodejs";

// Global cache for inference sessions and image embeddings
let encoderSession: any = null;
let decoderSession: any = null;
const embeddingCache = new Map<string, { embedding: any; width: number; height: number }>();

const MODELS_DIR = "/Users/jenny/.gemini/antigravity/models";
const ENCODER_URL = "https://huggingface.co/Acly/MobileSAM/resolve/main/mobile_sam_image_encoder.onnx";
const DECODER_URL = "https://huggingface.co/Acly/MobileSAM/resolve/main/sam_mask_decoder_single.onnx";

async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    function get(currentUrl: string) {
      https.get(currentUrl, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          get(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download: ${res.statusCode}`));
          return;
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      }).on("error", (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    }
    get(url);
  });
}

async function getSessions() {
  const ort = require("onnxruntime-node");
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  }
  const encoderPath = path.join(MODELS_DIR, "mobile_sam_image_encoder.onnx");
  const decoderPath = path.join(MODELS_DIR, "sam_mask_decoder_single.onnx");

  if (!fs.existsSync(encoderPath)) {
    console.log("Downloading MobileSAM image encoder to App Data...");
    await downloadFile(ENCODER_URL, encoderPath);
  }
  if (!fs.existsSync(decoderPath)) {
    console.log("Downloading MobileSAM mask decoder to App Data...");
    await downloadFile(DECODER_URL, decoderPath);
  }

  if (!encoderSession) {
    encoderSession = await ort.InferenceSession.create(encoderPath);
  }
  if (!decoderSession) {
    decoderSession = await ort.InferenceSession.create(decoderPath);
  }
  return { ort, encoderSession, decoderSession };
}

function traceContour(mask: boolean[][], width: number, height: number): [number, number][] {
  let startX = -1;
  let startY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y][x]) {
        startX = x;
        startY = y;
        break;
      }
    }
    if (startX !== -1) break;
  }

  if (startX === -1) return [];

  const points: [number, number][] = [];
  let currX = startX;
  let currY = startY;

  const dx = [-1, 0, 1, 1, 1, 0, -1, -1];
  const dy = [-1, -1, -1, 0, 1, 1, 1, 0];

  let prevDirection = 7;
  let foundNext = true;
  const maxIterations = width * height;
  let iterations = 0;

  do {
    points.push([currX, currY]);
    foundNext = false;

    const searchStart = (prevDirection + 2) % 8;
    for (let i = 0; i < 8; i++) {
      const dir = (searchStart + 8 - i) % 8;
      const nextX = currX + dx[dir];
      const nextY = currY + dy[dir];

      if (nextX >= 0 && nextX < width && nextY >= 0 && nextY < height) {
        if (mask[nextY][nextX]) {
          currX = nextX;
          currY = nextY;
          prevDirection = dir;
          foundNext = true;
          break;
        }
      }
    }

    iterations++;
    if (!foundNext || iterations >= maxIterations) break;

  } while (!(currX === startX && currY === startY));

  return points;
}

function simplifyPolygon(points: [number, number][], maxPoints = 80): [number, number][] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const result: [number, number][] = [];
  for (let i = 0; i < points.length; i += step) {
    result.push(points[i]);
  }
  if (result.length > 0 && (result[0][0] !== points[points.length - 1][0] || result[0][1] !== points[points.length - 1][1])) {
    result.push(points[points.length - 1]);
  }
  return result;
}

export async function POST(req: Request) {
  try {
    fs.appendFileSync("server_api.log", `${new Date().toISOString()} [POST] /api/ei/predict called\n`);
  } catch (e) {
    console.error("Failed to write to server_api.log:", e);
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not connected" }, { status: 401 });
  }

  try {
    const body = await req.json();

    const imageUrl = body.task?.data?.image || "";
    const match = imageUrl.match(/\/api\/ei\/media\/(\d+)\/(\d+)/);
    if (!match) {
      return NextResponse.json({ error: "Invalid task image URL" }, { status: 400 });
    }

    const projectId = Number(match[1]);
    const sampleId = Number(match[2]);

    const annotations = body.annotations || [];
    const results = annotations[0]?.result || [];

    const prompts = results.filter((r: any) => 
      r.type === "keypointlabels" || r.type === "rectanglelabels"
    );

    if (prompts.length === 0) {
      return NextResponse.json({ result: [] });
    }

    const { ort, encoderSession, decoderSession } = await getSessions();

    const cacheKey = `${projectId}:${sampleId}`;
    let cached = embeddingCache.get(cacheKey);

    if (!cached) {
      const response = await studioMedia(session, `/${projectId}/raw-data/${sampleId}/image`);
      if (!response.ok) {
        throw new Error(`Failed to load image from Edge Impulse: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuffer);

      const image = sharp(imageBuffer);
      const metadata = await image.metadata();
      const W = metadata.width || 1024;
      const H = metadata.height || 1024;

      const scale = 1024 / Math.max(W, H);
      const scaledW = Math.round(W * scale);
      const scaledH = Math.round(H * scale);

      const resizedBuffer = await image
        .resize(scaledW, scaledH)
        .raw()
        .toBuffer();

      const paddedData = new Float32Array(1 * 3 * 1024 * 1024);
      const mean = [123.675, 116.28, 103.53];
      const std = [58.395, 57.12, 57.375];

      for (let y = 0; y < 1024; y++) {
        for (let x = 0; x < 1024; x++) {
          const idx = y * 1024 + x;
          if (x < scaledW && y < scaledH) {
            const pixelIdx = (y * scaledW + x) * 3;
            const r = resizedBuffer[pixelIdx + 0];
            const g = resizedBuffer[pixelIdx + 1];
            const b = resizedBuffer[pixelIdx + 2];
            paddedData[0 * 1024 * 1024 + idx] = (r - mean[0]) / std[0];
            paddedData[1 * 1024 * 1024 + idx] = (g - mean[1]) / std[1];
            paddedData[2 * 1024 * 1024 + idx] = (b - mean[2]) / std[2];
          } else {
            paddedData[0 * 1024 * 1024 + idx] = 0;
            paddedData[1 * 1024 * 1024 + idx] = 0;
            paddedData[2 * 1024 * 1024 + idx] = 0;
          }
        }
      }

      const imageTensor = new ort.Tensor("float32", paddedData, [1, 3, 1024, 1024]);
      const encoderFeeds = { x: imageTensor };
      const encoderResults = await encoderSession.run(encoderFeeds);
      const embedding = encoderResults.image_embeddings;

      cached = { embedding, width: W, height: H };
      embeddingCache.set(cacheKey, cached);

      if (embeddingCache.size > 20) {
        const firstKey = embeddingCache.keys().next().value;
        if (firstKey) embeddingCache.delete(firstKey);
      }
    }

    const { embedding, width: W, height: H } = cached;

    const scale = 1024 / Math.max(W, H);
    const pointCoordsList: number[] = [];
    const pointLabelsList: number[] = [];

    for (const prompt of prompts) {
      if (prompt.type === "keypointlabels") {
        const val = prompt.value;
        const xPixel = (val.x / 100) * W;
        const yPixel = (val.y / 100) * H;
        pointCoordsList.push(xPixel * scale, yPixel * scale);
        const labelStr = val.keypointlabels?.[0] || "";
        const isFg = labelStr.toLowerCase() !== "background";
        pointLabelsList.push(isFg ? 1 : 0);
      } else if (prompt.type === "rectanglelabels") {
        const val = prompt.value;
        const xPixel = (val.x / 100) * W;
        const yPixel = (val.y / 100) * H;
        const wPixel = (val.width / 100) * W;
        const hPixel = (val.height / 100) * H;

        pointCoordsList.push(xPixel * scale, yPixel * scale);
        pointLabelsList.push(2);

        pointCoordsList.push((xPixel + wPixel) * scale, (yPixel + hPixel) * scale);
        pointLabelsList.push(3);
      }
    }

    const N = pointLabelsList.length;

    const coordsTensor = new ort.Tensor("float32", new Float32Array(pointCoordsList), [1, N, 2]);
    const labelsTensor = new ort.Tensor("float32", new Float32Array(pointLabelsList), [1, N]);
    const maskInputTensor = new ort.Tensor("float32", new Float32Array(256 * 256), [1, 1, 256, 256]);
    const hasMaskInputTensor = new ort.Tensor("float32", new Float32Array([0.0]), [1]);
    const origImSizeTensor = new ort.Tensor("float32", new Float32Array([H, W]), [2]);

    const decoderFeeds = {
      image_embeddings: embedding,
      point_coords: coordsTensor,
      point_labels: labelsTensor,
      mask_input: maskInputTensor,
      has_mask_input: hasMaskInputTensor,
      orig_im_size: origImSizeTensor,
    };

    const decoderResults = await decoderSession.run(decoderFeeds);
    
    const outputMasks = decoderResults.masks;
    const outputData = outputMasks.data as Float32Array;

    const maskGrid: boolean[][] = [];
    for (let y = 0; y < H; y++) {
      const row: boolean[] = [];
      for (let x = 0; x < W; x++) {
        row.push(outputData[y * W + x] > 0.0);
      }
      maskGrid.push(row);
    }

    const rawPoints = traceContour(maskGrid, W, H);

    if (rawPoints.length === 0) {
      return NextResponse.json({ result: [] });
    }

    const simplifiedPoints = simplifyPolygon(rawPoints, 80);

    const pctPoints = simplifiedPoints.map(([px, py]) => [
      (px / W) * 100,
      (py / H) * 100,
    ]);

    let classLabel = "unlabeled";
    const labelPrompt = prompts.find((p: any) => 
      (p.type === "rectanglelabels" && p.value?.rectanglelabels?.[0])
    );
    if (labelPrompt) {
      classLabel = labelPrompt.value.rectanglelabels[0];
    } else {
      const keypointPrompt = prompts.find((p: any) => p.type === "keypointlabels");
      if (keypointPrompt && keypointPrompt.value?.keypointlabels?.[0]) {
        classLabel = keypointPrompt.value.keypointlabels[0];
      }
    }

    const annotationResult = {
      id: "sam_prediction_" + Math.random().toString(36).substring(7),
      from_name: "label",
      to_name: "media",
      type: "polygonlabels",
      original_width: W,
      original_height: H,
      value: {
        points: pctPoints,
        polygonlabels: [classLabel],
      },
    };

    return NextResponse.json({ result: [annotationResult] });

  } catch (err) {
    console.error("Prediction error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Inference failed" },
      { status: 500 }
    );
  }
}

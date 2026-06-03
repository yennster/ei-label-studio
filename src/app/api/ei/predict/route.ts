import { NextResponse } from "next/server";
import { getSession, studioMedia } from "@/lib/ei-server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Not connected" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const tasks = body.tasks;
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return NextResponse.json({ success: false, error: "No tasks provided" }, { status: 400 });
  }

  const task = tasks[0];
  const imageUrl = task.data?.image;
  if (!imageUrl) {
    return NextResponse.json({ success: false, error: "Task contains no image URL" }, { status: 400 });
  }

  // Parse sampleId and projectId from imageUrl: "/api/ei/media/123/456?kind=image"
  let projectId: number;
  let sampleId: number;
  try {
    const url = new URL(imageUrl, "http://localhost");
    const parts = url.pathname.split("/");
    projectId = Number(parts[4]);
    sampleId = Number(parts[5]);
  } catch {
    return NextResponse.json({ success: false, error: "Could not parse image URL parameters" }, { status: 400 });
  }

  if (isNaN(projectId) || isNaN(sampleId)) {
    return NextResponse.json({ success: false, error: "Invalid project ID or sample ID" }, { status: 400 });
  }

  // Retrieve image bytes from Edge Impulse
  let mediaResponse: Response;
  try {
    const mediaPath = `/${projectId}/raw-data/${sampleId}/image`;
    mediaResponse = await studioMedia(session, mediaPath);
    if (!mediaResponse.ok) {
      return NextResponse.json(
        { success: false, error: `Edge Impulse media error (${mediaResponse.status})` },
        { status: mediaResponse.status || 502 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to fetch image" },
      { status: 502 },
    );
  }

  // Save image to public/tmp for local ML backend access
  const tempFilename = `${projectId}_${sampleId}_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
  const tempDir = path.join(process.cwd(), "public", "tmp");
  const tempFilePath = path.join(tempDir, tempFilename);

  try {
    await fs.mkdir(tempDir, { recursive: true });
    const buffer = Buffer.from(await mediaResponse.arrayBuffer());
    await fs.writeFile(tempFilePath, buffer);
  } catch (err) {
    return NextResponse.json({ success: false, error: "Failed to write temp image file" }, { status: 500 });
  }

  // Rewrite task image URL to local static address
  const host = req.headers.get("host") || "localhost:3000";
  const protocol = req.headers.get("x-forwarded-proto") || "http";
  const localImageUrl = `${protocol}://${host}/tmp/${tempFilename}`;
  task.data.image = localImageUrl;

  const mlBackendUrl = process.env.SAM_BACKEND_URL || "http://localhost:8003/predict";

  try {
    const mlResponse = await fetch(mlBackendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!mlResponse.ok) {
      const errorText = await mlResponse.text();
      return NextResponse.json(
        { success: false, error: `SAM Backend error (${mlResponse.status}): ${errorText}` },
        { status: 502 },
      );
    }

    const data = await mlResponse.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: `Failed to connect to SAM Backend: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  } finally {
    // Delete temp image
    try {
      await fs.unlink(tempFilePath);
    } catch (err) {
      console.error("Failed to delete temp file:", err);
    }
  }
}

import { NextResponse } from "next/server";
import { getSession, studioFetch } from "@/lib/ei-server";
import type { EIBoundingBox } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Not connected" }, { status: 401 });
  }

  let body: { sampleId?: number; boundingBoxes?: EIBoundingBox[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const sampleId = Number(body.sampleId);
  const boundingBoxes = body.boundingBoxes;
  if (!Number.isFinite(sampleId) || !Array.isArray(boundingBoxes)) {
    return NextResponse.json(
      { success: false, error: "sampleId and boundingBoxes are required" },
      { status: 400 },
    );
  }

  const result = await studioFetch(
    session,
    `/${session.projectId}/raw-data/${sampleId}/bounding-boxes`,
    { method: "POST", body: JSON.stringify({ boundingBoxes }) },
  );
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status || 502 },
    );
  }
  return NextResponse.json({ success: true });
}

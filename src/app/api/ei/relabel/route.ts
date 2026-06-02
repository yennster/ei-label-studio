import { NextResponse } from "next/server";
import { getSession, studioFetch } from "@/lib/ei-server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Not connected" }, { status: 401 });
  }

  let body: { sampleId?: number; newLabel?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const sampleId = Number(body.sampleId);
  const newLabel = body.newLabel?.trim();
  if (!Number.isFinite(sampleId) || !newLabel) {
    return NextResponse.json(
      { success: false, error: "sampleId and newLabel are required" },
      { status: 400 },
    );
  }

  const result = await studioFetch(
    session,
    `/${session.projectId}/raw-data/${sampleId}/rename`,
    { method: "POST", body: JSON.stringify({ newLabel }) },
  );
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status || 502 },
    );
  }
  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { getSession, studioFetch } from "@/lib/ei-server";
import type { EISample } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Not connected" }, { status: 401 });
  }

  const url = new URL(req.url);
  const qp = new URLSearchParams();
  const category = url.searchParams.get("category");
  if (category) qp.set("category", category);
  const labels = url.searchParams.get("labels");
  if (labels) qp.set("labels", labels);
  qp.set("limit", url.searchParams.get("limit") || "200");
  qp.set("offset", url.searchParams.get("offset") || "0");
  // We only need metadata for the queue + modality detection.
  qp.set("excludeSensors", "false");

  const result = await studioFetch<{ samples: EISample[]; totalCount: number }>(
    session,
    `/${session.projectId}/raw-data?${qp}`,
  );
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status || 502 },
    );
  }
  return NextResponse.json({
    success: true,
    samples: result.data?.samples ?? [],
    totalCount: result.data?.totalCount ?? 0,
  });
}

import { NextResponse } from "next/server";
import { getSession, studioFetch } from "@/lib/ei-server";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Not connected" }, { status: 401 });
  }

  const result = await studioFetch<{ metadata?: unknown }>(
    session,
    `/${session.projectId}/raw-data/project-metadata`,
  );
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status || 502 },
    );
  }
  return NextResponse.json({
    success: true,
    metadata: result.data?.metadata,
  });
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/ei-server";
import fs from "fs";

export const runtime = "nodejs";

export async function GET() {
  try {
    fs.appendFileSync("server_api.log", `${new Date().toISOString()} [GET] /api/ei/ml-mock called\n`);
  } catch (e) {
    console.error("Failed to write to server_api.log:", e);
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not connected" }, { status: 401 });
  }

  const mockBackendList = [
    {
      id: 1,
      title: "MobileSAM",
      description: "On-device Segment Anything Model running on the Next.js API route",
      model_version: "v1.0.0",
      state: "CO",
      timeout: 100,
      auto_update: true,
      is_interactive: true,
      project: 1
    }
  ];

  return NextResponse.json(mockBackendList);
}

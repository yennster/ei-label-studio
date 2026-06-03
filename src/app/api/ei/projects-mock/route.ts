import { NextResponse } from "next/server";
import { getSession } from "@/lib/ei-server";
import fs from "fs";

export const runtime = "nodejs";

export async function GET() {
  try {
    fs.appendFileSync("server_api.log", `${new Date().toISOString()} [GET] /api/ei/projects-mock called\n`);
  } catch (e) {
    console.error("Failed to write to server_api.log:", e);
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not connected" }, { status: 401 });
  }

  const mockProject = {
    id: 1,
    title: "Edge Impulse Project",
    description: "Embedded Label Studio project for Segment Anything Model",
    created_at: new Date().toISOString(),
  };

  return NextResponse.json(mockProject);
}

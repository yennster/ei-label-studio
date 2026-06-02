import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  serializeSession,
  studioFetch,
} from "@/lib/ei-server";
import type { EIProject, EISession } from "@/lib/types";

export const runtime = "nodejs";

interface ConnectBody {
  apiKey?: string;
  projectId?: number | string;
  studioHost?: string;
  ingestionHost?: string;
}

export async function POST(req: Request) {
  let body: ConnectBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const apiKey = body.apiKey?.trim();
  const projectId = Number(body.projectId);

  if (!apiKey || !/^ei_/.test(apiKey)) {
    return NextResponse.json(
      { success: false, error: "An Edge Impulse API key (starts with ei_) is required." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(projectId) || projectId < 1) {
    return NextResponse.json(
      { success: false, error: "A valid numeric project ID is required." },
      { status: 400 },
    );
  }

  const session: EISession = {
    apiKey,
    projectId,
    studioHost: body.studioHost?.trim() || undefined,
    ingestionHost: body.ingestionHost?.trim() || undefined,
  };

  // Validate the key + project by fetching project info.
  const result = await studioFetch<{ project: EIProject }>(session, `/${projectId}`);
  if (!result.ok) {
    const status = result.status === 0 ? 502 : result.status || 401;
    return NextResponse.json(
      {
        success: false,
        error:
          status === 401 || status === 403
            ? "Edge Impulse rejected that API key for this project."
            : result.error || "Could not reach Edge Impulse.",
      },
      { status },
    );
  }

  const res = NextResponse.json({ success: true, project: result.data?.project });
  res.cookies.set(SESSION_COOKIE, serializeSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

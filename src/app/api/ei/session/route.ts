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
  let projectId = Number(body.projectId);

  if (!apiKey || !/^ei_/.test(apiKey)) {
    return NextResponse.json(
      { success: false, error: "An Edge Impulse API key (starts with ei_) is required." },
      { status: 400 },
    );
  }

  const session: EISession = {
    apiKey,
    projectId,
    studioHost: body.studioHost?.trim() || undefined,
    ingestionHost: body.ingestionHost?.trim() || undefined,
  };

  // A project API key is scoped to one project, so the ID is optional — when
  // it's missing, resolve it from the key itself.
  if (!Number.isFinite(projectId) || projectId < 1) {
    const list = await studioFetch<{ projects: EIProject[] }>(session, "/projects");
    const first = list.data?.projects?.[0];
    if (!list.ok || !first) {
      return NextResponse.json(
        {
          success: false,
          error:
            list.error ||
            "Couldn't determine a project from that API key. Add a project ID, or check the key.",
        },
        { status: list.status === 0 ? 502 : list.status || 401 },
      );
    }
    projectId = first.id;
    session.projectId = projectId;
  }

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
    secure: true,
    sameSite: "none",
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

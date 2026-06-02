import { NextResponse } from "next/server";
import fs from "fs";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { html } = await req.json();
    fs.writeFileSync("/Users/jenny/Work/ei-labelstudio/dom-debug.txt", html, "utf-8");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

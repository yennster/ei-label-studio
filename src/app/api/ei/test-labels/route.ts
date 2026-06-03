import { NextResponse } from "next/server";
import { getSession, studioFetch } from "@/lib/ei-server";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Not connected" }, { status: 401 });
  }

  const results: Record<string, any> = {};

  const testCases = [
    { name: "no_labels_filter", params: {} },
    { name: "labels_empty_string", params: { labels: JSON.stringify([""]) } },
    { name: "labels_null", params: { labels: JSON.stringify([null]) } },
    { name: "labels_unlabeled", params: { labels: JSON.stringify(["unlabeled"]) } },
    { name: "labels_empty_array", params: { labels: JSON.stringify([]) } },
  ];

  for (const tc of testCases) {
    const qp = new URLSearchParams();
    qp.set("limit", "10");
    qp.set("excludeSensors", "true");
    for (const [k, v] of Object.entries(tc.params)) {
      qp.set(k, v);
    }
    const res = await studioFetch<{ samples: any[]; totalCount: number }>(
      session,
      `/${session.projectId}/raw-data?${qp}`
    );
    results[tc.name] = {
      ok: res.ok,
      status: res.status,
      error: res.error,
      totalCount: res.data?.totalCount ?? 0,
      sampleLabels: res.data?.samples?.map((s: any) => ({ id: s.id, filename: s.filename, label: s.label })) ?? [],
    };
  }

  return NextResponse.json({ success: true, results });
}

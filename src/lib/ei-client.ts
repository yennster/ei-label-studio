import type { EICategory, EIProject, EISample } from "./types";

/** Thin client over our same-origin /api/ei/* proxy. */

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Unexpected response (${res.status})`);
  }
  if (!res.ok) {
    const err = (body as { error?: string }).error;
    throw new Error(err || `Request failed (${res.status})`);
  }
  return body as T;
}

export interface ConnectInput {
  apiKey: string;
  /** Optional — resolved from the key server-side when omitted. */
  projectId?: number;
  studioHost?: string;
  ingestionHost?: string;
}

export async function connect(input: ConnectInput): Promise<{ project: EIProject }> {
  const res = await fetch("/api/ei/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow(res);
}

export async function disconnect(): Promise<void> {
  await fetch("/api/ei/session", { method: "DELETE" });
}

export async function getProjects(): Promise<EIProject[]> {
  const res = await fetch("/api/ei/projects");
  const body = await jsonOrThrow<{ projects: EIProject[] }>(res);
  return body.projects ?? [];
}

export interface SamplesQuery {
  category?: EICategory;
  labels?: string[];
  limit?: number;
  offset?: number;
}

export async function getSamples(q: SamplesQuery): Promise<{ samples: EISample[]; totalCount: number }> {
  const params = new URLSearchParams();
  if (q.category) params.set("category", q.category);
  if (q.labels?.length) params.set("labels", q.labels.join(","));
  if (q.limit != null) params.set("limit", String(q.limit));
  if (q.offset != null) params.set("offset", String(q.offset));
  const res = await fetch(`/api/ei/samples?${params}`);
  return jsonOrThrow(res);
}

export async function relabel(sampleId: number, newLabel: string): Promise<void> {
  const res = await fetch("/api/ei/relabel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sampleId, newLabel }),
  });
  await jsonOrThrow(res);
}

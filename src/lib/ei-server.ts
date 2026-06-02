import "server-only";
import { cookies } from "next/headers";
import type { EISession } from "./types";

export const SESSION_COOKIE = "ei_session";

const DEFAULT_STUDIO = "https://studio.edgeimpulse.com";
const DEFAULT_INGESTION = "https://ingestion.edgeimpulse.com";

/** Normalize a user-supplied host into an absolute origin (no trailing slash). */
export function normalizeHost(host: string | undefined, fallback: string): string {
  if (!host) return fallback;
  let h = host.trim();
  if (!h) return fallback;
  if (!/^https?:\/\//i.test(h)) h = `https://${h}`;
  return h.replace(/\/+$/, "");
}

export function studioBase(session: EISession): string {
  return `${normalizeHost(session.studioHost, DEFAULT_STUDIO)}/v1/api`;
}

export function ingestionBase(session: EISession): string {
  return `${normalizeHost(session.ingestionHost, DEFAULT_INGESTION)}/api`;
}

/** Read and parse the session cookie. Returns null when not connected. */
export async function getSession(): Promise<EISession | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as EISession;
    if (!parsed.apiKey || !parsed.projectId) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Serialize a session for storage in the cookie value. */
export function serializeSession(session: EISession): string {
  return JSON.stringify(session);
}

export interface StudioFetchResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

/**
 * Call a Studio API path (relative to /v1/api) with the session's api key.
 * Parses JSON and checks the EI `success` envelope.
 */
export async function studioFetch<T = unknown>(
  session: EISession,
  path: string,
  init?: RequestInit,
): Promise<StudioFetchResult<T>> {
  const url = `${studioBase(session)}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        "x-api-key": session.apiKey,
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : "network error" };
  }

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, status: res.status, error: `Non-JSON response (${res.status})` };
  }

  const envelope = json as { success?: boolean; error?: string };
  if (!res.ok || envelope.success === false) {
    return {
      ok: false,
      status: res.status,
      error: envelope.error || `Edge Impulse API error (${res.status})`,
    };
  }
  return { ok: true, status: res.status, data: json as T };
}

/** Fetch raw binary media (image/wav/raw) and stream it back to the caller. */
export async function studioMedia(
  session: EISession,
  path: string,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  const url = `${studioBase(session)}${path}`;
  return fetch(url, {
    headers: { "x-api-key": session.apiKey, ...(extraHeaders ?? {}) },
    cache: "no-store",
  });
}

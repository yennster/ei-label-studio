import type { EICategory, LabelTask, WorkMode } from "./types";

/**
 * Deep-link presets, in the spirit of synthetic-data-studio's url-parameters.
 * Parsed ONCE at load — not state-sync. Invalid values are silently dropped,
 * booleans accept several spellings, enums are case-insensitive.
 */
export interface UrlPreset {
  apiKey?: string;
  projectId?: number;
  category?: EICategory;
  labels?: string[];
  task?: LabelTask;
  mode?: WorkMode;
  autoAdvance?: boolean;
  limit?: number;
  offset?: number;
  theme?: "dark" | "light" | "unicorn";
  embed?: boolean;
  studioHost?: string;
  ingestionHost?: string;
}

const TRUE = new Set(["1", "true", "yes", "on"]);
const FALSE = new Set(["0", "false", "no", "off"]);

function bool(v: string | null): boolean | undefined {
  if (v == null) return undefined;
  const s = v.trim().toLowerCase();
  if (TRUE.has(s)) return true;
  if (FALSE.has(s)) return false;
  return undefined;
}

function int(v: string | null, min = -Infinity, max = Infinity): number | undefined {
  if (v == null) return undefined;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n < min || n > max) return undefined;
  return n;
}

function enumv<T extends string>(v: string | null, allowed: readonly T[]): T | undefined {
  if (v == null) return undefined;
  const s = v.trim().toLowerCase();
  return allowed.find((a) => a === s);
}

/** Parse a URLSearchParams (or query string) into a preset. Never throws. */
export function parsePreset(input: URLSearchParams | string): UrlPreset {
  const p = typeof input === "string" ? new URLSearchParams(input) : input;
  const preset: UrlPreset = {};

  const apiKey = p.get("apiKey");
  if (apiKey && /^ei_/.test(apiKey.trim())) preset.apiKey = apiKey.trim();

  const projectId = int(p.get("project") ?? p.get("eiProject"), 1);
  if (projectId !== undefined) preset.projectId = projectId;

  const category = enumv(p.get("category"), ["training", "testing", "anomaly"] as const);
  if (category) preset.category = category;

  const labels = p.get("labels");
  if (labels) {
    const list = labels.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length) preset.labels = list;
  }

  const task = enumv(p.get("task"), ["classify", "detect", "audio", "timeseries", "transcribe"] as const);
  if (task) preset.task = task;

  const mode = enumv(p.get("mode"), ["relabel", "import"] as const);
  if (mode) preset.mode = mode;

  const autoAdvance = bool(p.get("autoAdvance"));
  if (autoAdvance !== undefined) preset.autoAdvance = autoAdvance;

  const limit = int(p.get("limit"), 1, 1000);
  if (limit !== undefined) preset.limit = limit;

  const offset = int(p.get("offset"), 0);
  if (offset !== undefined) preset.offset = offset;

  const theme = enumv(p.get("theme"), ["dark", "light", "unicorn"] as const);
  if (theme) preset.theme = theme;

  const embed = bool(p.get("embed"));
  if (embed !== undefined) preset.embed = embed;

  const studioHost = p.get("studioHost");
  if (studioHost) preset.studioHost = studioHost.trim();

  const ingestionHost = p.get("ingestionHost");
  if (ingestionHost) preset.ingestionHost = ingestionHost.trim();

  return preset;
}

"use client";

import { create } from "zustand";
import type { EICategory, EIProject, EISample, LabelTask, WorkMode } from "./types";
import type { UrlPreset } from "./url-params";

interface AppState {
  // connection
  connected: boolean;
  project: EIProject | null;
  // workspace config (seeded from URL presets)
  category: EICategory;
  labelFilter: string[];
  task: LabelTask | null; // null = auto-detect per sample
  mode: WorkMode;
  autoAdvance: boolean;
  embed: boolean;
  limit: number;
  // data
  samples: EISample[];
  totalCount: number;
  activeIndex: number;
  // pending preset that should pre-fill the connect form
  preset: UrlPreset | null;

  setConnected: (project: EIProject | null) => void;
  applyPreset: (preset: UrlPreset) => void;
  setSamples: (samples: EISample[], totalCount: number) => void;
  setActiveIndex: (i: number) => void;
  setCategory: (c: EICategory) => void;
  setTask: (t: LabelTask | null) => void;
  setLabelFilter: (l: string[]) => void;
  setAutoAdvance: (v: boolean) => void;
  markLabeled: (sampleId: number, label: string) => void;
  reset: () => void;
}

export const useApp = create<AppState>((set) => ({
  connected: false,
  project: null,
  category: "training",
  labelFilter: [],
  task: null,
  mode: "relabel",
  autoAdvance: true,
  embed: false,
  limit: 200,
  samples: [],
  totalCount: 0,
  activeIndex: 0,
  preset: null,

  setConnected: (project) => set({ connected: !!project, project }),
  applyPreset: (preset) =>
    set((s) => ({
      preset,
      category: preset.category ?? s.category,
      labelFilter: preset.labels ?? s.labelFilter,
      task: preset.task ?? s.task,
      mode: preset.mode ?? s.mode,
      autoAdvance: preset.autoAdvance ?? s.autoAdvance,
      embed: preset.embed ?? s.embed,
      limit: preset.limit ?? s.limit,
    })),
  setSamples: (samples, totalCount) => set({ samples, totalCount, activeIndex: 0 }),
  setActiveIndex: (activeIndex) => set({ activeIndex }),
  setCategory: (category) => set({ category }),
  setTask: (task) => set({ task }),
  setLabelFilter: (labelFilter) => set({ labelFilter }),
  setAutoAdvance: (autoAdvance) => set({ autoAdvance }),
  markLabeled: (sampleId, label) =>
    set((s) => ({
      samples: s.samples.map((x) => (x.id === sampleId ? { ...x, label } : x)),
    })),
  reset: () =>
    set({ connected: false, project: null, samples: [], totalCount: 0, activeIndex: 0 }),
}));

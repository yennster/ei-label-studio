"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  SkipForward,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { SampleQueue } from "@/components/sample-queue";
import { useApp } from "@/lib/store";
import { getSamples, getProjects, relabel } from "@/lib/ei-client";
import { parsePreset } from "@/lib/url-params";
import { detectModality, defaultTaskForModality } from "@/lib/modality";
import { buildLabelConfig, channelsForSample } from "@/lib/ls-config";
import { sampleToTask, labelFromAnnotation } from "@/lib/mapping";
import type { EICategory, LabelTask } from "@/lib/types";

const LabelStudio = dynamic(() => import("@/components/label-studio"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <Loader2 className="mr-2 size-4 animate-spin" /> Loading canvas…
    </div>
  ),
});

const TASK_LABELS: Record<LabelTask, string> = {
  classify: "Image · classify",
  detect: "Image · detect",
  audio: "Audio · classify",
  timeseries: "Time-series",
};

export function Workspace() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const {
    connected,
    project,
    embed,
    samples,
    category,
    task: forcedTask,
    autoAdvance,
    activeIndex,
    setConnected,
    applyPreset,
    setSamples,
    setActiveIndex,
    setCategory,
    setTask,
    markLabeled,
  } = useApp();

  const [loading, setLoading] = useState(true);
  const [hydrating, setHydrating] = useState(!connected);
  const [labeledIds, setLabeledIds] = useState<Set<number>>(new Set());
  const [customLabels, setCustomLabels] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // On direct loads the in-memory store is empty even when the session cookie
  // is valid. Apply URL presets, then rehydrate from the existing session
  // before deciding whether to send the user back to connect.
  useEffect(() => {
    if (connected && project) {
      setHydrating(false);
      return;
    }
    let cancelled = false;
    const preset = parsePreset(window.location.search);
    applyPreset(preset);
    if (preset.theme) setTheme(preset.theme);
    (async () => {
      try {
        const projects = await getProjects();
        if (cancelled) return;
        if (projects.length) {
          setConnected(projects[0]);
          setHydrating(false);
        } else {
          router.replace("/");
        }
      } catch {
        if (!cancelled) router.replace("/");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSamples = useCallback(async () => {
    setLoading(true);
    try {
      const { samples: list } = await getSamples({ category, limit: 200 });
      setSamples(list, list.length);
      setLabeledIds(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load samples");
    } finally {
      setLoading(false);
    }
  }, [category, setSamples]);

  useEffect(() => {
    if (connected && project) void loadSamples();
  }, [connected, project, category, loadSamples]);

  const active = samples[activeIndex];

  const effectiveTask: LabelTask = useMemo(() => {
    if (forcedTask) return forcedTask;
    return active ? defaultTaskForModality(detectModality(active)) : "classify";
  }, [forcedTask, active]);

  // Class label set = distinct dataset labels ∪ custom labels ∪ active label.
  const labelSet = useMemo(() => {
    const set = new Set<string>();
    for (const s of samples) if (s.label && s.label !== "unlabeled") set.add(s.label);
    for (const l of customLabels) set.add(l);
    if (active?.label && active.label !== "unlabeled") set.add(active.label);
    return Array.from(set).sort();
  }, [samples, customLabels, active]);

  const config = useMemo(
    () =>
      buildLabelConfig({
        task: effectiveTask,
        labels: labelSet,
        channels: active ? channelsForSample(active) : undefined,
      }),
    [effectiveTask, labelSet, active],
  );

  const lsTask = useMemo(
    () => (active && project ? sampleToTask(active, project.id, effectiveTask) : null),
    [active, project, effectiveTask],
  );

  const goTo = useCallback(
    (i: number) => {
      if (i >= 0 && i < samples.length) setActiveIndex(i);
    },
    [samples.length, setActiveIndex],
  );

  const handleSubmit = useCallback(
    async (annotation: unknown) => {
      if (!active) return;
      const label = labelFromAnnotation(annotation);
      if (!label) {
        toast.error("Pick a class before submitting.");
        return;
      }
      setSubmitting(true);
      try {
        await relabel(active.id, label);
        markLabeled(active.id, label);
        setLabeledIds((prev) => new Set(prev).add(active.id));
        if (effectiveTask === "detect" || effectiveTask === "timeseries") {
          toast.success(`Sample label set to “${label}”`, {
            description: "Region-level labels aren't pushed back to EI yet.",
          });
        } else {
          toast.success(`Relabeled to “${label}”`);
        }
        if (autoAdvance) {
          const next = samples.findIndex((s, i) => i > activeIndex && !labeledIds.has(s.id));
          goTo(next === -1 ? Math.min(activeIndex + 1, samples.length - 1) : next);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Relabel failed");
      } finally {
        setSubmitting(false);
      }
    },
    [active, effectiveTask, autoAdvance, samples, activeIndex, labeledIds, goTo, markLabeled],
  );

  // Embed mode hides the surrounding chrome for iframe use.
  useEffect(() => {
    const el = document.documentElement;
    if (embed) el.classList.add("embed-mode");
    return () => el.classList.remove("embed-mode");
  }, [embed]);

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
        return;
      if (e.key === "[") goTo(activeIndex - 1);
      if (e.key === "]") goTo(activeIndex + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, goTo]);

  function addCustomLabel() {
    const v = newLabel.trim();
    if (!v) return;
    setCustomLabels((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setNewLabel("");
  }

  if (hydrating || !connected || !project) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Restoring session…
      </div>
    );
  }

  const progress = samples.length ? (labeledIds.size / samples.length) * 100 : 0;

  return (
    <div className="grid flex-1 grid-cols-1 lg:grid-cols-[260px_1fr_300px]">
      {/* Left: queue */}
      <aside className="flex min-h-0 flex-col border-r border-border/60 bg-sidebar/40">
        <div className="space-y-3 border-b border-border/60 p-3">
          <Select value={category} onValueChange={(v) => setCategory(v as EICategory)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="training">Training set</SelectItem>
              <SelectItem value="testing">Testing set</SelectItem>
              <SelectItem value="anomaly">Anomaly set</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {labeledIds.size}/{samples.length} labeled
            </span>
            <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={loadSamples}>
              <RefreshCw className="size-3" /> Refresh
            </button>
          </div>
          <Progress value={progress} className="h-1" />
        </div>
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : samples.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
            No samples in the {category} set.
          </div>
        ) : (
          <div className="min-h-0 flex-1">
            <SampleQueue
              samples={samples}
              activeIndex={activeIndex}
              labeledIds={labeledIds}
              onSelect={goTo}
            />
          </div>
        )}
      </aside>

      {/* Center: canvas */}
      <section className="relative flex min-h-0 flex-col bg-muted/20">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2">
          <div className="flex items-center gap-2 text-sm">
            <Button variant="ghost" size="icon" onClick={() => goTo(activeIndex - 1)} disabled={activeIndex <= 0}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="tabular-nums text-muted-foreground">
              {samples.length ? activeIndex + 1 : 0} / {samples.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => goTo(activeIndex + 1)}
              disabled={activeIndex >= samples.length - 1}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          {active && <span className="truncate font-mono text-xs text-muted-foreground">{active.filename}</span>}
          <Badge variant="secondary" className="gap-1">
            <Tag className="size-3" />
            {TASK_LABELS[effectiveTask]}
          </Badge>
        </div>
        <div className="relative min-h-0 flex-1">
          {lsTask ? (
            <LabelStudio key={`${active?.id}-${effectiveTask}`} config={config} task={lsTask} onSubmit={handleSubmit} onSkip={() => goTo(activeIndex + 1)} />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              {loading ? "" : "Select a sample to begin."}
            </div>
          )}
        </div>
      </section>

      {/* Right: inspector */}
      <aside className="hidden min-h-0 flex-col gap-4 overflow-y-auto border-l border-border/60 p-4 lg:flex">
        <div>
          <h2 className="text-sm font-semibold">{project.name}</h2>
          <p className="font-mono text-xs text-muted-foreground">project #{project.id}</p>
        </div>
        <Separator />

        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">Labeling template</span>
          <Select value={forcedTask ?? "auto"} onValueChange={(v) => setTask(v === "auto" ? null : (v as LabelTask))}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-detect per sample</SelectItem>
              <SelectItem value="classify">Image · classify</SelectItem>
              <SelectItem value="detect">Image · detect (boxes)</SelectItem>
              <SelectItem value="audio">Audio · classify</SelectItem>
              <SelectItem value="timeseries">Time-series</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {active && (
          <div className="space-y-2 rounded-lg border border-border bg-card/50 p-3 text-sm">
            <Row label="Current label">
              <Badge variant={active.label && active.label !== "unlabeled" ? "default" : "secondary"}>
                {active.label || "unlabeled"}
              </Badge>
            </Row>
            <Row label="Category">{active.category}</Row>
            {active.frequency ? <Row label="Frequency">{active.frequency} Hz</Row> : null}
            {active.totalLengthMs ? <Row label="Length">{Math.round(active.totalLengthMs)} ms</Row> : null}
            {active.sensors?.length ? <Row label="Axes">{active.sensors.map((s) => s.name).join(", ")}</Row> : null}
          </div>
        )}

        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">Classes ({labelSet.length})</span>
          <div className="flex flex-wrap gap-1.5">
            {labelSet.length ? (
              labelSet.map((l) => (
                <Badge key={l} variant="secondary" className="font-normal">
                  {l}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">None yet — add one below.</span>
            )}
          </div>
          <div className="flex gap-1.5">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomLabel()}
              placeholder="Add a class…"
              className="h-8 text-sm"
            />
            <Button size="icon" variant="secondary" className="size-8 shrink-0" onClick={addCustomLabel}>
              <Plus className="size-4" />
            </Button>
          </div>
        </div>

        <Separator />
        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Auto-advance</span>
            <Badge variant={autoAdvance ? "default" : "secondary"}>{autoAdvance ? "on" : "off"}</Badge>
          </div>
          <p>
            Submit in the canvas to push the label to Edge Impulse. Use{" "}
            <kbd className="rounded bg-secondary px-1">[</kbd> /{" "}
            <kbd className="rounded bg-secondary px-1">]</kbd> to move between samples.
          </p>
          <Button variant="outline" size="sm" className="w-full" onClick={() => goTo(activeIndex + 1)}>
            <SkipForward className="size-3.5" /> Skip sample
          </Button>
        </div>
        {submitting && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Saving to Edge Impulse…
          </div>
        )}
      </aside>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

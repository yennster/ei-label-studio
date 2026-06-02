"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Boxes,
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
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { SampleQueue } from "@/components/sample-queue";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { getSamples, getProjects, relabel, setBoundingBoxes } from "@/lib/ei-client";
import { parsePreset } from "@/lib/url-params";
import { detectModality } from "@/lib/modality";
import { defaultTaskFor, projectTypeLabel } from "@/lib/project-type";
import { buildLabelConfig, channelsForSample } from "@/lib/ls-config";
import { sampleToTask, labelFromAnnotation, boxesFromAnnotation } from "@/lib/mapping";
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
  const [resizing, setResizing] = useState(false);

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
    return active ? defaultTaskFor(detectModality(active), project?.labelingMethod) : "classify";
  }, [forcedTask, active, project]);

  // Dominant modality across the loaded set, for the project-type label.
  const projectModality = useMemo(() => {
    if (!samples.length) return undefined;
    const counts: Record<string, number> = {};
    for (const s of samples) {
      const m = detectModality(s);
      counts[m] = (counts[m] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as
      | ReturnType<typeof detectModality>
      | undefined;
  }, [samples]);

  // Class vocabulary = the project's distinct classes ∪ custom labels.
  // EI summarizes multi-class samples as a comma-joined string (e.g.
  // "coffee, lamp"), so split those into individual classes, and pull labels
  // off any bounding boxes too.
  const labelSet = useMemo(() => {
    const set = new Set<string>();
    const addLabel = (raw?: string) => {
      if (!raw || raw === "unlabeled") return;
      for (const part of raw.split(",")) {
        const v = part.trim();
        if (v) set.add(v);
      }
    };
    for (const s of samples) {
      addLabel(s.label);
      s.boundingBoxes?.forEach((b) => addLabel(b.label));
    }
    for (const l of customLabels) set.add(l);
    addLabel(active?.label);
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

  const advance = useCallback(() => {
    if (!autoAdvance) return;
    const next = samples.findIndex((s, i) => i > activeIndex && !labeledIds.has(s.id));
    goTo(next === -1 ? Math.min(activeIndex + 1, samples.length - 1) : next);
  }, [autoAdvance, samples, activeIndex, labeledIds, goTo]);

  const handleSubmit = useCallback(
    async (annotation: unknown) => {
      if (!active) return;
      setSubmitting(true);
      try {
        if (effectiveTask === "detect") {
          // Object detection: push the (edited) boxes back to EI as pixels.
          const boxes = boxesFromAnnotation(annotation);
          await setBoundingBoxes(active.id, boxes);
          markLabeled(active.id, active.label);
          setLabeledIds((prev) => new Set(prev).add(active.id));
          toast.success(
            boxes.length
              ? `Saved ${boxes.length} box${boxes.length > 1 ? "es" : ""} to Edge Impulse`
              : "Cleared all boxes in Edge Impulse",
          );
          advance();
          return;
        }

        if (effectiveTask === "timeseries") {
          const label = labelFromAnnotation(annotation);
          if (!label) {
            toast.error("Add a labeled segment before submitting.");
            return;
          }
          await relabel(active.id, label);
          markLabeled(active.id, label);
          setLabeledIds((prev) => new Set(prev).add(active.id));
          toast.success(`Sample label set to “${label}”`, {
            description: "Per-segment labels aren't pushed back to EI yet.",
          });
          advance();
          return;
        }

        // classify / audio
        const label = labelFromAnnotation(annotation);
        if (!label) {
          toast.error("Pick a class before submitting.");
          return;
        }
        await relabel(active.id, label);
        markLabeled(active.id, label);
        setLabeledIds((prev) => new Set(prev).add(active.id));
        toast.success(`Relabeled to “${label}”`);
        advance();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      } finally {
        setSubmitting(false);
      }
    },
    [active, effectiveTask, advance, markLabeled],
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
    <ResizablePanelGroup
      direction="horizontal"
      autoSaveId="ei-workspace-cols"
      className={cn("min-h-0 flex-1", resizing && "select-none [&_iframe]:pointer-events-none")}
    >
      {/* Left: queue */}
      <ResizablePanel defaultSize={20} minSize={13} maxSize={34} className="min-w-0">
      <aside className="flex h-full min-h-0 flex-col bg-sidebar/40">
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
      </ResizablePanel>

      <ResizableHandle withHandle onDragging={setResizing} />

      {/* Center: canvas */}
      <ResizablePanel defaultSize={56} minSize={30} className="min-w-0">
      <section className="relative flex h-full min-h-0 flex-col bg-muted/20">
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
          {active && <span className="hidden truncate font-mono text-xs text-muted-foreground sm:inline">{active.filename}</span>}
          <div className="flex items-center gap-2">
            <Badge className="gap-1 bg-primary/15 text-primary hover:bg-primary/15">
              <Boxes className="size-3" />
              {projectTypeLabel(project, projectModality)}
            </Badge>
            <Badge variant="secondary" className="hidden gap-1 md:inline-flex">
              <Tag className="size-3" />
              {TASK_LABELS[effectiveTask]}
            </Badge>
          </div>
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
      </ResizablePanel>

      <ResizableHandle withHandle onDragging={setResizing} />

      {/* Right: inspector */}
      <ResizablePanel defaultSize={24} minSize={16} maxSize={40} className="min-w-0">
      <aside className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4">
        <div className="space-y-1.5">
          <h2 className="text-sm font-semibold leading-tight">{project.name}</h2>
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
              {projectTypeLabel(project, projectModality)}
            </Badge>
            <span className="font-mono text-xs text-muted-foreground">#{project.id}</span>
          </div>
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
      </ResizablePanel>
    </ResizablePanelGroup>
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

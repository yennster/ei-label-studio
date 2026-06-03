"use client";

import { Check, ImageIcon, AudioLines, Activity, Film, FileQuestion } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { detectModality } from "@/lib/modality";
import type { EISample, Modality } from "@/lib/types";

const MODALITY_ICON: Record<Modality, typeof ImageIcon> = {
  image: ImageIcon,
  audio: AudioLines,
  timeseries: Activity,
  video: Film,
  unknown: FileQuestion,
};

export function SampleQueue({
  samples,
  activeIndex,
  labeledIds,
  onSelect,
}: {
  samples: EISample[];
  activeIndex: number;
  labeledIds: Set<number>;
  onSelect: (i: number) => void;
}) {
  return (
    <ScrollArea className="h-full">
      <ul className="space-y-0.5 p-2">
        {samples.map((s, i) => {
          const Icon = MODALITY_ICON[detectModality(s)];
          const active = i === activeIndex;
          const done = labeledIds.has(s.id);
          const unlabeled = !s.label || s.label === "unlabeled" || s.label === "-";
          return (
            <li key={s.id}>
              <button
                onClick={() => onSelect(i)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition",
                  active
                    ? "bg-primary/15 text-foreground ring-1 ring-primary/40"
                    : "hover:bg-secondary/60",
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    active ? "text-primary" : unlabeled ? "text-muted-foreground/50" : "text-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate font-mono text-xs",
                    unlabeled && !active && "text-muted-foreground",
                  )}
                >
                  {s.filename}
                </span>
                {done ? (
                  <Check className="size-3.5 shrink-0 text-emerald-500" />
                ) : unlabeled ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-muted-foreground/40 px-1.5 py-0 text-[10px] text-muted-foreground">
                    <span className="size-1.5 rounded-full border border-muted-foreground/60" />
                    unlabeled
                  </span>
                ) : (
                  <Badge
                    variant="secondary"
                    className="max-w-24 shrink-0 truncate px-1.5 py-0 text-[10px]"
                  >
                    {s.label}
                  </Badge>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}

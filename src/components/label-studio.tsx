"use client";

import { useEffect, useRef } from "react";
import type { LSTask } from "@/lib/types";

/*
 * The Label Studio Frontend ships as a self-contained UMD bundle that exposes a
 * `LabelStudio` global. We vendor it under /public/vendor/label-studio (pinned
 * to the last version that publishes a built bundle) and load it on demand —
 * this keeps the 2 MB editor out of our app bundle and out of SSR entirely.
 */

interface LSInstance {
  destroy?: () => void;
}
type LSConstructor = new (root: HTMLElement, options: Record<string, unknown>) => LSInstance;

declare global {
  interface Window {
    LabelStudio?: LSConstructor;
  }
}

let loaderPromise: Promise<LSConstructor> | null = null;

function loadLabelStudio(): Promise<LSConstructor> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.LabelStudio) return Promise.resolve(window.LabelStudio);
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<LSConstructor>((resolve, reject) => {
    if (!document.getElementById("ls-css")) {
      const link = document.createElement("link");
      link.id = "ls-css";
      link.rel = "stylesheet";
      link.href = "/vendor/label-studio/main.css";
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = "/vendor/label-studio/main.js";
    script.async = true;
    script.onload = () =>
      window.LabelStudio
        ? resolve(window.LabelStudio)
        : reject(new Error("Label Studio global missing"));
    script.onerror = () => {
      loaderPromise = null;
      reject(new Error("Failed to load the Label Studio bundle"));
    };
    document.body.appendChild(script);
  });
  return loaderPromise;
}

interface LabelStudioProps {
  config: string;
  task: LSTask;
  onSubmit: (annotation: unknown) => void;
  onSkip?: () => void;
}

export default function LabelStudio({ config, task, onSubmit, onSkip }: LabelStudioProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<LSInstance | null>(null);
  const handlers = useRef({ onSubmit, onSkip });
  handlers.current = { onSubmit, onSkip };

  useEffect(() => {
    let cancelled = false;

    loadLabelStudio()
      .then((LabelStudioCtor) => {
        if (cancelled || !rootRef.current) return;
        instanceRef.current?.destroy?.();
        rootRef.current.innerHTML = "";

        instanceRef.current = new LabelStudioCtor(rootRef.current, {
          config,
          task,
          interfaces: [
            "panel",
            "update",
            "submit",
            "skip",
            "controls",
            "infobar",
            "topbar",
            "instruction",
            "side-column",
            "annotations:current",
          ],
          user: { pk: 1, firstName: "Labeler" },
          onSubmitAnnotation: (_ls: unknown, annotation: unknown) =>
            handlers.current.onSubmit(serializeAnnotation(annotation)),
          onUpdateAnnotation: (_ls: unknown, annotation: unknown) =>
            handlers.current.onSubmit(serializeAnnotation(annotation)),
          onSkipTask: () => handlers.current.onSkip?.(),
        });
      })
      .catch(() => {
        if (rootRef.current && !cancelled) {
          rootRef.current.innerHTML =
            '<div style="padding:2rem;text-align:center;color:#888">Could not load the labeling canvas.</div>';
        }
      });

    return () => {
      cancelled = true;
      instanceRef.current?.destroy?.();
      instanceRef.current = null;
    };
  }, [config, task]);

  return <div ref={rootRef} className="ls-root h-full w-full" />;
}

function serializeAnnotation(annotation: unknown): unknown {
  const a = annotation as { serializeAnnotation?: () => unknown };
  if (typeof a?.serializeAnnotation === "function") {
    return { result: a.serializeAnnotation() };
  }
  return annotation;
}

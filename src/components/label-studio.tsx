"use client";

import { useEffect, useRef } from "react";
import type { LSTask } from "@/lib/types";

/*
 * Host for the isolated Label Studio iframe (/embed/labeler). Keeping the
 * editor in its own document prevents its global stylesheet from leaking into
 * the app. Config + task are pushed in via postMessage; annotations come back
 * the same way.
 */

interface LabelStudioProps {
  config: string;
  task: LSTask;
  onSubmit: (annotation: unknown) => void;
  onSkip?: () => void;
}

export default function LabelStudio({ config, task, onSubmit, onSkip }: LabelStudioProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const handlers = useRef({ onSubmit, onSkip });
  handlers.current = { onSubmit, onSkip };

  useEffect(() => {
    const origin = window.location.origin;

    const send = () =>
      iframeRef.current?.contentWindow?.postMessage(
        { source: "ls-host", type: "render", config, task },
        origin,
      );

    function onMessage(e: MessageEvent) {
      if (e.origin !== origin) return;
      const d = e.data;
      if (d?.source !== "ls-embed") return;
      if (d.type === "ready") {
        ready.current = true;
        send();
      } else if (d.type === "submit") {
        handlers.current.onSubmit(d.annotation);
      } else if (d.type === "skip") {
        handlers.current.onSkip?.();
      }
    }

    window.addEventListener("message", onMessage);
    // If the iframe is already up (config/task changed), push the new sample.
    if (ready.current) send();

    return () => window.removeEventListener("message", onMessage);
  }, [config, task]);

  return (
    <iframe
      ref={iframeRef}
      src="/embed/labeler"
      title="Label Studio"
      className="h-full w-full border-0 bg-white"
    />
  );
}

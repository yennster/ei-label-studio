"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
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
  /** Sample navigation forwarded from inside the iframe ([ and ] keys). */
  onNav?: (dir: number) => void;
}

export default function LabelStudio({ config, task, onSubmit, onSkip, onNav }: LabelStudioProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const { resolvedTheme } = useTheme();
  const handlers = useRef({ onSubmit, onSkip, onNav });
  handlers.current = { onSubmit, onSkip, onNav };

  const themeRef = useRef(resolvedTheme);
  themeRef.current = resolvedTheme;

  // Use a unique session token as a cache-buster so the iframe page reloads
  // fresh on mount but stays constant while hot-reloading samples.
  const cacheBuster = useRef(Math.random().toString(36).substring(7));

  useEffect(() => {
    if (ready.current) {
      const origin = window.location.origin;
      iframeRef.current?.contentWindow?.postMessage(
        { source: "ls-host", type: "theme", theme: resolvedTheme },
        origin,
      );
    }
  }, [resolvedTheme]);

  useEffect(() => {
    const origin = window.location.origin;

    const send = () =>
      iframeRef.current?.contentWindow?.postMessage(
        { source: "ls-host", type: "render", config, task, theme: themeRef.current },
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
      } else if (d.type === "nav") {
        handlers.current.onNav?.(d.dir);
      } else if (d.type === "error") {
        toast.error(`Canvas error: ${d.annotation}`);
      }
    }

    window.addEventListener("message", onMessage);
    // If the iframe is already up (config/task changed), push the new sample.
    if (ready.current) send();

    return () => window.removeEventListener("message", onMessage);
  }, [config, task]);

  return (
    <div className="h-full w-full bg-white">
      <iframe
        ref={iframeRef}
        src={`/embed/labeler?theme=${resolvedTheme || "dark"}&v=${cacheBuster.current}`}
        title="Label Studio"
        className="h-full w-full min-w-0 border-0 bg-white"
      />
    </div>
  );
}

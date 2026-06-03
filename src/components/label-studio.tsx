"use client";

import { useEffect, useRef, useState } from "react";
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
  /** Null while samples are still loading — the iframe mounts and warms the
   *  Label Studio bundle, and we push the first task once it's ready. */
  task: LSTask | null;
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

  // Track if the iframe has completed its initial load event to prevent race conditions
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Use a unique session token as a cache-buster so the iframe page reloads
  // fresh on mount but stays constant while hot-reloading samples. Lazy state
  // initializer → computed once per mount, not on every render.
  const [cacheBuster] = useState(() => Math.random().toString(36).substring(7));

  useEffect(() => {
    if (ready.current || iframeLoaded) {
      const origin = window.location.origin;
      console.log("[LSF Parent] Resolving theme update inside iframe:", resolvedTheme);
      iframeRef.current?.contentWindow?.postMessage(
        { source: "ls-host", type: "theme", theme: resolvedTheme },
        origin,
      );
    }
  }, [resolvedTheme, iframeLoaded]);

  useEffect(() => {
    const origin = window.location.origin;
    console.log("[LSF Parent] useEffect hook ran. task ID:", task?.id, "iframeLoaded:", iframeLoaded, "ready:", ready.current);

    const send = () => {
      // Nothing to render until the first sample/task is ready; the iframe is
      // already mounted and loading the bundle in the meantime.
      if (!task) {
        console.log("[LSF Parent] Send aborted: task is null");
        return;
      }
      console.log("[LSF Parent] Sending render postMessage to iframe for task:", task.id);
      iframeRef.current?.contentWindow?.postMessage(
        { source: "ls-host", type: "render", config, task, theme: themeRef.current },
        origin,
      );
    };

    function onMessage(e: MessageEvent) {
      if (e.origin !== origin) return;
      const d = e.data;
      if (d?.source !== "ls-embed") return;
      console.log("[LSF Parent] Received postMessage:", d.type, d);
      if (d.type === "ready") {
        ready.current = true;
        send();
      } else if (d.type === "submit") {
        handlers.current.onSubmit(d.annotation);
      } else if (d.type === "skip") {
        handlers.current.onSkip?.();
      } else if (d.type === "nav") {
        handlers.current.onNav?.(d.dir);
      } else if (d.type === "log") {
        console.log(...d.args);
      } else if (d.type === "error") {
        toast.error(`Canvas error: ${d.annotation}`);
      }
    }

    window.addEventListener("message", onMessage);
    // If the iframe is already up (config/task changed), push the new sample.
    if (ready.current || iframeLoaded) {
      console.log("[LSF Parent] Iframe is ready/loaded during effect, sending render");
      send();
    }

    return () => window.removeEventListener("message", onMessage);
  }, [config, task, iframeLoaded]);

  return (
    <div className="h-full w-full bg-background">
      <iframe
        ref={iframeRef}
        src={`/embed/labeler?theme=${resolvedTheme || "dark"}&v=${cacheBuster}_v7`}
        title="Label Studio"
        className="h-full w-full min-w-0 border-0 bg-background"
        onLoad={() => {
          console.log("[LSF Parent] iframe onLoad event handler triggered");
          setIframeLoaded(true);
        }}
      />
    </div>
  );
}

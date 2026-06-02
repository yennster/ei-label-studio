"use client";

import { useEffect, useRef } from "react";
import type { LSTask } from "@/lib/types";

/*
 * Isolated Label Studio document, loaded inside an iframe by the workspace.
 * Running it in its own document stops the Label Studio bundle's GLOBAL CSS
 * from leaking into the rest of the app. It talks to the host via postMessage.
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
      window.LabelStudio ? resolve(window.LabelStudio) : reject(new Error("global missing"));
    script.onerror = () => {
      loaderPromise = null;
      reject(new Error("load failed"));
    };
    document.body.appendChild(script);
  });
  return loaderPromise;
}

function serializeAnnotation(annotation: unknown): unknown {
  const a = annotation as { serializeAnnotation?: () => unknown };
  if (typeof a?.serializeAnnotation === "function") return { result: a.serializeAnnotation() };
  return annotation;
}

/* Restyle Label Studio's action bar to match the app's shadcn buttons. */
const LS_THEME = `
.lsf-topbar { border-bottom: 1px solid #e9e9ef !important; }
.lsf-controls { gap: 8px !important; padding: 8px 12px !important; }
.lsf-button {
  height: 34px !important;
  width: auto !important;
  min-width: 0 !important;
  padding: 0 16px !important;
  border-radius: 8px !important;
  font-size: 14px !important;
  font-weight: 500 !important;
  box-shadow: none !important;
  border: 1px solid transparent !important;
  text-transform: none !important;
  transition: background-color .15s ease, color .15s ease, border-color .15s ease !important;
}
.lsf-button_look_primary {
  background: #6366f1 !important;
  color: #fff !important;
}
.lsf-button_look_primary:hover { background: #5457e3 !important; }
.lsf-button_look_danger {
  background: transparent !important;
  color: #64748b !important;
  border-color: #e2e8f0 !important;
}
.lsf-button_look_danger:hover { background: #f1f5f9 !important; color: #0f172a !important; }
`;

function injectTheme() {
  if (document.getElementById("ls-theme")) return;
  const style = document.createElement("style");
  style.id = "ls-theme";
  style.textContent = LS_THEME;
  document.head.appendChild(style);
}

const INTERFACES = [
  "panel",
  "update",
  "submit",
  "skip",
  "controls",
  "topbar",
  "instruction",
  "side-column",
  "annotations:current",
];

export default function LabelerEmbed() {
  const rootRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<LSInstance | null>(null);

  useEffect(() => {
    const origin = window.location.origin;
    const post = (type: string, annotation?: unknown) =>
      window.parent.postMessage({ source: "ls-embed", type, annotation }, origin);

    function render(config: string, task: LSTask) {
      loadLabelStudio()
        .then((LabelStudioCtor) => {
          if (!rootRef.current) return;
          instanceRef.current?.destroy?.();
          rootRef.current.innerHTML = "";
          // Inject the theme BEFORE LS builds its DOM so the editor is full-width
          // from the start — otherwise Konva measures the cramped default width
          // and positions the image canvas off-screen.
          injectTheme();
          instanceRef.current = new LabelStudioCtor(rootRef.current, {
            config,
            task,
            interfaces: INTERFACES,
            user: { pk: 1, firstName: "Labeler" },
            onSubmitAnnotation: (_ls: unknown, a: unknown) => post("submit", serializeAnnotation(a)),
            onUpdateAnnotation: (_ls: unknown, a: unknown) => post("submit", serializeAnnotation(a)),
            onSkipTask: () => post("skip"),
          });
        })
        .catch(() => {
          if (rootRef.current) {
            rootRef.current.innerHTML =
              '<div style="padding:2rem;text-align:center;color:#888;font-family:sans-serif">Could not load the labeling canvas.</div>';
          }
        });
    }

    function onMessage(e: MessageEvent) {
      if (e.origin !== origin) return;
      const d = e.data;
      if (d?.source === "ls-host" && d.type === "render") render(d.config, d.task);
    }

    // Focus lives inside this iframe while labeling, so forward sample-nav keys
    // ([ and ]) up to the host — otherwise the parent never sees them.
    function onKeyDown(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "[") window.parent.postMessage({ source: "ls-embed", type: "nav", dir: -1 }, origin);
      else if (e.key === "]") window.parent.postMessage({ source: "ls-embed", type: "nav", dir: 1 }, origin);
    }

    window.addEventListener("message", onMessage);
    window.addEventListener("keydown", onKeyDown);
    post("ready");

    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("keydown", onKeyDown);
      instanceRef.current?.destroy?.();
      instanceRef.current = null;
    };
  }, []);

  return <div ref={rootRef} className="ls-root" style={{ height: "100vh", width: "100%" }} />;
}

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
/* The editor centers itself with \`margin: 0 auto\` and clamps to a fixed
   300px width under its max-width:760px breakpoint. Inside our iframe that
   leaves large dead margins either side of the canvas. Anchor it left and
   let it fill the available width. */
.ls-editor,
[class*="editor--"] {
  margin: 0 !important;
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  height: 100vh !important;
  max-height: 100vh !important;
  overflow: hidden !important;
  display: flex !important;
  flex-direction: column !important;
  flex-wrap: nowrap !important;
}

/* Force the content wrapper to take exactly the remaining height and not overflow vertically in desktop mode */
[class*="main-content-wrapper--"] {
  height: calc(100vh - 48px) !important;
  max-height: calc(100vh - 48px) !important;
  min-height: 0 !important;
  flex: 1 !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
}

/* Default side-by-side grid columns for canvas and sidebar (desktop mode) */
[class*="common--"]:not([class*="view-all--"]) {
  display: grid !important;
  grid-template-columns: 1fr 320px !important;
  grid-template-rows: 1fr !important;
  width: 100% !important;
  height: 100% !important;
  max-height: 100% !important;
  min-height: 0 !important;
  overflow: hidden !important;
}

/* Default sidebar styling (desktop mode) */
[class*="menu--"]:not(:empty) {
  margin: 0 !important;
  min-width: 320px !important;
  width: 320px !important;
  height: 100% !important;
  max-height: 100% !important;
  min-height: 0 !important;
}

/* Default canvas container styling (desktop mode) */
.lsf-main-view {
  height: 100% !important;
  max-height: 100% !important;
  min-height: 0 !important;
}

/* NARROW VIEWPORTS: Stack canvas and sidebar vertically */
@media (max-width: 768px) {
  body {
    overflow-y: auto !important;
  }

  .ls-editor,
  [class*="editor--"] {
    height: auto !important;
    max-height: none !important;
    overflow-y: auto !important;
  }
  
  [class*="main-content-wrapper--"] {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }

  [class*="common--"]:not([class*="view-all--"]) {
    display: flex !important;
    flex-direction: column !important;
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }

  /* Make canvas take full width and fit its content */
  .lsf-main-view {
    width: 100% !important;
    height: auto !important;
    max-height: none !important;
    min-height: 400px !important;
    min-width: 0 !important;
    flex: none !important;
  }

  /* Make sidebar take full width of the section and sit below the canvas */
  [class*="menu--"]:not(:empty) {
    width: 100% !important;
    min-width: 0 !important;
    height: auto !important;
    max-height: none !important;
    margin-top: 20px !important;
    margin-left: 0 !important;
    border-left: 0 !important;
    border-top: 1px solid rgba(0,0,0,.1) !important;
  }
}


.lsf-topbar {
  background-color: var(--card) !important;
  border-bottom: 1px solid var(--border) !important;
  width: 100% !important;
  min-width: 0 !important;
  box-sizing: border-box !important;
  color: var(--foreground) !important;
}
.lsf-topbar * {
  color: var(--foreground) !important;
}
.lsf-controls { gap: 8px !important; padding: 8px 12px !important; }
.lsf-controls .lsf-button {
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
.lsf-controls .lsf-button_look_primary {
  background: var(--primary) !important;
  color: var(--primary-foreground) !important;
}
.lsf-controls .lsf-button_look_primary:hover {
  background: color-mix(in oklch, var(--primary) 85%, black) !important;
}
.lsf-controls .lsf-button_look_danger,
.lsf-controls .lsf-button_look_normal {
  background: var(--secondary) !important;
  color: var(--secondary-foreground) !important;
  border: 1px solid var(--border) !important;
}
.lsf-controls .lsf-button_look_danger:hover,
.lsf-controls .lsf-button_look_normal:hover {
  background: var(--accent) !important;
  color: var(--accent-foreground) !important;
  border: 1px solid var(--border) !important;
}
.lsf-topbar button[aria-label="Settings"] { display: none !important; }

/* Custom variables inside Label Studio matching our tailwind theme */
.ls-editor,
[class*="editor--"] {
  background-color: var(--background) !important;
  color: var(--foreground) !important;
}

.lsf-main-view {
  background-color: var(--background) !important;
}

/* Sidebar and lists */
html.dark .ls-root [class*="menu--"],
html.unicorn .ls-root [class*="menu--"] {
  background-color: var(--card) !important;
  border-left: 1px solid var(--border) !important;
  color: var(--foreground) !important;
}
html.dark .ls-root [class*="menu--"] *,
html.unicorn .ls-root [class*="menu--"] * {
  border-color: var(--border) !important;
}

html.dark .ls-root .lsf-sidepanel,
html.unicorn .ls-root .lsf-sidepanel,
html.dark .ls-root .lsf-panel,
html.unicorn .ls-root .lsf-panel,
html.dark .ls-root .lsf-region-item,
html.unicorn .ls-root .lsf-region-item,
html.dark .ls-root .lsf-history,
html.unicorn .ls-root .lsf-history,
html.dark .ls-root .lsf-annotations,
html.unicorn .ls-root .lsf-annotations,
html.dark .ls-root .lsf-sidebar,
html.unicorn .ls-root .lsf-sidebar,
html.dark .ls-root .lsf-empty-state,
html.unicorn .ls-root .lsf-empty-state {
  background-color: var(--card) !important;
  color: var(--foreground) !important;
}

html.dark .ls-root .lsf-region-item_selected,
html.unicorn .ls-root .lsf-region-item_selected {
  background-color: var(--accent) !important;
  color: var(--accent-foreground) !important;
}

html.dark .ls-root .lsf-labels,
html.unicorn .ls-root .lsf-labels {
  background-color: var(--card) !important;
  border-top: 1px solid var(--border) !important;
}

html.dark .ls-root .lsf-toolbar,
html.unicorn .ls-root .lsf-toolbar,
html.dark .ls-root [class*="toolbar--"],
html.unicorn .ls-root [class*="toolbar--"] {
  background-color: var(--card) !important;
  border: 1px solid var(--border) !important;
  color: var(--foreground) !important;
}
html.dark .ls-root .lsf-toolbar *,
html.unicorn .ls-root .lsf-toolbar *,
html.dark .ls-root [class*="toolbar--"] *,
html.unicorn .ls-root [class*="toolbar--"] * {
  color: var(--foreground) !important;
  border-color: var(--border) !important;
}

/* Ant Design (antd) component theme overrides inside the iframe */
html.dark .ls-root .ant-tabs,
html.unicorn .ls-root .ant-tabs,
html.dark .ls-root .ant-tabs-nav,
html.unicorn .ls-root .ant-tabs-nav,
html.dark .ls-root .ant-tabs-tab,
html.unicorn .ls-root .ant-tabs-tab,
html.dark .ls-root .ant-tabs-content,
html.unicorn .ls-root .ant-tabs-content,
html.dark .ls-root .ant-tabs-tabpane,
html.unicorn .ls-root .ant-tabs-tabpane,
html.dark .ls-root .ant-tabs-content-holder,
html.unicorn .ls-root .ant-tabs-content-holder,
html.dark .ls-root .ant-card,
html.unicorn .ls-root .ant-card,
html.dark .ls-root .ant-card-body,
html.unicorn .ls-root .ant-card-body,
html.dark .ls-root .ant-list,
html.unicorn .ls-root .ant-list,
html.dark .ls-root .ant-list-item,
html.unicorn .ls-root .ant-list-item {
  background-color: transparent !important;
  background: transparent !important;
  border-color: var(--border) !important;
  color: var(--foreground) !important;
}

html.dark .ls-root .ant-tabs-tab-btn,
html.unicorn .ls-root .ant-tabs-tab-btn {
  color: var(--muted-foreground) !important;
}
html.dark .ls-root .ant-tabs-tab-active .ant-tabs-tab-btn,
html.unicorn .ls-root .ant-tabs-tab-active .ant-tabs-tab-btn {
  color: var(--primary) !important;
}

html.dark .ls-root .ant-checkbox-wrapper,
html.unicorn .ls-root .ant-checkbox-wrapper {
  color: var(--foreground) !important;
}

/* Label badges / choice buttons */
html.dark .ls-root .lsf-label,
html.unicorn .ls-root .lsf-label,
html.dark .ls-root .lsf-choice,
html.unicorn .ls-root .lsf-choice {
  background-color: var(--secondary);
  border-color: var(--border);
}
html.dark .ls-root .lsf-label__text,
html.dark .ls-root .lsf-label__number,
html.unicorn .ls-root .lsf-label__text,
html.unicorn .ls-root .lsf-label__number {
  color: #ffffff !important;
}
html.dark .ls-root .lsf-choice_selected,
html.unicorn .ls-root .lsf-choice_selected {
  background-color: var(--primary) !important;
  color: var(--primary-foreground) !important;
}

/* Unicorn theme decorative primary button elements */
.unicorn .lsf-controls .lsf-button_look_primary {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px !important;
}
.unicorn .lsf-controls .lsf-button_look_primary::after {
  content: "🦄" !important;
  position: static !important;
  font-size: 16px !important;
  display: inline-block !important;
  pointer-events: none !important;
  animation: unicorn-float 6s ease-in-out infinite !important;
  transform-origin: center !important;
}
@keyframes unicorn-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}
@media (prefers-reduced-motion: reduce) {
  .unicorn .lsf-controls .lsf-button_look_primary::after {
    animation: none !important;
  }
}

/* Force the Label Studio editor container to fill the viewport and override any default mobile max-width/margins and column wrapping */
.ls-root .ls-editor,
.ls-root [class*="editor--"] {
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 !important;
  flex-wrap: nowrap !important;
}
`;

function injectTheme() {
  let style = document.getElementById("ls-theme");
  if (!style) {
    style = document.createElement("style");
    style.id = "ls-theme";
    style.textContent = LS_THEME;
  }
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

    function onError(e: ErrorEvent) {
      post("error", e.message);
    }
    function onUnhandledRejection(e: PromiseRejectionEvent) {
      post("error", e.reason?.message || String(e.reason));
    }
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    function setTheme(theme: string) {
      const el = document.documentElement;
      el.classList.remove("light", "dark", "unicorn");
      if (theme) el.classList.add(theme);
    }

    // Set the initial theme from query parameters on mount to avoid race conditions
    const params = new URLSearchParams(window.location.search);
    const initialTheme = params.get("theme");
    if (initialTheme) {
      setTheme(initialTheme);
    }

    // Reset body layout inside the iframe to prevent Next.js root layout flex rules
    // from causing alignment offsets in the Label Studio canvas.
    document.body.className = "bg-background text-foreground";
    document.body.style.display = "block";
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.overflow = "hidden";
    document.body.style.width = "100vw";
    document.body.style.height = "100vh";

    // Inject the theme stylesheet on mount so it is active before Label Studio builds its DOM
    injectTheme();

    function render(config: string, task: LSTask) {
      loadLabelStudio()
        .then((LabelStudioCtor) => {
          if (!rootRef.current) return;
          instanceRef.current?.destroy?.();
          rootRef.current.innerHTML = "";
          instanceRef.current = new LabelStudioCtor(rootRef.current, {
            config,
            task,
            interfaces: INTERFACES,
            user: { pk: 1, firstName: "Labeler" },
            onSubmitAnnotation: (_ls: unknown, a: unknown) => post("submit", serializeAnnotation(a)),
            onUpdateAnnotation: (_ls: unknown, a: unknown) => post("submit", serializeAnnotation(a)),
            onSkipTask: () => post("skip"),
          });
          injectTheme();
        })
        .catch((e) => {
          post("error", e.message || "Failed to load Label Studio bundles");
          if (rootRef.current) {
            rootRef.current.innerHTML =
              '<div style="padding:2rem;text-align:center;color:#888;font-family:sans-serif">Could not load the labeling canvas.</div>';
          }
        });
    }

    function onMessage(e: MessageEvent) {
      if (e.origin !== origin) return;
      const d = e.data;
      if (d?.source === "ls-host") {
        if (d.type === "render") {
          if (d.theme) setTheme(d.theme);
          render(d.config, d.task);
        } else if (d.type === "theme") {
          setTheme(d.theme);
        }
      }
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
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      instanceRef.current?.destroy?.();
      instanceRef.current = null;
    };
  }, []);

  return <div ref={rootRef} className="ls-root" style={{ height: "100vh", width: "100%" }} />;
}

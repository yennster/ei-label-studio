"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

const RAINBOW = [
  "oklch(0.66 0.24 350)",
  "oklch(0.72 0.19 30)",
  "oklch(0.82 0.16 90)",
  "oklch(0.74 0.16 160)",
  "oklch(0.62 0.2 285)",
];

/** Inline SVG rainbow arc with a little cloud + twinkling sparkles. */
function RainbowMark({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 120 96"
      className={className}
      style={style}
      role="img"
      aria-label="Rainbow and sparkles"
      fill="none"
    >
      {/* rainbow arcs */}
      {RAINBOW.map((color, i) => (
        <path
          key={color}
          d={`M ${14 + i * 7} 82 A ${46 - i * 7} ${46 - i * 7} 0 0 1 ${106 - i * 7} 82`}
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
        />
      ))}
      {/* clouds at the rainbow feet */}
      <g fill="oklch(0.99 0.01 340)">
        <ellipse cx="16" cy="84" rx="15" ry="9" />
        <ellipse cx="104" cy="84" rx="15" ry="9" />
      </g>
      {/* sparkles */}
      <g fill="oklch(0.7 0.22 350)">
        <path
          className="unicorn-sparkle"
          style={{ animationDelay: "0s" }}
          d="M60 6 L62.4 12 L68 14 L62.4 16 L60 22 L57.6 16 L52 14 L57.6 12 Z"
        />
        <path
          className="unicorn-sparkle"
          style={{ animationDelay: "0.9s" }}
          d="M98 22 L99.4 26 L103 27 L99.4 28 L98 32 L96.6 28 L93 27 L96.6 26 Z"
        />
        <path
          className="unicorn-sparkle"
          style={{ animationDelay: "1.6s" }}
          d="M22 26 L23.4 30 L27 31 L23.4 32 L22 36 L20.6 32 L17 31 L20.6 30 Z"
        />
      </g>
    </svg>
  );
}

/**
 * Decorative unicorn/rainbow flourish for the landing hero.
 * Renders nothing unless the active theme is "unicorn".
 */
export function UnicornHero({ className }: { className?: string }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || resolvedTheme !== "unicorn") return null;

  return (
    <div
      className={`pointer-events-none select-none ${className ?? ""}`}
      aria-hidden="true"
    >
      <div className="flex items-center gap-2">
        <RainbowMark className="h-12 w-auto" />
        <span className="text-2xl" role="img" aria-label="unicorn">
          🦄
        </span>
        <span className="text-xl" role="img" aria-label="rainbow">
          🌈
        </span>
      </div>
    </div>
  );
}

/**
 * Ambient unicorn flair for the labeling workspace.
 *
 * Self-gates: renders nothing unless the path is exactly "/label" AND the
 * active theme is "unicorn", so it is harmless to mount globally. The overlay
 * is a fixed, pointer-events-none, aria-hidden layer that tucks a few softly
 * floating rainbows/sparkles into the corners and lays a subtle rainbow glow
 * along the top edge — never covering the working area or blocking clicks.
 */
export function WorkspaceUnicornDecor() {
  const { resolvedTheme } = useTheme();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || pathname !== "/label" || resolvedTheme !== "unicorn") {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40 select-none overflow-hidden"
      aria-hidden="true"
    >
      {/* Soft rainbow glow washing down from the top edge. */}
      <div
        className="absolute inset-x-0 top-0 h-40"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in oklch, var(--primary) 16%, transparent), transparent 90%)",
        }}
      />

      {/* Top-left rainbow, gently floating. */}
      <RainbowMark
        className="unicorn-float absolute -left-3 top-1 h-12 w-auto opacity-25"
        style={{ animationDelay: "0s" }}
      />

      {/* Bottom-right rainbow, slightly larger, drifting on its own beat. */}
      <RainbowMark
        className="unicorn-float absolute -right-4 bottom-6 h-20 w-auto opacity-20"
        style={{ animationDelay: "1.4s" }}
      />

      {/* An emoji friend bobbing at the bottom-left corner. */}
      <span
        className="unicorn-float absolute bottom-24 left-5 text-2xl opacity-25"
        style={{ animationDelay: "2.1s" }}
        role="img"
        aria-label="rainbow"
      >
        🌈
      </span>
    </div>
  );
}

export default UnicornHero;

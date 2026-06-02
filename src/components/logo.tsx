import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn("size-7", className)} aria-hidden>
      <defs>
        <linearGradient id="lm" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="oklch(0.66 0.2 275)" />
          <stop offset="1" stopColor="oklch(0.72 0.15 200)" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="29" height="29" rx="8" stroke="url(#lm)" strokeWidth="1.6" />
      {/* signal → label: a waveform resolving into a tag */}
      <path
        d="M6 19c2-0 2.4-7 4-7s1.8 9 3.4 9 1.8-5 3.2-5"
        stroke="url(#lm)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="22.5" cy="13" r="3.4" fill="url(#lm)" />
      <circle cx="22.5" cy="13" r="1.2" className="fill-background" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span className="text-[15px]">
        EI<span className="text-muted-foreground"> · </span>Label Studio
      </span>
    </span>
  );
}

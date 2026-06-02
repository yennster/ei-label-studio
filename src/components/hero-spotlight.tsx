"use client";

import { useEffect, useRef } from "react";

/**
 * Ambient, velocity-reactive mouse spotlight for the landing hero.
 *
 * A single GPU-composited glow element eases after the cursor and — the faster
 * the pointer travels — stretches into an oblong oriented along the direction
 * of motion, then relaxes back to a circle as you slow. One requestAnimationFrame
 * loop lerps both position and stretch every frame, so the glow trails the
 * pointer with an ambient lag rather than snapping. The transform is the only
 * thing mutated (translate + rotate + scale), keeping it on its own compositor
 * layer; colour/theme live in `.hero-spotlight-glow` (globals.css).
 *
 * Reduced motion: the glow is sized and parked centre-top, with no loop.
 */
export function HeroSpotlight() {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const glow = glowRef.current;
    const layer = glow?.parentElement ?? null; // .hero-spotlight (absolute inset-0)
    const hero = layer?.parentElement ?? null; // the hero <section>
    if (!glow || !layer || !hero) return;

    // Size the glow from the hero box and centre it on the layer's origin via
    // negative margins, so translate() places its centre directly on the cursor.
    const sizeGlow = () => {
      const r = hero.getBoundingClientRect();
      const size = Math.min(Math.max(Math.max(r.width, r.height) * 0.7, 400), 1000);
      const half = size / 2;
      glow.style.width = `${size}px`;
      glow.style.height = `${size}px`;
      glow.style.marginLeft = `${-half}px`;
      glow.style.marginTop = `${-half}px`;
    };
    sizeGlow();

    // Resting spot: horizontally centred, near the top — reads as the ambient
    // top glow of `.hero-grid` before the cursor moves.
    const restX = () => hero.clientWidth / 2;
    const restY = () => hero.clientHeight * 0.05;

    let curX = restX();
    let curY = restY();
    let tgtX = curX;
    let tgtY = curY;
    let prevX = curX;
    let prevY = curY;
    let stretch = 0; // eased magnitude, 0..MAX_STRETCH
    // Long-axis orientation, kept as a smoothed unit-ish vector rather than an
    // accumulating angle (which winds up unbounded and drifts off-axis). The
    // bounded `angle` is read back from it each frame.
    let dirX = 1;
    let dirY = 0;
    let angle = 0;

    const writeTransform = () => {
      const sx = 1 + stretch; // elongate along the motion axis
      const sy = 1 - stretch * 0.38; // squash perpendicular for a comet feel
      glow.style.transform = `translate(${curX}px, ${curY}px) rotate(${angle}rad) scale(${sx}, ${sy})`;
    };

    writeTransform();

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      const onResizeStatic = () => {
        sizeGlow();
        curX = restX();
        curY = restY();
        writeTransform();
      };
      window.addEventListener("resize", onResizeStatic);
      return () => window.removeEventListener("resize", onResizeStatic);
    }

    // Tuning.
    const EASE_POS = 0.16; // position lerp — lower trails more (more "fluid")
    const SPEED_REF = 52; // px/frame of eased motion that maps to full stretch
    const MAX_STRETCH = 0.8;
    const RISE = 0.22; // stretch grows quickly on a fast flick…
    const FALL = 0.09; // …and relaxes slowly back to a circle
    const ANGLE_EASE = 0.35; // how fast the long axis swings toward travel
    const ANGLE_GATE = 2.4; // px/frame of motion before we re-aim the long axis

    let raf = 0;
    let idle = 0;

    const tick = () => {
      curX += (tgtX - curX) * EASE_POS;
      curY += (tgtY - curY) * EASE_POS;

      const vx = curX - prevX;
      const vy = curY - prevY;
      const speed = Math.hypot(vx, vy);
      prevX = curX;
      prevY = curY;

      // Re-aim toward travel only on deliberate motion. Smooth the direction as
      // a vector and align it to the current axis first (the ellipse is
      // symmetric under a half-turn) so reversing course never swings a full
      // 180° and normal hand jitter doesn't make it wobble.
      if (speed > ANGLE_GATE) {
        let nx = vx / speed;
        let ny = vy / speed;
        if (nx * dirX + ny * dirY < 0) {
          nx = -nx;
          ny = -ny;
        }
        dirX += (nx - dirX) * ANGLE_EASE;
        dirY += (ny - dirY) * ANGLE_EASE;
        angle = Math.atan2(dirY, dirX); // bounded [-π, π] — never winds up
      }

      // Quadratic speed→stretch: stays round through gentle/normal movement and
      // only elongates into an oblong when you genuinely move fast.
      const t = Math.min(speed / SPEED_REF, 1);
      const targetStretch = t * t * MAX_STRETCH;
      stretch += (targetStretch - stretch) * (targetStretch > stretch ? RISE : FALL);

      writeTransform();

      // Park the loop once everything has settled; pointer input restarts it.
      const settled =
        Math.abs(tgtX - curX) < 0.4 &&
        Math.abs(tgtY - curY) < 0.4 &&
        stretch < 0.004 &&
        speed < 0.4;
      idle = settled ? idle + 1 : 0;
      if (idle > 6) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const run = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      const r = hero.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      tgtX = e.clientX - r.left;
      tgtY = e.clientY - r.top;
      run();
    };
    const onResize = () => sizeGlow();

    // No pointerleave handler: when the cursor leaves the hero the glow simply
    // relaxes to a circle and rests where it was, rather than sweeping back
    // across the screen — which read as "weird" when crossing an edge.
    hero.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      hero.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="hero-spotlight pointer-events-none absolute inset-0" aria-hidden="true">
      <div ref={glowRef} className="hero-spotlight-glow" />
    </div>
  );
}

export default HeroSpotlight;

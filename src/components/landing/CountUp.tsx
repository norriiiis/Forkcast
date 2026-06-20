"use client";

import { useEffect, useRef } from "react";

// Counts a number up from 0 to `value` when it scrolls into view. Renders the
// final value on the server (correct for no-JS / crawlers / reduced motion), then
// animates the text node directly on the client — no React state, no re-renders.
export default function CountUp({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1400,
  className = "",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) return;

    const fmt = (n: number) => `${prefix}${n.toFixed(decimals)}${suffix}`;
    el.textContent = fmt(0);

    let raf = 0;
    let started = false;
    const animate = (t0: number) => {
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(value * eased);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !started) {
            started = true;
            animate(performance.now());
            io.disconnect();
          }
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [value, prefix, suffix, decimals, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}

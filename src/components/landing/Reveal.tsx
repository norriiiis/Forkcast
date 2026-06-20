"use client";

import { useEffect, useRef } from "react";

type Variant = "up" | "left" | "right" | "scale" | "blur";

// Scroll reveal driven by IntersectionObserver — works in every browser (unlike
// CSS scroll-driven animation, which Safari/Firefox lag on). Content is visible
// by default; the data-js boot attribute (set in layout.tsx) arms the hidden
// start state before paint, and this adds [data-shown] via the DOM when it enters
// view. Reduced motion is handled entirely in CSS. No React state, no re-renders.
export default function Reveal({
  children,
  variant = "up",
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  variant?: Variant;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      el.setAttribute("data-shown", "");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.setAttribute("data-shown", "");
            io.disconnect();
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal={variant}
      className={className}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

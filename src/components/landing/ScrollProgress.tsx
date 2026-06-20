"use client";

import { useEffect, useState } from "react";

// A thin reading-progress bar pinned to the top of the page.
export default function ScrollProgress() {
  const [p, setP] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setP(max > 0 ? Math.min(1, h.scrollTop / max) : 0);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <div className="scroll-progress" style={{ ["--p" as string]: p }} aria-hidden />;
}

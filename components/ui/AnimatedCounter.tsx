"use client";

import { useEffect, useRef, useState } from "react";

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export default function AnimatedCounter({
  value,
  duration = 1200,
  format,
  className,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    if (!Number.isFinite(value)) return;
    startRef.current = null;
    fromRef.current = display;
    let frame: number;

    const tick = (ts: number) => {
      if (startRef.current == null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(1, elapsed / duration);
      const next = fromRef.current + (value - fromRef.current) * easeOutCubic(progress);
      setDisplay(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  const text = format ? format(display) : Math.round(display).toLocaleString();
  return <span className={className}>{text}</span>;
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isInViewport(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight;
  return rect.bottom > 0 && rect.top < vh;
}

export default function ScrollReveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => prefersReducedMotion());

  useEffect(() => {
    if (prefersReducedMotion()) {
      setVisible(true);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const reveal = () => setVisible(true);

    if (isInViewport(el)) {
      reveal();
      return;
    }

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          reveal();
          obs.disconnect();
        }
      },
      { threshold: 0.01, rootMargin: "0px 0px 8% 0px" }
    );
    obs.observe(el);

    const fallback = window.setTimeout(() => {
      reveal();
      obs.disconnect();
    }, 1500);

    return () => {
      obs.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`scroll-reveal ${visible ? "scroll-reveal-visible" : ""} ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : undefined }}
    >
      {children}
    </div>
  );
}

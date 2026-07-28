"use client";

import type { ReactNode } from "react";

type BrandHeroBannerProps = {
  imageSrc: string;
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  children?: ReactNode;
  className?: string;
  minHeight?: string;
};

/** Paylane-style hero band with full-bleed illustration + gradient overlay. */
export default function BrandHeroBanner({
  imageSrc,
  eyebrow,
  title,
  subtitle,
  children,
  className = "",
  minHeight = "min-h-[280px]",
}: BrandHeroBannerProps) {
  return (
    <div className={`brand-hero-wrap ${minHeight} ${className}`.trim()}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageSrc} alt="" className="brand-hero-img" />
      <div className="brand-hero-overlay" aria-hidden />
      <div className="lane-rail absolute bottom-0 left-0 right-0 h-1 z-[2]" aria-hidden />
      <div className="brand-hero-body flex flex-col justify-end h-full animate-rise">
        {eyebrow && (
          <span className="inline-flex w-fit items-center rounded-full badge-brand px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide mb-3">
            {eyebrow}
          </span>
        )}
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[var(--ink)] tracking-tight leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-[15px] text-[var(--ink-muted)] leading-relaxed max-w-xl">
            {subtitle}
          </p>
        )}
        {children && <div className="mt-5 flex flex-wrap gap-2.5">{children}</div>}
      </div>
    </div>
  );
}

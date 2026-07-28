"use client";

import Link from "next/link";

type BrandModeCardProps = {
  imageSrc: string;
  badge: string;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
};

/** Paylane-style feature card with top illustration. */
export default function BrandModeCard({
  imageSrc,
  badge,
  title,
  description,
  href,
  onClick,
}: BrandModeCardProps) {
  const inner = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageSrc} alt="" />
      <div className="p-5">
        <span className="inline-flex rounded-full badge-brand px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
          {badge}
        </span>
        <h3 className="font-display text-lg font-semibold text-[var(--ink)] mt-2">{title}</h3>
        <p className="text-sm text-[var(--ink-muted)] mt-2 leading-relaxed">{description}</p>
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="brand-mode-card block">
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className="brand-mode-card block w-full text-left">
      {inner}
    </button>
  );
}

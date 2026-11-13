/**
 * Quiet hero backdrop: faint dot grid that fades out toward the edges plus one soft
 * brand-blue glow. Purely decorative, no animation, no pointer events.
 */
export default function HeroBackdrop({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div className="hero-dot-grid absolute inset-0" />
      <div className="absolute -top-24 left-1/4 h-64 w-[36rem] max-w-full rounded-full bg-[var(--brand)] opacity-[0.10] blur-3xl" />
    </div>
  );
}

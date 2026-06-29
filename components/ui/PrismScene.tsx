"use client";

/** Lightweight CSS-only 3D ambient scene — no WebGL, mobile-friendly */
export default function PrismScene({ dense = false }: { dense?: boolean }) {
  const orbs = dense ? 8 : 5;

  return (
    <div className="prism-scene pointer-events-none" aria-hidden>
      <div className="prism-ring prism-ring-1" />
      <div className="prism-ring prism-ring-2" />
      <div className="prism-ring prism-ring-3" />

      {Array.from({ length: orbs }).map((_, i) => (
        <span
          key={i}
          className={`prism-orb prism-orb-${(i % 4) + 1}`}
          style={{
            left: `${8 + ((i * 17) % 78)}%`,
            top: `${12 + ((i * 23) % 72)}%`,
            animationDelay: `${i * 0.7}s`,
          }}
        />
      ))}

      <div className="prism-holo-card">
        <div className="prism-holo-card-inner" />
      </div>
    </div>
  );
}

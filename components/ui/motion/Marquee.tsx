import type { ReactNode } from "react";

/**
 * Infinite horizontal ticker tape (pure CSS). Pauses on hover/focus, fades at the edges,
 * and becomes a plain scrollable row when the user prefers reduced motion.
 */
export default function Marquee({
  children,
  className = "",
  durationSec = 40,
  label,
}: {
  children: ReactNode;
  className?: string;
  durationSec?: number;
  label: string;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      className={`marquee group relative overflow-hidden ${className}`}
      style={{ ["--marquee-duration" as string]: `${durationSec}s` }}
    >
      <div className="marquee-track flex w-max gap-3">
        <div className="flex shrink-0 gap-3">{children}</div>
        <div className="flex shrink-0 gap-3" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}

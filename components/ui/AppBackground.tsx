"use client";

/**
 * Full-bleed “blue hour” atmosphere (Refero Styles / Mercury-adjacent).
 * Layered mesh + soft grid; components sit above via z-index.
 */
export default function AppBackground() {
  return (
    <div className="app-atmosphere" aria-hidden>
      <div className="app-atmosphere__grid" />
      <div className="app-atmosphere__orb app-atmosphere__orb--a" />
      <div className="app-atmosphere__orb app-atmosphere__orb--b" />
      <div className="app-atmosphere__orb app-atmosphere__orb--c" />
    </div>
  );
}

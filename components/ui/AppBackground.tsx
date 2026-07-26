"use client";

export default function AppBackground() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{ background: "var(--bg-deep)" }}
    />
  );
}

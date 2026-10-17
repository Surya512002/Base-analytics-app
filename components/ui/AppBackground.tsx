"use client";

export default function AppBackground() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* Subtle top Base Blue ambient lighting — restrained and non-intrusive */}
      <div className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[1100px] h-[500px] bg-[radial-gradient(ellipse_at_top,rgba(0,82,255,0.06)_0%,transparent_70%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(0,82,255,0.08)_0%,transparent_70%)]" />

      {/* Crisp technical dot grid texture for professional depth */}
      <div className="absolute inset-0 bg-[radial-gradient(rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:32px_32px] opacity-60 dark:opacity-40" />
    </div>
  );
}

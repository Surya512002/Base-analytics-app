"use client";

import PrismScene from "@/components/ui/PrismScene";

export default function AppBackground() {
  return (
    <>
      <div className="fixed inset-0 pointer-events-none bg-aurora app-bg-layer" />
      <PrismScene />
      <div
        className="fixed inset-0 pointer-events-none app-bg-layer"
        style={{
          background:
            "radial-gradient(ellipse 90% 55% at 50% -5%, rgba(139,92,246,0.12) 0%, transparent 58%)",
        }}
      />
      <div className="fixed inset-0 pointer-events-none bg-grid-future opacity-35 app-bg-layer" />
      <div
        className="app-bg-blob fixed top-0 right-0 w-[min(90vw,700px)] h-[500px] rounded-full blur-[120px] pointer-events-none animate-pulse-glow"
        style={{
          background:
            "radial-gradient(circle, rgba(46,232,255,0.22) 0%, transparent 65%)",
        }}
      />
      <div
        className="app-bg-blob fixed bottom-0 left-0 w-[min(80vw,550px)] h-[450px] rounded-full blur-[110px] pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(255,61,110,0.18) 0%, transparent 65%)",
        }}
      />
      <div
        className="app-bg-blob fixed top-1/2 left-1/3 w-96 h-72 rounded-full blur-[100px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse, rgba(139,92,246,0.16) 0%, transparent 70%)",
        }}
      />
    </>
  );
}

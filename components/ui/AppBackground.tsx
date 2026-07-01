"use client";

export default function AppBackground() {
  return (
    <>
      <div className="fixed inset-0 pointer-events-none bg-aurora app-bg-layer" />
      <div className="fixed inset-0 pointer-events-none bg-grid-terminal opacity-50 app-bg-layer" />
      <div className="fixed inset-0 pointer-events-none bg-grid-future opacity-25 app-bg-layer" />
      <div
        className="app-bg-blob fixed top-0 right-0 w-[min(90vw,600px)] h-[400px] rounded-full blur-[100px] pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(34,197,94,0.12) 0%, transparent 65%)",
        }}
      />
      <div
        className="app-bg-blob fixed bottom-0 left-0 w-[min(80vw,500px)] h-[350px] rounded-full blur-[90px] pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 65%)",
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none app-bg-layer"
        style={{
          background:
            "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(56,189,248,0.06) 0%, transparent 55%)",
        }}
      />
    </>
  );
}

"use client";

export default function AppBackground() {
  return (
    <>
      <div className="fixed inset-0 pointer-events-none bg-aurora" />
      <div className="fixed inset-0 pointer-events-none bg-grid-future opacity-30" />
      <div
        className="fixed top-0 right-0 w-[min(90vw,700px)] h-[500px] rounded-full blur-[120px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(0,229,255,0.18) 0%, transparent 65%)" }}
      />
      <div
        className="fixed bottom-0 left-0 w-[min(80vw,550px)] h-[450px] rounded-full blur-[110px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,51,102,0.14) 0%, transparent 65%)" }}
      />
      <div
        className="fixed top-1/2 left-1/3 w-80 h-64 rounded-full blur-[90px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(0,82,255,0.12) 0%, transparent 70%)" }}
      />
    </>
  );
}

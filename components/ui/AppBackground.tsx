"use client";

export default function AppBackground() {
  return (
    <>
      <div className="fixed inset-0 pointer-events-none bg-aurora" />
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 90% 55% at 50% -5%, rgba(61,123,255,0.14) 0%, transparent 58%)",
        }}
      />
      <div className="fixed inset-0 pointer-events-none bg-grid-future opacity-40" />
      <div
        className="fixed top-0 right-0 w-[min(90vw,700px)] h-[500px] rounded-full blur-[120px] pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(0,229,255,0.26) 0%, transparent 65%)",
        }}
      />
      <div
        className="fixed bottom-0 left-0 w-[min(80vw,550px)] h-[450px] rounded-full blur-[110px] pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(255,77,122,0.2) 0%, transparent 65%)",
        }}
      />
      <div
        className="fixed top-1/2 left-1/3 w-96 h-72 rounded-full blur-[100px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse, rgba(61,123,255,0.18) 0%, transparent 70%)",
        }}
      />
    </>
  );
}

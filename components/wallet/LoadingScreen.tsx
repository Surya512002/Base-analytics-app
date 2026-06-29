import AppLogo from "@/components/ui/AppLogo";

export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#040a14] flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-aurora pointer-events-none" />
      <div className="absolute inset-0 bg-grid-future opacity-25 pointer-events-none" />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full blur-[90px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(0,229,255,0.2) 0%, transparent 70%)" }}
      />
      <div className="relative text-center space-y-5">
        <div className="relative w-20 h-20 mx-auto">
          <AppLogo size="xl" className="mx-auto" />
          <div className="absolute inset-0 rounded-3xl border-2 border-violet-400/30 animate-ping" />
        </div>
        <div>
          <p className="text-white font-black text-xl tracking-tight">
            BASE<span className="text-gradient-cyan">.</span>ANALYTICS
          </p>
          <p className="text-slate-400 font-mono text-[10px] tracking-[0.4em] uppercase mt-2 animate-pulse-glow">
            Initializing onchain...
          </p>
        </div>
      </div>
    </div>
  );
}

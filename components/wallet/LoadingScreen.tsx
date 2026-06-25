import { Hexagon } from "lucide-react";

export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
      <div className="text-center space-y-5">
        <div className="relative w-20 h-20 mx-auto">
          <div className="w-20 h-20 rounded-3xl bg-linear-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-2xl shadow-blue-600/60">
            <Hexagon size={36} className="text-white" />
          </div>
          <div className="absolute inset-0 rounded-3xl border-2 border-blue-400/30 animate-ping" />
        </div>
        <div>
          <p className="text-white font-black text-xl tracking-tight">
            BASE<span className="text-blue-400">.</span>ANALYTICS
          </p>
          <p className="text-blue-400/60 font-mono text-[10px] tracking-[0.4em] uppercase mt-1">
            Initializing...
          </p>
        </div>
      </div>
    </div>
  );
}

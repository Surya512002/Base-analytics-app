import Link from "next/link";
import AppLogo from "@/components/ui/AppLogo";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#071220] flex flex-col items-center justify-center p-6 text-center text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-aurora pointer-events-none" />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-[100px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(0,229,255,0.15) 0%, transparent 70%)" }}
      />

      <AppLogo size="xl" className="mb-8 z-10" />

      <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tighter z-10">
        404 <span className="text-gradient-cyan">|</span> NOT FOUND
      </h2>

      <p className="text-slate-400 mb-10 font-medium text-lg z-10 max-w-md">
        This page doesn&apos;t exist or has moved offchain.
      </p>

      <Link href="/" className="px-8 py-4 btn-primary rounded-full font-black text-lg z-10">
        Return to Base Analytics
      </Link>
    </div>
  );
}

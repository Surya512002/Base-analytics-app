import VoucherGiftCard3D from "@/components/wallet/VoucherGiftCard3D";
import AppLogo from "@/components/ui/AppLogo";

export default function VoucherHero() {
  return (
    <div className="relative overflow-hidden glass-panel rounded-3xl border border-cyan-500/20 shadow-xl shadow-black/30">
      <div className="h-0.5 bg-linear-to-r from-rose-500 via-cyan-400 to-blue-600" />
      <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative grid lg:grid-cols-2 gap-8 lg:gap-10 p-6 sm:p-8 items-center">
        <div className="text-center lg:text-left">
          <p className="text-2xl sm:text-3xl font-black text-white leading-tight">Decentralized</p>
          <h2 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-black leading-[1.1] mt-1">
            <span className="text-gradient-blue">Crypto Gift Cards</span>
          </h2>
          <p className="text-xl sm:text-2xl font-black text-white mt-3">
            For anyone,{" "}
            <span className="relative inline-block">
              anywhere!
              <span className="absolute -bottom-1 left-0 right-0 h-1 bg-linear-to-r from-cyan-400 to-blue-500 rounded-full opacity-80" />
            </span>
          </p>
          <p className="text-sm sm:text-base text-slate-400 font-medium leading-relaxed mt-5 max-w-md mx-auto lg:mx-0">
            The world&apos;s first decentralized tangible crypto gift card protocol.
            Create and redeem crypto gift cards on{" "}
            <span className="text-cyan-400 font-bold">Base</span> — ETH & USDC only.
          </p>

          <div className="mt-6 inline-flex items-center gap-2.5 glass-panel-accent rounded-full px-4 py-2.5">
            <AppLogo size="sm" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">
              Built on Base
            </span>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end py-4 lg:py-0">
          <VoucherGiftCard3D asset="USDC" showStack />
        </div>
      </div>
    </div>
  );
}

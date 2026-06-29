"use client";

import type { WalletData } from "@/lib/types/wallet";
import { Coins, Layers, Palette, Wallet } from "lucide-react";

interface PortfolioStripProps {
  wallet: WalletData;
}

export default function PortfolioStrip({ wallet }: PortfolioStripProps) {
  const items = [
    {
      icon: <Wallet size={16} className="text-champagne" />,
      label: "Portfolio",
      value: wallet.portfolioValueUSD > 0 ? `$${wallet.portfolioValueUSD.toFixed(0)}` : "—",
    },
    {
      icon: <Coins size={16} className="text-emerald-400" />,
      label: "ETH vol",
      value: `${parseFloat(wallet.ethVolume).toFixed(3)}`,
    },
    {
      icon: <Palette size={16} className="text-violet-400" />,
      label: "NFTs",
      value: String(wallet.nftCount),
    },
    {
      icon: <Layers size={16} className="text-cyan-400" />,
      label: "Protocols",
      value: String(wallet.uniqueProtocols),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="elegant-panel rounded-2xl p-3 border border-white/8 card-tilt-3d"
        >
          <div className="flex items-center gap-2 mb-1">{item.icon}</div>
          <p className="text-lg font-black text-white leading-none">{item.value}</p>
          <p className="text-[9px] text-slate-500 uppercase font-bold mt-1">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

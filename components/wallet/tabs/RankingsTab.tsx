"use client";

import CheckInRankings from "@/components/wallet/CheckInRankings";
import type { WalletAppState } from "@/hooks/useWalletApp";

export default function RankingsTab({ app }: { app: WalletAppState }) {
  if (!app.wallet) return null;

  return (
    <div className="w-full tab-content-enter">
      <CheckInRankings app={app} />
    </div>
  );
}

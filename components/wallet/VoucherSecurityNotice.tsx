import { ExternalLink, ShieldCheck } from "lucide-react";
import { VOUCHER_CONTRACT } from "@/lib/constants/env";

export default function VoucherSecurityNotice({
  asset,
  exactAmount,
  needsApproval,
}: {
  asset: "USDC" | "ETH";
  exactAmount: string;
  needsApproval?: boolean;
}) {
  const short =
    VOUCHER_CONTRACT.length > 12
      ? `${VOUCHER_CONTRACT.slice(0, 6)}…${VOUCHER_CONTRACT.slice(-4)}`
      : VOUCHER_CONTRACT;

  return (
    <div className="glass-panel-accent border border-emerald-500/25 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <ShieldCheck size={18} className="text-emerald-700 shrink-0 mt-0.5" />
        <div className="space-y-2 text-xs text-[var(--ink-muted)] leading-relaxed">
          <p className="font-black text-emerald-800 text-sm">Your wallet & funds are safe</p>
          <p>
            Deposits go to a{" "}
            <a
              href={`https://basescan.org/address/${VOUCHER_CONTRACT}#code`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--ink)] font-bold hover:text-[var(--brand)] inline-flex items-center gap-0.5"
            >
              verified contract <ExternalLink size={10} />
            </a>{" "}
            ({short}). Funds stay locked until someone redeems with the correct Card ID + secret.
          </p>
          {asset === "USDC" && needsApproval && (
            <p>
              <span className="text-amber-800 font-bold">USDC approval is exact only</span> — you
              approve precisely{" "}
              <span className="text-[var(--ink)] font-bold">{exactAmount}</span>, not unlimited
              access. MetaMask may show a Blockaid notice for new contracts; that is common for
              token approvals and does not mean this app is malicious.
            </p>
          )}
          {asset === "ETH" && (
            <p>
              You send exactly <span className="text-[var(--ink)] font-bold">{exactAmount}</span> ETH
              in one transaction — no token approval required.
            </p>
          )}
          <p className="text-[10px] text-[var(--ink-dim)]">
            Only share Card ID + secret with intended recipients. Never share your wallet seed
            phrase.
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Copy, Gift, Users } from "lucide-react";
import { APP_URL_WEB } from "@/lib/constants/env";
import { getReferralCode } from "@/lib/utils/share";
import { fetchReferralStats } from "@/lib/utils/referral";

interface ReferralPanelProps {
  address: string;
}

export default function ReferralPanel({ address }: ReferralPanelProps) {
  const [copied, setCopied] = useState(false);
  const [invites, setInvites] = useState(0);
  const [bonusXp, setBonusXp] = useState(0);

  const code = getReferralCode(address);
  const link = `${APP_URL_WEB}/?ref=${code}`;

  useEffect(() => {
    void fetchReferralStats(address).then((s) => {
      setInvites(s.invites);
      setBonusXp(s.bonusXp);
    });
  }, [address]);

  const copy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card overflow-hidden">
      <div className="p-5 sm:p-6">
        <p className="section-eyebrow flex items-center gap-2">
          <Users size={12} className="text-cyan-400" /> Share &amp; Invite
        </p>
        <h3 className="text-lg font-bold text-[var(--ink)] mt-1">Invite friends to Base Analytics</h3>
        <p className="text-xs text-[var(--ink-muted)] mt-2 leading-relaxed">
          Share your referral link with traders and friends to explore tokenized stocks, track daily onchain habits, and inspect deep wallet analytics on Base.
        </p>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <code className="flex-1 text-[11px] font-mono text-[var(--ink-soft)] bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5 truncate">
            {link}
          </code>
          <button
            type="button"
            onClick={copy}
            className="btn-secondary flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold shrink-0"
          >
            {copied ? <CheckCircle size={14} className="text-emerald-400" /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] p-3 text-center">
            <Users size={16} className="text-cyan-400 mx-auto mb-1" />
            <p className="text-xl font-black text-[var(--ink)]">{invites}</p>
            <p className="text-[9px] text-[var(--ink-muted)] uppercase font-bold">Wallets Invited</p>
          </div>
          <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] p-3 text-center">
            <Gift size={16} className="text-amber-400 mx-auto mb-1" />
            <p className="text-xl font-black text-amber-400">
              {invites > 0 ? "Active" : "Ready"}
            </p>
            <p className="text-[9px] text-[var(--ink-muted)] uppercase font-bold">Referral Status</p>
          </div>
        </div>
      </div>
    </div>
  );
}

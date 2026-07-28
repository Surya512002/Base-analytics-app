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
          <Gift size={12} /> Invite friends
        </p>
        <h3 className="text-lg font-bold text-[var(--ink)] mt-1">Earn +25 XP per referral</h3>
        <p className="text-xs text-[var(--ink-muted)] mt-2 leading-relaxed">
          Friends get +50 XP when they connect. You earn bonus XP for every wallet that joins via
          your link.
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
            {copied ? <CheckCircle size={14} className="text-emerald-600" /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] p-3 text-center">
            <Users size={16} className="text-[var(--brand)] mx-auto mb-1" />
            <p className="text-xl font-black text-[var(--ink)]">{invites}</p>
            <p className="text-[9px] text-[var(--ink-muted)] uppercase font-bold">Invites</p>
          </div>
          <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] p-3 text-center">
            <p className="text-xl font-black text-amber-600">+{bonusXp}</p>
            <p className="text-[9px] text-[var(--ink-muted)] uppercase font-bold">Referral XP</p>
          </div>
        </div>
      </div>
    </div>
  );
}

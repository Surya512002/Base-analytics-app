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
    <div className="elegant-panel rounded-3xl overflow-hidden border border-violet-500/20">
      <div className="h-0.5 bg-linear-to-r from-violet-500 via-champagne to-cyan-400" />
      <div className="p-5 sm:p-6">
        <p className="section-eyebrow text-violet-300 flex items-center gap-2">
          <Gift size={12} /> Invite friends
        </p>
        <h3 className="text-lg font-black text-white mt-1">Earn +25 XP per referral</h3>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          Friends get +50 XP when they connect. You earn bonus XP for every wallet that joins via your link.
        </p>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <code className="flex-1 text-[11px] font-mono text-violet-200 bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 truncate">
            {link}
          </code>
          <button
            type="button"
            onClick={copy}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-sm font-black shrink-0"
          >
            {copied ? <CheckCircle size={14} className="text-emerald-400" /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl bg-white/[0.04] border border-white/8 p-3 text-center">
            <Users size={16} className="text-violet-400 mx-auto mb-1" />
            <p className="text-xl font-black text-white">{invites}</p>
            <p className="text-[9px] text-slate-500 uppercase font-bold">Invites</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/8 p-3 text-center">
            <p className="text-xl font-black text-amber-300">+{bonusXp}</p>
            <p className="text-[9px] text-slate-500 uppercase font-bold">Referral XP</p>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { CheckCircle, Copy, Share2 } from "lucide-react";
import type { StoredVoucherBatch } from "@/lib/utils/voucher";
import {
  buildBatchFarcasterUrl,
  buildVoucherCastText,
  buildVoucherShareMessage,
  copyBatchShareText,
} from "@/lib/utils/voucher-share";
import { APP_URL_WEB } from "@/lib/constants/env";

interface VoucherSharePanelProps {
  batch: StoredVoucherBatch;
}

export default function VoucherSharePanel({ batch }: VoucherSharePanelProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const shareNative = async () => {
    const text = buildVoucherShareMessage(batch);
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Base Voucher Gift Card",
          text,
          url: APP_URL_WEB,
        });
        return;
      } catch {
        /* cancelled */
      }
    }
    copy(text, "native");
  };

  return (
    <div className="rounded-2xl border-2 border-cyan-500/30 bg-cyan-500/8 p-4 sm:p-5 space-y-4">
      <div>
        <p className="text-sm font-black text-cyan-200">Share your gift cards</p>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          Spread the word on Farcaster or copy a ready-made message. Recipients redeem at{" "}
          <span className="text-cyan-400 font-bold">/redeem</span>.
        </p>
      </div>

      <div className="rounded-xl bg-black/30 border border-white/10 p-3">
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
          Suggested message
        </p>
        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
          {buildVoucherCastText(batch)}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => copy(copyBatchShareText(batch), "all")}
          className="flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm bg-white/10 border border-white/15 text-white hover:bg-white/15 transition"
        >
          {copied === "all" ? <CheckCircle size={16} /> : <Copy size={16} />}
          {copied === "all" ? "Copied!" : "Copy all cards"}
        </button>
        <button
          type="button"
          onClick={() => copy(buildVoucherShareMessage(batch), "msg")}
          className="flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm bg-white/10 border border-white/15 text-white hover:bg-white/15 transition"
        >
          {copied === "msg" ? <CheckCircle size={16} /> : <Copy size={16} />}
          {copied === "msg" ? "Copied!" : "Copy message"}
        </button>
        <button
          type="button"
          onClick={shareNative}
          className="flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm btn-primary"
        >
          <Share2 size={16} /> Share
        </button>
      </div>

      <a
        href={buildBatchFarcasterUrl(batch)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-black text-sm bg-purple-500/15 border border-purple-400/30 text-purple-200 hover:bg-purple-500/25 transition"
      >
        Cast on Farcaster ↗
      </a>
    </div>
  );
}

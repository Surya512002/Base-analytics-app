"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle, ExternalLink } from "lucide-react";
import AppLogo from "@/components/ui/AppLogo";
import { APP_URL_WEB } from "@/lib/constants/env";
import { basescanTxUrl } from "@/lib/utils/tx";

export default function ReceiptPage() {
  const params = useParams();
  const txHash = (params.txHash as string) || "";
  const txUrl = txHash.startsWith("0x") ? basescanTxUrl(txHash) : null;

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--ink)] flex items-center justify-center p-4">
      <div className="relative z-10 w-full max-w-md elegant-panel rounded-3xl border border-[var(--border-subtle)] overflow-hidden">
        <div className="p-8 text-center">
          <Link href={APP_URL_WEB} className="inline-flex items-center gap-2 mb-6">
            <AppLogo size="sm" />
          </Link>
          <CheckCircle size={48} className="text-emerald-400 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-[var(--ink)]">x402 payment confirmed</h1>
          <p className="text-sm text-[var(--ink-muted)] mt-2 leading-relaxed">
            Your premium analytics are unlocked on Base. Open the app to view insights.
          </p>
          {txUrl && (
            <a
              href={txUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 text-sm text-[var(--ink-muted)] font-bold hover:underline"
            >
              View on Basescan <ExternalLink size={14} />
            </a>
          )}
          <Link href={`${APP_URL_WEB}/?tab=dashboard`} className="block mt-6 py-3.5 rounded-2xl btn-primary font-black text-sm">
            Open dashboard →
          </Link>
        </div>
      </div>
    </div>
  );
}

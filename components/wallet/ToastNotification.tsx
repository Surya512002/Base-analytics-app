"use client";

import { motion } from "motion/react";
import { BadgeCheck, X, ExternalLink } from "lucide-react";
import { basescanTxUrl } from "@/lib/utils/tx";

interface ToastNotificationProps {
  msg: string;
  hash: string;
  onClose: () => void;
}

export default function ToastNotification({
  msg,
  hash,
  onClose,
}: ToastNotificationProps) {
  const isTxHash = Boolean(hash && hash.startsWith("0x") && hash.length >= 18);
  const url = isTxHash ? basescanTxUrl(hash) : null;
  const shortHash =
    isTxHash
      ? `${hash.slice(0, 8)}…${hash.slice(-6)}`
      : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.96 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="fixed left-3 right-3 sm:left-auto sm:right-6 sm:w-88 z-[180] px-4 py-3.5 rounded-2xl flex items-start gap-3 border border-[var(--border-subtle)] bg-[var(--surface)]/95 backdrop-blur-md text-[var(--ink)] shadow-[var(--shadow-card)] max-h-[40dvh] overflow-y-auto overscroll-contain"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
      }}
      role="status"
    >
      <div className="shrink-0 mt-0.5 flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
        <BadgeCheck size={16} />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="font-bold text-sm leading-snug break-words text-[var(--ink)]">{msg}</p>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-flex max-w-full flex-wrap items-center gap-1 text-[var(--brand-dark)] dark:text-[var(--brand)] text-xs font-semibold hover:underline"
          >
            <span>View on BaseScan</span>
            {shortHash && <span className="font-mono text-[11px] opacity-80">({shortHash})</span>}
            <ExternalLink size={11} className="opacity-70" />
          </a>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="shrink-0 bg-[var(--surface-2)] hover:bg-[var(--border-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)] p-1.5 rounded-xl transition-colors"
      >
        <X size={13} />
      </button>
    </motion.div>
  );
}

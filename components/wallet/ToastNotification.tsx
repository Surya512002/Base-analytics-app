import { BadgeCheck, X } from "lucide-react";
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
  const url = hash ? basescanTxUrl(hash) : null;
  const shortHash =
    hash && hash.startsWith("0x") && hash.length >= 18
      ? `${hash.slice(0, 10)}…${hash.slice(-6)}`
      : hash;

  return (
    <div
      className="fixed left-3 right-3 sm:left-auto sm:right-6 sm:w-80 z-[180] px-4 py-3.5 rounded-2xl flex items-start gap-3 border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink)] shadow-[var(--shadow-card)] max-h-[40dvh] overflow-y-auto overscroll-contain"
      style={{
        animation: "slideUp 0.3s ease-out",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
      }}
      role="status"
    >
      <BadgeCheck size={20} className="shrink-0 mt-0.5 text-emerald-600" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm leading-snug break-words text-[var(--ink)]">{msg}</p>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-flex max-w-full flex-wrap items-center gap-x-1 text-[var(--brand-dark)] text-xs font-semibold underline hover:text-[var(--brand)] break-all"
          >
            <span>View on BaseScan</span>
            {shortHash && <span className="font-mono opacity-90">{shortHash}</span>}
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
    </div>
  );
}

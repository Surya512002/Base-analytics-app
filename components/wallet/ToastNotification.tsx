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
      className="fixed left-3 right-3 sm:left-auto sm:right-6 sm:w-80 z-[180] text-white px-4 py-3.5 rounded-2xl flex items-start gap-3 border border-cyan-500/25 max-h-[40dvh] overflow-y-auto overscroll-contain"
      style={{
        background: "linear-gradient(135deg, rgba(0,82,255,0.9), rgba(255,51,102,0.85))",
        boxShadow: "0 8px 32px rgba(255,51,102,0.3)",
        animation: "slideUp 0.3s ease-out",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
      }}
    >
      <BadgeCheck size={20} className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm leading-snug break-words">{msg}</p>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-flex max-w-full flex-wrap items-center gap-x-1 text-cyan-100 text-xs underline hover:text-white break-all"
          >
            <span>View on BaseScan</span>
            {shortHash && <span className="font-mono opacity-90">{shortHash}</span>}
          </a>
        )}
      </div>
      <button
        onClick={onClose}
        className="shrink-0 bg-white/10 hover:bg-white/20 p-1.5 rounded-xl transition-colors"
      >
        <X size={13} />
      </button>
    </div>
  );
}

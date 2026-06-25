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
  return (
    <div
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 z-50 text-white px-5 py-4 rounded-2xl flex items-start gap-3 border border-cyan-500/25"
      style={{
        background: "linear-gradient(135deg, rgba(0,82,255,0.9), rgba(255,51,102,0.85))",
        boxShadow: "0 8px 32px rgba(255,51,102,0.3)",
        animation: "slideUp 0.3s ease-out",
      }}
    >
      <BadgeCheck size={20} className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm">{msg}</p>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-cyan-100 text-xs underline hover:text-white"
          >
            View on BaseScan ↗
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

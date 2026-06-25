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
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 z-50 bg-linear-to-r from-blue-600 to-blue-700 text-white px-5 py-4 rounded-2xl shadow-2xl shadow-blue-600/40 flex items-start gap-3"
      style={{ animation: "slideUp 0.3s ease-out" }}
    >
      <BadgeCheck size={20} className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm">{msg}</p>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-blue-200 text-xs underline hover:text-white"
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

"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import BodyPortal from "@/components/ui/BodyPortal";

/**
 * Pulse-styled dialog shell: always rendered at the document root (see BodyPortal), centred
 * on desktop and a bottom sheet on phones, with a gradient header, a scrollable body and an
 * optional pinned footer. Escape, the close button and a backdrop tap all call `onClose`;
 * the page behind stops scrolling while it is open. Presentation only.
 */
export default function PulseModal({
  onClose,
  labelledBy,
  header,
  children,
  footer,
  size = "md",
  closeLabel = "Close",
}: {
  onClose: () => void;
  /** id of the heading inside `header`. */
  labelledBy?: string;
  /** Rendered on the gradient surface. */
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
  closeLabel?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <BodyPortal>
      <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-6">
        <motion.div
          aria-hidden
          className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-[3px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        />
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          tabIndex={-1}
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-[var(--border-strong)] bg-[var(--surface-3)] shadow-2xl outline-none sm:max-h-[88dvh] sm:rounded-[1.75rem] ${
            size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg"
          }`}
        >
          <div className="pulse-surface shrink-0 rounded-none px-5 pb-5 pt-3 shadow-none sm:px-6 sm:pt-5">
            {/* grab handle (phones) */}
            <span aria-hidden className="mx-auto mb-3 block h-1 w-10 rounded-full bg-white/40 sm:hidden" />
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/25 bg-white/15 text-white transition hover:bg-white/25"
            >
              <X size={18} />
            </button>
            {header}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
          {footer && (
            <div className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface-3)] px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:px-6 sm:pb-4">
              {footer}
            </div>
          )}
        </motion.div>
      </div>
    </BodyPortal>
  );
}

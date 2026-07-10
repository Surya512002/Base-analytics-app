"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Rocket } from "lucide-react";
import { fetchGlobalActivity, type GlobalActivityItem } from "@/lib/api/launchpad-market-client";
import { timeAgo } from "@/lib/launchpad/format";
import { basescanTxUrl } from "@/lib/utils/tx";

export default function GlobalActivityTicker({
  onOpenToken,
}: {
  onOpenToken?: (address: string) => void;
}) {
  const [items, setItems] = useState<GlobalActivityItem[]>([]);
  const [paused, setPaused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      void fetchGlobalActivity(24)
        .then((d) => {
          if (!alive) return;
          setItems(d.activities);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 45_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setPaused(!entry?.isIntersecting),
      { threshold: 0.05 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [items.length]);

  if (!items.length) return null;

  const doubled = [...items, ...items];
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      ref={rootRef}
      className="mb-4 rounded-xl border border-white/[0.08] bg-[var(--bg-raised)] overflow-hidden"
    >
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.08]">
        <span className="live-dot" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-dim)]">
          Live activity on Base
        </p>
      </div>
      <div className="relative overflow-hidden py-2.5 min-h-[2.25rem]">
        <div
          className={`flex gap-6 whitespace-nowrap w-max ${
            paused || reduceMotion ? "" : "animate-marquee"
          }`}
        >
          {doubled.map((item, i) => {
            const txUrl = item.txHash ? basescanTxUrl(item.txHash) : null;
            return (
              <button
                key={`${item.token}-${item.timestamp}-${i}`}
                type="button"
                onClick={() => onOpenToken?.(item.token)}
                className="inline-flex items-center gap-2 px-2 text-[12px] text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors shrink-0"
              >
                {item.type === "launch" ? (
                  <Rocket size={12} className="text-[var(--ink-dim)]" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
                <span className="font-semibold text-[var(--ink)]">{item.symbol}</span>
                <span className="text-[var(--ink-dim)]">{timeAgo(item.timestamp)}</span>
                {txUrl && (
                  <a
                    href={txUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-cyan-400/70 hover:text-cyan-300"
                  >
                    <ExternalLink size={10} />
                  </a>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

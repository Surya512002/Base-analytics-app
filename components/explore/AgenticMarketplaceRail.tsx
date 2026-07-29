"use client";

import Link from "next/link";
import { BookOpen, ExternalLink, Zap } from "lucide-react";
import type { AppTab } from "@/hooks/useWalletApp";
import type { X402ProductId } from "@/lib/constants/x402-products";
import { AGENT_CATALOG } from "@/lib/constants/agent-catalog";

function ServiceCard({
  title,
  desc,
  price,
  tag,
}: {
  title: string;
  desc: string;
  price: string;
  tag?: string;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-[var(--ink)] group-hover:opacity-90 transition-opacity">
          {title}
        </p>
        {tag && (
          <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--ink-dim)] border border-[var(--border-subtle)] px-1.5 py-0.5 rounded">
            {tag}
          </span>
        )}
      </div>
      <p className="text-[11px] text-[var(--ink-dim)] mt-1.5 leading-snug">{desc}</p>
      <p className="text-[12px] font-medium text-[var(--ink-muted)] mt-2.5 font-mono flex items-center gap-1">
        {tag === "x402" && <Zap size={10} />}
        {price}
      </p>
    </>
  );
}

export default function AgenticMarketplaceRail({
  onNavigate,
  guest,
  onConnect,
  onPayAgent,
}: {
  onNavigate?: (tab: AppTab) => void;
  guest?: boolean;
  onConnect?: () => void;
  onPayAgent?: (productId: X402ProductId) => void;
}) {
  const openTab = (tab: AppTab) => {
    if (guest && tab !== "launchpad" && tab !== "swap") {
      onConnect?.();
      return;
    }
    onNavigate?.(tab);
  };

  const handleAgent = (entry: (typeof AGENT_CATALOG)[0]) => {
    if (entry.productId) {
      if (guest) {
        onConnect?.();
        return;
      }
      onPayAgent?.(entry.productId);
      onNavigate?.("dashboard");
      return;
    }
    if (entry.tab) openTab(entry.tab);
  };

  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-raised)] overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-[15px] font-bold text-[var(--ink)] tracking-tight">
            Agentic Marketplace
          </h3>
          <p className="text-[11px] text-[var(--ink-dim)] mt-0.5">
            AI services · pay per call with x402
          </p>
        </div>
        <Link
          href="/docs#api"
          className="text-[11px] font-medium text-[var(--ink-muted)] hover:text-[var(--ink)] flex items-center gap-1 transition-colors"
        >
          All services <ExternalLink size={10} />
        </Link>
      </div>
      <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {AGENT_CATALOG.map((s) =>
          s.href ? (
            <Link
              key={s.id}
              href={s.href}
              className="group block text-left rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 hover:border-[var(--border-strong)] transition-colors"
            >
              <ServiceCard title={s.title} desc={s.description} price={s.price} tag={s.tag} />
            </Link>
          ) : (
            <button
              key={s.id}
              type="button"
              onClick={() => handleAgent(s)}
              className="group text-left rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 hover:border-[var(--border-strong)] transition-colors"
            >
              <ServiceCard title={s.title} desc={s.description} price={s.price} tag={s.tag} />
            </button>
          )
        )}
      </div>
    </section>
  );
}

export function ExploreKnowledgeRail() {
  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-raised)] overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center gap-2.5">
        <BookOpen size={15} className="text-[var(--ink-dim)]" />
        <div>
          <h3 className="font-display text-[15px] font-bold text-[var(--ink)] tracking-tight">
            Docs
          </h3>
          <p className="text-[11px] text-[var(--ink-dim)]">Launch guides, API &amp; disclosures</p>
        </div>
      </div>
      <div className="p-4 grid sm:grid-cols-3 gap-2">
        {[
          { label: "How to launch B20", href: "/docs" },
          { label: "Fee splits & referrals", href: "/docs" },
          { label: "MCP for agents", href: "/docs#api" },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] px-3 py-2.5 text-[12px] font-medium text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-[var(--border-strong)] transition-colors"
          >
            {item.label}
            <ExternalLink size={11} className="text-[var(--ink-dim)]" />
          </Link>
        ))}
      </div>
    </section>
  );
}

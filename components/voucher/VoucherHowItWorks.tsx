"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  HelpCircle,
  Sparkles,
  Zap,
  ShieldCheck,
  Gift,
  Share2,
  Wallet,
} from "lucide-react";

export default function VoucherHowItWorks() {
  const [isOpen, setIsOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const toggleFaq = (idx: number) => {
    setOpenFaqIndex((prev) => (prev === idx ? null : idx));
  };

  const FAQS = [
    {
      q: "Is gas sponsored for recipients?",
      a: "Yes! Claiming vouchers utilizes Base Paymaster gas sponsorship for smart wallets and low L2 fees. Recipients can claim their gift card without needing pre-existing ETH for gas.",
    },
    {
      q: "What is the one-card-per-wallet-per-batch rule?",
      a: "To prevent batch exhaustion and ensure equitable rewards, the verified BaseVoucher smart contract strictly enforces that each unique wallet address can only claim one card per batch (including the creator).",
    },
    {
      q: "Are secret keys sent to your server?",
      a: "Never. Claim links place the secret key in the URL fragment (#id=...&secret=...). Browsers never transmit hash fragments over HTTP, ensuring cryptographic privacy between creator and recipient.",
    },
    {
      q: "Can I gift tokenized stocks and yield vault positions?",
      a: "Yes! You can split all 32 Coinbase B20 tokenized equities (e.g. NVDA, AAPL, TSLA, COIN) and Morpho/SuperStocks yield-bearing vault shares into gift cards.",
    },
  ];

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] overflow-hidden shadow-sm">
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-[var(--surface-2)] transition cursor-pointer"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--brand-soft)] text-[var(--brand-text)] flex items-center justify-center font-bold shrink-0">
            <HelpCircle size={18} />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-[var(--ink)]">
              How It Works &amp; FAQ
            </h3>
            <p className="text-xs text-[var(--ink-muted)]">
              Learn about onchain gifting, URL fragment secrets, and gas sponsorship.
            </p>
          </div>
        </div>

        <div
          className={`p-2 rounded-xl text-[var(--ink-muted)] transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          <ChevronDown size={18} />
        </div>
      </button>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="px-5 pb-6 pt-2 border-t border-[var(--border-subtle)] space-y-6 animate-in fade-in duration-200">
          {/* 3 Short Steps */}
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--brand-text)] block mb-3">
              3 Simple Steps
            </span>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="pop-lg rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--brand)] text-white flex items-center justify-center font-black text-xs">
                  1
                </div>
                <h4 className="text-sm font-black text-[var(--ink)]">
                  Choose &amp; Split
                </h4>
                <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                  Select tokenized stocks, yield vaults, USDC, or ETH. Split your total deposit into 1 to 50 cards.
                </p>
              </div>

              <div className="pop-lg rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--brand)] text-white flex items-center justify-center font-black text-xs">
                  2
                </div>
                <h4 className="text-sm font-black text-[var(--ink)]">
                  Share Claim Link
                </h4>
                <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                  Send each recipient their unique claim link or QR code. The secret key is safely held in the URL fragment.
                </p>
              </div>

              <div className="pop-lg rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--brand)] text-white flex items-center justify-center font-black text-xs">
                  3
                </div>
                <h4 className="text-sm font-black text-[var(--ink)]">
                  Recipient Claims
                </h4>
                <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                  Recipient taps &quot;Claim to Wallet&quot;. Funds transfer directly to their Base address with zero gas friction.
                </p>
              </div>
            </div>
          </div>

          {/* Small FAQ Accordion */}
          <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--ink-muted)] block mb-2">
              Frequently Asked Questions
            </span>

            {FAQS.map((faq, idx) => {
              const isFaqOpen = openFaqIndex === idx;
              return (
                <div
                  key={faq.q}
                  className="pop-row rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    className="w-full flex items-center justify-between p-3.5 text-left text-xs sm:text-sm font-bold text-[var(--ink)] hover:text-[var(--brand-text)] transition cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      size={15}
                      className={`text-[var(--ink-muted)] shrink-0 transition-transform ${
                        isFaqOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isFaqOpen && (
                    <div className="px-3.5 pb-3.5 pt-1 text-xs text-[var(--ink-muted)] leading-relaxed border-t border-[var(--border-subtle)]/40">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

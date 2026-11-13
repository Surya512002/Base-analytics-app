/**
 * Link-preview images (X, Farcaster, Telegram, iMessage…), v2.
 *
 * Design rules: readable at X's ~500px preview width (nothing under ~22px), one message
 * per card, real data only — prices are labelled with their timestamp, never "real-time",
 * and nothing is invented when data is missing (cards fall back to feature text).
 * Satori constraints: flexbox only, every multi-child div has display:flex.
 */
import type { ReactElement } from "react";
import { OgLogo } from "./brand-kit";

export const C = {
  bg: "#050B17",
  card: "rgba(18, 28, 52, 0.92)",
  border: "rgba(255,255,255,0.10)",
  blue: "#0052FF",
  blueText: "#7AA5FF",
  text: "#F8FAFC",
  soft: "#C3CEDF",
  muted: "#8E9BB3",
  green: "#34D399",
  red: "#F87171",
  amber: "#FBBF24",
} as const;

const SITE = "base-analytics-app.vercel.app";

function Frame({ children }: { children: ReactElement | ReactElement[] }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        backgroundColor: C.bg,
        backgroundImage:
          "radial-gradient(circle at 18% 0%, rgba(0,82,255,0.34) 0%, rgba(0,82,255,0) 46%), radial-gradient(circle at 100% 100%, rgba(56,189,248,0.14) 0%, rgba(56,189,248,0) 42%)",
        padding: "48px 56px",
        color: C.text,
        fontFamily: "Figtree",
        fontWeight: 500,
      }}
    >
      {children}
    </div>
  );
}

function Brand({ right }: { right?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <OgLogo size={56} />
        <div style={{ display: "flex", fontSize: 34, fontWeight: 800, letterSpacing: -0.5 }}>Base Analytics</div>
      </div>
      {right ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 22,
            fontWeight: 700,
            color: C.soft,
            padding: "10px 18px",
            borderRadius: 999,
            border: `1px solid ${C.border}`,
            backgroundColor: "rgba(255,255,255,0.04)",
          }}
        >
          <div style={{ display: "flex", width: 12, height: 12, borderRadius: 999, backgroundColor: C.blue }} />
          {right}
        </div>
      ) : (
        <div style={{ display: "flex" }} />
      )}
    </div>
  );
}

function Footer({ left, cta }: { left: string; cta: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
      <div style={{ display: "flex", fontSize: 24, color: C.muted, fontWeight: 600 }}>{left}</div>
      <div
        style={{
          display: "flex",
          fontSize: 26,
          fontWeight: 800,
          color: "#FFFFFF",
          backgroundColor: C.blue,
          padding: "14px 28px",
          borderRadius: 16,
        }}
      >
        {cta}
      </div>
    </div>
  );
}

// ───────────────────────────── home / default card ─────────────────────────────

export interface ShareStockRow {
  symbol: string;
  price: number;
  change24h: number;
}

const FEATURES = [
  ["Explore", "tokenized stocks on Base"],
  ["Swap", "routed across Base DEXs"],
  ["Borrow", "plan loans against stocks"],
  ["Gift", "one link, first N claim"],
] as const;

export function renderHomeShareCard(input: { stocks: ShareStockRow[]; asOf: Date | null }): ReactElement {
  const rows = input.stocks.slice(0, 4);
  const hasPrices = rows.length === 4 && input.asOf !== null;
  const asOf = input.asOf
    ? `${input.asOf.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}, ${input.asOf
        .toISOString()
        .slice(11, 16)} UTC`
    : "";

  return (
    <Frame>
      <Brand right="Built on Base" />

      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 48, marginTop: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 76, fontWeight: 800, lineHeight: 1.04, letterSpacing: -2 }}>
            <div style={{ display: "flex" }}>Tokenized stocks,</div>
            <div style={{ display: "flex" }}>
              <span style={{ color: C.blueText }}>simply</span>&nbsp;on Base.
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 30, color: C.soft, marginTop: 22, lineHeight: 1.35 }}>
            Explore, swap, borrow and gift — in one calm app.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 430,
            backgroundColor: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 28,
            padding: "26px 28px",
          }}
        >
          {hasPrices ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ display: "flex", fontSize: 24, fontWeight: 800 }}>Stock prices</div>
                <div style={{ display: "flex", fontSize: 18, color: C.muted }}>{asOf}</div>
              </div>
              {rows.map((r) => {
                const up = r.change24h >= 0;
                return (
                  <div
                    key={r.symbol}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: 18,
                      paddingTop: 16,
                      borderTop: `1px solid ${C.border}`,
                    }}
                  >
                    <div style={{ display: "flex", fontSize: 30, fontWeight: 800 }}>{r.symbol}</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                      <div style={{ display: "flex", fontSize: 28, color: C.soft }}>
                        ${r.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div style={{ display: "flex", fontSize: 24, fontWeight: 800, color: up ? C.green : C.red, width: 104, justifyContent: "flex-end" }}>
                        {up ? "+" : ""}
                        {r.change24h.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {FEATURES.map(([title, sub], i) => (
                <div
                  key={title}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    paddingTop: i ? 12 : 0,
                    marginTop: i ? 12 : 0,
                    borderTop: i ? `1px solid ${C.border}` : "none",
                  }}
                >
                  <div style={{ display: "flex", fontSize: 28, fontWeight: 800 }}>{title}</div>
                  <div style={{ display: "flex", fontSize: 21, color: C.muted }}>{sub}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer left={SITE} cta="Open the app →" />
    </Frame>
  );
}

// ───────────────────────────── gift / claim card ─────────────────────────────

export interface GiftShareData {
  amount: string; // e.g. "0.5 NVDAc"
  senderName: string | null;
  senderVerified: boolean;
  senderAddress: string;
  claimsRemaining: number;
  maxClaims: number;
  status: "open" | "locked" | "expired" | "full" | "closed";
  expiresAt: number;
  unlockAt: number;
  message: string;
}

function GiftGraphic({ amount, dim }: { amount: string | null; dim?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: 420,
        height: 270,
        borderRadius: 32,
        padding: "28px 30px",
        backgroundImage: dim
          ? "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)"
          : "linear-gradient(135deg, #0052FF 0%, #1E3A8A 60%, #0B1B4D 100%)",
        border: "1px solid rgba(255,255,255,0.18)",
        boxShadow: "0 30px 80px rgba(0,82,255,0.35)",
        transform: "rotate(-4deg)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 22, fontWeight: 800, letterSpacing: 2 }}>GIFT</div>
        {/* ribbon */}
        <div style={{ display: "flex", width: 44, height: 44, borderRadius: 12, border: "4px solid rgba(255,255,255,0.85)" }} />
      </div>
      <div style={{ display: "flex", fontSize: amount && amount.length > 12 ? 40 : 52, fontWeight: 800, letterSpacing: -1 }}>
        {amount ?? "On Base"}
      </div>
      <div style={{ display: "flex", fontSize: 20, color: "rgba(255,255,255,0.8)" }}>Claim onchain · Base</div>
    </div>
  );
}

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

const STATUS_TEXT: Record<GiftShareData["status"], string> = {
  open: "Open now",
  locked: "Opens soon",
  expired: "Expired",
  full: "All claimed",
  closed: "Closed",
};

export function renderGiftShareCard(data: GiftShareData | null): ReactElement {
  if (!data) {
    return (
      <Frame>
        <Brand right="Base gift" />
        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 70, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
              <div style={{ display: "flex" }}>A gift is</div>
              <div style={{ display: "flex" }}>waiting for you.</div>
            </div>
            <div style={{ display: "flex", fontSize: 28, color: C.soft, marginTop: 20, lineHeight: 1.35 }}>
              See who sent it, then claim it to your wallet on Base.
            </div>
          </div>
          <GiftGraphic amount={null} />
        </div>
        <Footer left={SITE} cta="Claim your gift →" />
      </Frame>
    );
  }

  const live = data.status === "open" || data.status === "locked";
  const sender = data.senderName ?? shortAddr(data.senderAddress);
  const when =
    data.status === "locked" && data.unlockAt
      ? `Opens ${new Date(data.unlockAt * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
      : data.expiresAt && live
        ? `Until ${new Date(data.expiresAt * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
        : null;
  // Only describe what is true for each state: a closed gift was refunded, not claimed.
  const slots = !live
    ? data.status === "full"
      ? `${data.maxClaims} of ${data.maxClaims} claimed`
      : null
    : data.maxClaims > 1
      ? `${data.claimsRemaining} of ${data.maxClaims} left`
      : "1 gift";
  const ended: Record<GiftShareData["status"], string> = {
    open: "",
    locked: "",
    full: "All claimed",
    expired: "Expired",
    closed: "Returned to sender",
  };

  return (
    <Frame>
      <Brand right={STATUS_TEXT[data.status]} />
      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 44 }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 30, color: C.soft, fontWeight: 700 }}>
            {live ? "You've been sent" : "This gift is"}
          </div>
          <div style={{ display: "flex", fontSize: data.amount.length > 14 ? 60 : 76, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05, marginTop: 6 }}>
            {live ? data.amount : ended[data.status]}
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: 26 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 30 }}>
              <span style={{ color: C.muted }}>from</span>
              <span style={{ fontWeight: 800 }}>{sender}</span>
              {data.senderVerified ? (
                <span style={{ display: "flex", fontSize: 20, fontWeight: 800, color: C.green, border: `1px solid rgba(52,211,153,0.4)`, borderRadius: 999, padding: "4px 12px" }}>
                  Verified
                </span>
              ) : null}
            </div>
            <div style={{ display: "flex", fontSize: 22, color: C.muted, marginTop: 8 }}>{data.senderAddress}</div>
          </div>

          <div style={{ display: "flex", gap: 14, marginTop: 26 }}>
            {[slots, when].filter(Boolean).map((t) => (
              <div
                key={t as string}
                style={{
                  display: "flex",
                  fontSize: 22,
                  fontWeight: 700,
                  color: C.soft,
                  padding: "8px 16px",
                  borderRadius: 12,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: `1px solid ${C.border}`,
                }}
              >
                {t}
              </div>
            ))}
          </div>
        </div>
        <GiftGraphic amount={data.amount} dim={!live} />
      </div>
      <Footer left="Sender and terms are shown before you claim" cta={live ? "Claim your gift →" : "View on Base →"} />
    </Frame>
  );
}

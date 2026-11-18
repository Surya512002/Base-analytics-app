/**
 * Link-preview images (X, Farcaster, Telegram, iMessage…), v3: the gift stage.
 *
 * The same blue dotted surface and open gift box as the app's claim screens, so a shared link
 * looks like the thing it opens. Rules: readable at X's ~500px preview width (nothing under
 * ~20px), one message per card, real data only — prices carry their timestamp, nothing is
 * invented when data is missing. Satori: flexbox only, every multi-child div has display:flex.
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

const SITE = "baseanalytics.app";

/** White text tones on the blue stage. */
const W = {
  strong: "#FFFFFF",
  soft: "rgba(255,255,255,0.88)",
  muted: "rgba(255,255,255,0.70)",
  glass: "rgba(255,255,255,0.14)",
  glassBorder: "rgba(255,255,255,0.28)",
  ink: "#0041CC",
  gold: "#FDE68A",
  up: "#86EFAC",
  down: "#FECACA",
} as const;

const RIBBON = "linear-gradient(90deg, #FDE68A 0%, #F59E0B 50%, #FDE68A 100%)";

/** The blue gradient stage with a dot grid, the same surface as the app's gift screens. */
function Frame({ children }: { children: ReactElement | ReactElement[] }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        backgroundColor: "#0052FF",
        backgroundImage: "linear-gradient(135deg, #3B74FF 0%, #0052FF 42%, #4F46E5 100%)",
        padding: "46px 56px",
        color: W.strong,
        fontFamily: "Figtree",
        fontWeight: 500,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1200,
          height: 630,
          display: "flex",
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.22) 1.5px, transparent 1.5px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: -220,
          right: -160,
          width: 620,
          height: 620,
          display: "flex",
          borderRadius: 999,
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 68%)",
        }}
      />
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
            fontWeight: 800,
            padding: "10px 18px",
            borderRadius: 999,
            border: `1px solid ${W.glassBorder}`,
            backgroundColor: W.glass,
          }}
        >
          <div style={{ display: "flex", width: 12, height: 12, borderRadius: 999, backgroundColor: W.gold }} />
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
      <div style={{ display: "flex", fontSize: 24, color: W.muted, fontWeight: 700 }}>{left}</div>
      <div
        style={{
          display: "flex",
          fontSize: 26,
          fontWeight: 800,
          color: W.ink,
          backgroundColor: "#FFFFFF",
          padding: "14px 28px",
          borderRadius: 18,
          boxShadow: "0 14px 30px rgba(0,0,0,0.25)",
        }}
      >
        {cta}
      </div>
    </div>
  );
}

function Pill({ children }: { children: string }) {
  return (
    <div
      style={{
        display: "flex",
        fontSize: 22,
        fontWeight: 800,
        padding: "8px 16px",
        borderRadius: 14,
        backgroundColor: W.glass,
        border: `1px solid ${W.glassBorder}`,
      }}
    >
      {children}
    </div>
  );
}

/** A small four-point sparkle (two crossed bars). */
function Sparkle({ x, y, size, color = "rgba(255,255,255,0.8)" }: { x: number; y: number; size: number; color?: string }) {
  const bar = size * 0.2;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: size, height: size, display: "flex" }}>
      <div style={{ position: "absolute", left: (size - bar) / 2, top: 0, width: bar, height: size, borderRadius: size, backgroundColor: color, display: "flex" }} />
      <div style={{ position: "absolute", left: 0, top: (size - bar) / 2, width: size, height: bar, borderRadius: size, backgroundColor: color, display: "flex" }} />
    </div>
  );
}

/**
 * The open gift box from the app's claim screen: lid tilted up, the gift card peeking out,
 * gold ribbon and bow, sparkles around it. 440 x 440.
 */
export function OgGiftBox({ label = "GIFT", value = "For you", dim = false }: { label?: string; value?: string; dim?: boolean }) {
  const body = dim
    ? "linear-gradient(160deg, #64748B 0%, #475569 50%, #1E293B 100%)"
    : "linear-gradient(160deg, #2F6BFF 0%, #0052FF 45%, #1E3A8A 100%)";
  const lid = dim ? "linear-gradient(160deg, #94A3B8 0%, #475569 100%)" : "linear-gradient(160deg, #5B8CFF 0%, #1D4ED8 100%)";
  const card = dim ? "linear-gradient(135deg, #475569 0%, #334155 100%)" : "linear-gradient(135deg, #0052FF 0%, #6366F1 100%)";
  const valueSize = value.length > 14 ? 28 : value.length > 9 ? 36 : 44;
  return (
    <div style={{ position: "relative", width: 440, height: 440, display: "flex" }}>
      <div
        style={{
          position: "absolute",
          left: 20,
          top: 50,
          width: 400,
          height: 400,
          display: "flex",
          borderRadius: 999,
          backgroundImage: "radial-gradient(circle, rgba(253,230,138,0.40) 0%, rgba(253,230,138,0) 62%)",
        }}
      />
      <Sparkle x={14} y={128} size={26} />
      <Sparkle x={396} y={200} size={34} color={W.gold} />
      <Sparkle x={34} y={336} size={20} />
      <Sparkle x={384} y={378} size={22} />
      <Sparkle x={336} y={36} size={18} />
      <Sparkle x={92} y={30} size={16} color={W.gold} />

      {/* the gift card, peeking out */}
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 118,
          width: 220,
          height: 140,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: "16px 20px",
          borderRadius: 22,
          backgroundImage: card,
          border: "2px solid rgba(255,255,255,0.38)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.25)",
          transform: "rotate(-6deg)",
        }}
      >
        <div style={{ display: "flex", fontSize: 18, fontWeight: 800, letterSpacing: 4 }}>{label}</div>
        <div style={{ display: "flex", fontSize: valueSize, fontWeight: 800, letterSpacing: -1, lineHeight: 1 }}>{value}</div>
      </div>

      {/* box body */}
      <div
        style={{
          position: "absolute",
          left: 70,
          top: 226,
          width: 300,
          height: 196,
          display: "flex",
          borderRadius: 52,
          backgroundImage: body,
          boxShadow: "0 30px 60px rgba(10,20,80,0.45)",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", left: 128, top: 0, width: 44, height: 196, display: "flex", backgroundImage: RIBBON }} />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 300,
            height: 80,
            display: "flex",
            backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0) 100%)",
          }}
        />
        <div style={{ position: "absolute", left: 30, top: 150, display: "flex", fontSize: 18, fontWeight: 800, letterSpacing: 4, color: "rgba(255,255,255,0.72)" }}>
          BASE
        </div>
      </div>

      {/* lid, tilted up, with the bow */}
      <div style={{ position: "absolute", left: 14, top: 4, width: 340, height: 132, display: "flex", transform: "rotate(-12deg)" }}>
        <div
          style={{
            position: "absolute",
            left: 102,
            top: 6,
            width: 72,
            height: 54,
            display: "flex",
            borderRadius: "50% 50% 10% 50%",
            border: "6px solid #FCD34D",
            backgroundImage: "linear-gradient(135deg, #FDE68A 0%, #F59E0B 100%)",
            transform: "rotate(-24deg)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 166,
            top: 6,
            width: 72,
            height: 54,
            display: "flex",
            borderRadius: "50% 50% 50% 10%",
            border: "6px solid #FCD34D",
            backgroundImage: "linear-gradient(225deg, #FDE68A 0%, #F59E0B 100%)",
            transform: "rotate(24deg)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 152,
            top: 40,
            width: 36,
            height: 36,
            display: "flex",
            borderRadius: 999,
            backgroundColor: "#FBBF24",
            border: "4px solid #FDE68A",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 66,
            width: 340,
            height: 66,
            display: "flex",
            borderRadius: 22,
            backgroundImage: lid,
            boxShadow: "0 14px 30px rgba(10,20,80,0.35)",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", left: 148, top: 0, width: 44, height: 66, display: "flex", backgroundImage: RIBBON }} />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: 340,
              height: 34,
              display: "flex",
              backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 100%)",
            }}
          />
        </div>
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

const FEATURES = ["Explore", "Swap", "Borrow", "Gift"] as const;

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

      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 20, marginTop: 6 }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 70, fontWeight: 800, lineHeight: 1.04, letterSpacing: -2 }}>
            <div style={{ display: "flex" }}>Tokenized stocks,</div>
            <div style={{ display: "flex" }}>
              <span style={{ color: W.gold }}>simply</span>&nbsp;on Base.
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 28, color: W.soft, marginTop: 18, lineHeight: 1.35 }}>
            Explore, swap, borrow and send gifts in one calm app.
          </div>

          {hasPrices ? (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 26 }}>
              <div style={{ display: "flex", gap: 12 }}>
                {rows.map((r) => {
                  const up = r.change24h >= 0;
                  return (
                    <div
                      key={r.symbol}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        padding: "10px 14px",
                        borderRadius: 16,
                        backgroundColor: W.glass,
                        border: `1px solid ${W.glassBorder}`,
                      }}
                    >
                      <div style={{ display: "flex", fontSize: 22, fontWeight: 800 }}>{r.symbol}</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <div style={{ display: "flex", fontSize: 20, color: W.soft }}>
                          ${r.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div style={{ display: "flex", fontSize: 18, fontWeight: 800, color: up ? W.up : W.down }}>
                          {up ? "+" : ""}
                          {r.change24h.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", fontSize: 18, color: W.muted, marginTop: 8 }}>Prices as of {asOf}</div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
              {FEATURES.map((f) => (
                <Pill key={f}>{f}</Pill>
              ))}
            </div>
          )}
        </div>

        <OgGiftBox />
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
        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 72, fontWeight: 800, lineHeight: 1.04, letterSpacing: -2 }}>
              <div style={{ display: "flex" }}>A gift is</div>
              <div style={{ display: "flex" }}>
                waiting&nbsp;<span style={{ color: W.gold }}>for you.</span>
              </div>
            </div>
            <div style={{ display: "flex", fontSize: 28, color: W.soft, marginTop: 20, lineHeight: 1.35 }}>
              Tap the box, claim it, and it lands in your wallet on Base.
            </div>
          </div>
          <OgGiftBox />
        </div>
        <Footer left={SITE} cta="Open your gift →" />
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
      ? `${data.maxClaims.toLocaleString("en-US")} of ${data.maxClaims.toLocaleString("en-US")} claimed`
      : null
    : data.maxClaims > 1
      ? `${data.claimsRemaining.toLocaleString("en-US")} of ${data.maxClaims.toLocaleString("en-US")} left`
      : "1 gift";
  const ended: Record<GiftShareData["status"], string> = {
    open: "",
    locked: "",
    full: "All claimed",
    expired: "Expired",
    closed: "Returned",
  };
  const headline = live ? data.amount : ended[data.status];

  return (
    <Frame>
      <Brand right={STATUS_TEXT[data.status]} />
      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 30, color: W.soft, fontWeight: 700 }}>
            {live ? "You've been sent" : data.status === "closed" ? "This gift was" : "This gift is"}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: headline.length > 14 ? 58 : 78,
              fontWeight: 800,
              letterSpacing: -2,
              lineHeight: 1.05,
              marginTop: 6,
              color: live ? W.gold : W.strong,
            }}
          >
            {headline}
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 30 }}>
              <span style={{ color: W.muted }}>from</span>
              <span style={{ fontWeight: 800 }}>{sender}</span>
              {data.senderVerified ? (
                <span
                  style={{
                    display: "flex",
                    fontSize: 20,
                    fontWeight: 800,
                    color: "#065F46",
                    backgroundColor: "#A7F3D0",
                    borderRadius: 999,
                    padding: "4px 12px",
                  }}
                >
                  Verified
                </span>
              ) : null}
            </div>
            <div style={{ display: "flex", fontSize: 21, color: W.muted, marginTop: 8 }}>{data.senderAddress}</div>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
            {[slots, when].filter((t): t is string => Boolean(t)).map((t) => (
              <Pill key={t}>{t}</Pill>
            ))}
          </div>
        </div>
        <OgGiftBox value={live ? data.amount : "For you"} dim={!live} />
      </div>
      <Footer left="Sender and terms are shown before you claim" cta={live ? "Open your gift →" : "View on Base →"} />
    </Frame>
  );
}

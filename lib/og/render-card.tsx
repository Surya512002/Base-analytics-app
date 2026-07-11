import type { OgCardData } from "./types";
import { shortenAddress } from "./types";
import {
  OgBackground,
  OgFooter,
  OgHeader,
  OG_COLORS,
} from "./brand-kit";

function stat(label: string, value: string, accent: string = OG_COLORS.cyan) {
  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        flexDirection: "column",
        border: `1px solid ${OG_COLORS.border}`,
        background: OG_COLORS.panel,
        borderRadius: 15,
        padding: "14px 16px",
      }}
    >
      <span
        style={{
          color: OG_COLORS.dim,
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: "0.12em",
        }}
      >
        {label}
      </span>
      <span style={{ color: accent, fontSize: 26, fontWeight: 950, marginTop: 5 }}>
        {value}
      </span>
    </div>
  );
}

export function renderOgCard(data: OgCardData = {}) {
  const score = data.score ?? 72;
  const rank = data.rank ?? "Base Shark";
  const address = shortenAddress(
    data.address || "0x3799cafa388da047cAF7c999e31c844705FadfAe"
  );
  const title = data.title || address;
  const subtitle =
    data.subtitle || `${rank} · ${data.activeDays ?? 47} active days on Base`;
  const personal =
    data.variant === "score" || data.variant === "badge" || Boolean(data.title);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        fontFamily: "system-ui, sans-serif",
        background: OG_COLORS.bg,
      }}
    >
      <OgBackground />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: "30px 40px 24px",
          position: "relative",
          gap: 22,
        }}
      >
        <OgHeader label="ONCHAIN PROFILE" />
        <div style={{ display: "flex", flex: 1, gap: 34, minHeight: 0 }}>
          <div
            style={{
              display: "flex",
              flex: 0.95,
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                color: OG_COLORS.cyan,
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: "0.18em",
              }}
            >
              YOUR BASE PROFILE
            </span>
            <span
              style={{
                color: OG_COLORS.text,
                fontSize: 48,
                fontWeight: 950,
                letterSpacing: "-0.035em",
                marginTop: 14,
                lineHeight: 1.02,
              }}
            >
              {title}
            </span>
            <span
              style={{
                color: OG_COLORS.muted,
                fontSize: 18,
                fontWeight: 650,
                marginTop: 12,
              }}
            >
              {subtitle}
            </span>
            <div style={{ display: "flex", gap: 10, marginTop: 26 }}>
              {stat("TRANSACTIONS", (data.txs ?? 1248).toLocaleString())}
              {stat("ACTIVE DAYS", String(data.activeDays ?? 47), OG_COLORS.green)}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flex: 1.05,
              flexDirection: "column",
              border: "1px solid rgba(107,163,255,0.30)",
              background: "rgba(255,255,255,0.055)",
              borderRadius: 24,
              padding: 24,
              boxShadow: "0 28px 80px rgba(0,0,0,0.38)",
            }}
          >
            <span
              style={{
                color: OG_COLORS.dim,
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: "0.18em",
              }}
            >
              ONCHAIN SCORE
            </span>
            <div style={{ display: "flex", alignItems: "baseline", marginTop: 10 }}>
              <span
                style={{
                  color: OG_COLORS.text,
                  fontSize: 104,
                  fontWeight: 950,
                  lineHeight: 0.9,
                  letterSpacing: "-0.06em",
                }}
              >
                {score}
              </span>
              <span style={{ color: OG_COLORS.dim, fontSize: 27, fontWeight: 850 }}>
                /100
              </span>
            </div>
            <span style={{ color: OG_COLORS.cyan, fontSize: 24, fontWeight: 900, marginTop: 10 }}>
              {rank}
            </span>
            <div
              style={{
                display: "flex",
                height: 9,
                borderRadius: 99,
                overflow: "hidden",
                background: "rgba(255,255,255,0.08)",
                marginTop: 22,
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: `${score}%`,
                  background: "linear-gradient(90deg, #0052FF, #6BA3FF, #34D399)",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              {stat("XP", String(data.xp ?? 120))}
              {stat("STREAK", `${data.streak ?? 5}d`, OG_COLORS.green)}
              {stat("BADGES", String(data.badges ?? 3), "#FBBF24")}
            </div>
          </div>
        </div>
        <OgFooter cta={personal ? "CHALLENGE THIS WALLET" : "SCAN YOUR WALLET"} />
      </div>
    </div>
  );
}

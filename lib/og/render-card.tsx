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
  const address = shortenAddress(
    data.address || "0x3799cafa388da047cAF7c999e31c844705FadfAe"
  );
  const title = data.title || address;
  const streak = data.streak ?? 7;
  const activeDays = data.activeDays ?? 47;
  const txCount = data.txs ?? 1248;
  const subtitle =
    data.subtitle || `${activeDays} active days · ${streak}d streak on Base`;

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
        <OgHeader label="ONCHAIN ACTIVITY" />
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
              BASE MAINNET VERIFIED
            </span>
            <span
              style={{
                color: OG_COLORS.text,
                fontSize: 44,
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
              {stat("TRANSACTIONS", txCount.toLocaleString())}
              {stat("ACTIVE DAYS", String(activeDays), OG_COLORS.green)}
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
              CURRENT STREAK
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
                {streak}
              </span>
              <span style={{ color: OG_COLORS.dim, fontSize: 27, fontWeight: 850, marginLeft: 10 }}>
                DAYS
              </span>
            </div>
            <span style={{ color: OG_COLORS.green, fontSize: 22, fontWeight: 900, marginTop: 10 }}>
              Daily Check-In Record
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
                  width: `${Math.min(100, streak * 5)}%`,
                  background: "linear-gradient(90deg, #0052FF, #6BA3FF, #34D399)",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              {stat("BOOSTS", String(data.boosts ?? 1))}
              {stat("STREAK", `${streak}d`, OG_COLORS.green)}
              {stat("NETWORK", "Base 8453", OG_COLORS.cyan)}
            </div>
          </div>
        </div>
        <OgFooter cta="CHECK ONCHAIN HABITS" />
      </div>
    </div>
  );
}

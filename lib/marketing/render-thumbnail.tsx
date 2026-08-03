import {
  OgBackground,
  OgFooter,
  OgHeader,
  OG_COLORS,
} from "@/lib/og/brand-kit";

export type OgTrendingToken = { sym: string; chg: string; vol: string };

/** Homepage-style link preview for X, Farcaster and other social crawlers. */
export function renderAppThumbnail(trending?: OgTrendingToken[]) {
  const rows =
    trending?.length
      ? trending.slice(0, 3)
      : [{ sym: "B20", chg: "LIVE", vol: "Base" }];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
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
        <OgHeader />
        <div style={{ display: "flex", flex: 1, gap: 34, minHeight: 0 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1.08,
              justifyContent: "center",
            }}
          >
            <span
              style={{
                color: OG_COLORS.cyan,
                fontSize: 13,
                fontWeight: 900,
                letterSpacing: "0.18em",
                marginBottom: 14,
              }}
            >
              THE BASE TRADING TERMINAL
            </span>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                color: OG_COLORS.text,
                fontSize: 58,
                fontWeight: 950,
                lineHeight: 0.98,
                letterSpacing: "-0.045em",
              }}
            >
              <span>Launch. Trade.</span>
              <span>
                Score on{" "}
                <span style={{ color: OG_COLORS.cyan }}>Base.</span>
              </span>
            </div>
            <span
              style={{
                color: OG_COLORS.muted,
                fontSize: 18,
                fontWeight: 650,
                lineHeight: 1.45,
                maxWidth: 560,
                marginTop: 20,
              }}
            >
              B20 launchpad, in-app swaps with USD quotes, weekly quest XP,
              on-chain badges, quests, and crypto gift cards.
            </span>
            <div style={{ display: "flex", gap: 9, marginTop: 24, flexWrap: "wrap" }}>
              {["B20 Launchpad", "In-app swaps", "Quests & badges", "Vouchers"].map((tag) => (
                <span
                  key={tag}
                  style={{
                    color: OG_COLORS.text,
                    fontSize: 11,
                    fontWeight: 800,
                    border: `1px solid ${OG_COLORS.border}`,
                    background: OG_COLORS.panel,
                    borderRadius: 999,
                    padding: "8px 12px",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 0.92 }}>
            <div
              style={{
                display: "flex",
                flex: 1,
                flexDirection: "column",
                padding: 20,
                borderRadius: 22,
                border: "1px solid rgba(107,163,255,0.30)",
                background: "rgba(255,255,255,0.055)",
                boxShadow: "0 28px 80px rgba(0,0,0,0.35)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 14,
                }}
              >
                <span
                  style={{
                    color: OG_COLORS.cyan,
                    fontSize: 11,
                    fontWeight: 900,
                    letterSpacing: "0.18em",
                  }}
                >
                  EXPLORE · TRENDING
                </span>
                <span style={{ color: OG_COLORS.dim, fontSize: 10 }}>BASE MAINNET</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {rows.map((t) => (
                  <div
                    key={t.sym}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "rgba(255,255,255,0.045)",
                      border: `1px solid ${OG_COLORS.border}`,
                      borderRadius: 12,
                      padding: "11px 13px",
                    }}
                  >
                    <span style={{ color: OG_COLORS.text, fontSize: 14, fontWeight: 900 }}>
                      ${t.sym}
                    </span>
                    <span style={{ color: OG_COLORS.dim, fontSize: 10 }}>Vol {t.vol}</span>
                    <span style={{ color: OG_COLORS.green, fontSize: 15, fontWeight: 900 }}>
                      {t.chg}
                    </span>
                  </div>
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 9,
                  marginTop: 12,
                  background: "rgba(0,82,255,0.12)",
                  border: "1px solid rgba(107,163,255,0.28)",
                  borderRadius: 14,
                  padding: "14px 16px",
                }}
              >
                <span
                  style={{
                    color: OG_COLORS.cyan,
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: "0.14em",
                  }}
                >
                  SMART ROUTE · AUTO
                </span>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ color: OG_COLORS.text, fontSize: 23, fontWeight: 900 }}>
                    ETH → TOKEN
                  </span>
                  <span style={{ color: OG_COLORS.green, fontSize: 12, fontWeight: 800 }}>
                    BEST QUOTE
                  </span>
                </div>
                <span style={{ color: OG_COLORS.muted, fontSize: 11, fontWeight: 650 }}>
                  Uniswap · Aerodrome · Slipstream · 0x Aggregator
                </span>
              </div>
            </div>
          </div>
        </div>
        <OgFooter cta="OPEN BASE ANALYTICS" />
      </div>
    </div>
  );
}

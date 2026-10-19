import {
  OgBackground,
  OgFooter,
  OgHeader,
  OG_COLORS,
} from "@/lib/og/brand-kit";

export type OgTrendingToken = {
  sym: string;
  chg: string;
  vol: string;
  type?: "stock" | "b20" | "token";
};

const DEFAULT_ROWS: OgTrendingToken[] = [
  { sym: "TSLA", chg: "+4.2%", vol: "$2.1M", type: "stock" },
  { sym: "B20", chg: "+18.5%", vol: "$540K", type: "b20" },
  { sym: "NVDA", chg: "+6.8%", vol: "$3.4M", type: "stock" },
];

/** Modern Blue Hour Meridian link preview for X, Farcaster, and social crawlers. */
export function renderAppThumbnail(trending?: OgTrendingToken[]) {
  const rows =
    trending && trending.length >= 2
      ? trending.slice(0, 3).map((t) => ({
          ...t,
          type:
            t.type ??
            (t.sym === "TSLA" || t.sym === "NVDA" || t.sym === "COIN" || t.sym === "SPY"
              ? "stock"
              : t.sym.startsWith("B20") || t.sym === "B20"
                ? "b20"
                : "token"),
        }))
      : DEFAULT_ROWS;

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
          padding: "26px 36px 20px",
          position: "relative",
          justifyContent: "space-between",
        }}
      >
        <OgHeader />

        <div
          style={{
            display: "flex",
            flex: 1,
            gap: 30,
            minHeight: 0,
            marginTop: 14,
            marginBottom: 14,
            alignItems: "stretch",
          }}
        >
          {/* Left Column: Hero Copy & Feature Ecosystem */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1.15,
              justifyContent: "center",
            }}
          >
            {/* Eyebrow Badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                border: "1px solid rgba(0, 82, 255, 0.45)",
                background: "rgba(0, 82, 255, 0.16)",
                borderRadius: 999,
                padding: "5px 12px",
                marginBottom: 10,
                alignSelf: "flex-start",
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: 6,
                  height: 6,
                  borderRadius: 99,
                  background: OG_COLORS.cyan,
                }}
              />
              <span
                style={{
                  color: "#60A5FA",
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: "0.14em",
                }}
              >
                THE ONCHAIN TRADING TERMINAL ON BASE
              </span>
            </div>

            {/* Big Headline */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                color: OG_COLORS.text,
                fontSize: 48,
                fontWeight: 950,
                lineHeight: 1.02,
                letterSpacing: "-0.04em",
              }}
            >
              <span>Trade Stocks.</span>
              <span>Launch B20 Tokens.</span>
              <span>
                Earn on <span style={{ color: OG_COLORS.cyan }}>Base.</span>
              </span>
            </div>

            {/* Subtitle */}
            <span
              style={{
                color: OG_COLORS.muted,
                fontSize: 15,
                fontWeight: 600,
                lineHeight: 1.45,
                maxWidth: 540,
                marginTop: 12,
              }}
            >
              Tokenized US equities ($TSLA, $NVDA, $COIN), vanity B20 token launches with instant
              50% creator fee share, multi-DEX smart swaps &amp; Morpho stock lending.
            </span>

            {/* 5 Capability Tags */}
            <div style={{ display: "flex", gap: 7, marginTop: 16, flexWrap: "wrap" }}>
              {[
                { label: "Tokenized Stocks", tag: "TSLA · NVDA" },
                { label: "B20 Vanity Launchpad", tag: "50% Fee Share" },
                { label: "Multi-DEX Swaps", tag: "Uniswap · Aero" },
                { label: "Lend & Stake", tag: "Morpho USDC" },
                { label: "Crypto Vouchers", tag: "Zero-Gas Gifts" },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    color: OG_COLORS.text,
                    fontSize: 11,
                    fontWeight: 800,
                    border: "1px solid rgba(255, 255, 255, 0.10)",
                    background: "rgba(15, 23, 42, 0.65)",
                    borderRadius: 9,
                    padding: "6px 11px",
                  }}
                >
                  <span>{item.label}</span>
                  <span style={{ color: OG_COLORS.cyan, fontSize: 10, fontWeight: 700 }}>
                    · {item.tag}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Live Market Terminal Card */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 0.85,
              justifyContent: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "16px 18px",
                borderRadius: 20,
                border: "1px solid rgba(0, 82, 255, 0.35)",
                background: "rgba(11, 21, 38, 0.90)",
                boxShadow: "0 28px 70px rgba(0,0,0,0.50)",
                gap: 10,
              }}
            >
              {/* Terminal Card Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      color: OG_COLORS.cyan,
                      fontSize: 11,
                      fontWeight: 900,
                      letterSpacing: "0.14em",
                    }}
                  >
                    LIVE MARKET RADAR
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    background: "rgba(16, 185, 129, 0.12)",
                    border: "1px solid rgba(52, 211, 153, 0.30)",
                    borderRadius: 999,
                    padding: "3px 8px",
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 99,
                      background: OG_COLORS.green,
                      display: "flex",
                    }}
                  />
                  <span
                    style={{
                      color: "#A7F3D0",
                      fontSize: 9,
                      fontWeight: 900,
                      letterSpacing: "0.08em",
                    }}
                  >
                    REAL-TIME DEX
                  </span>
                </div>
              </div>

              {/* 3 Live Asset Ticker Rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {rows.map((t) => (
                  <div
                    key={t.sym}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "rgba(255,255,255,0.045)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12,
                      padding: "9px 12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ color: OG_COLORS.text, fontSize: 15, fontWeight: 900 }}>
                        ${t.sym}
                      </span>
                      <span
                        style={{
                          color:
                            t.type === "stock"
                              ? "#60A5FA"
                              : t.type === "b20"
                                ? "#34D399"
                                : "#F472B6",
                          background:
                            t.type === "stock"
                              ? "rgba(0,82,255,0.18)"
                              : t.type === "b20"
                                ? "rgba(16,185,129,0.18)"
                                : "rgba(244,114,182,0.18)",
                          border: `1px solid ${
                            t.type === "stock"
                              ? "rgba(0,82,255,0.35)"
                              : t.type === "b20"
                                ? "rgba(16,185,129,0.35)"
                                : "rgba(244,114,182,0.35)"
                          }`,
                          borderRadius: 6,
                          fontSize: 9,
                          fontWeight: 800,
                          padding: "2px 6px",
                        }}
                      >
                        {t.type === "stock" ? "Equities" : t.type === "b20" ? "0xB200…" : "Token"}
                      </span>
                    </div>
                    <span style={{ color: OG_COLORS.muted, fontSize: 11, fontWeight: 650 }}>
                      Vol {t.vol}
                    </span>
                    <span style={{ color: OG_COLORS.green, fontSize: 14, fontWeight: 900 }}>
                      {t.chg}
                    </span>
                  </div>
                ))}
              </div>

              {/* Smart Routing & Fee Share Box */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                  background: "rgba(0,82,255,0.12)",
                  border: "1px solid rgba(96,165,250,0.30)",
                  borderRadius: 14,
                  padding: "11px 14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      color: OG_COLORS.cyan,
                      fontSize: 10,
                      fontWeight: 900,
                      letterSpacing: "0.12em",
                    }}
                  >
                    ⚡ SMART MULTI-DEX ROUTER
                  </span>
                  <span style={{ color: OG_COLORS.green, fontSize: 10, fontWeight: 900 }}>
                    BEST PRICE
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                  }}
                >
                  <span style={{ color: OG_COLORS.text, fontSize: 13, fontWeight: 900 }}>
                    Uniswap V3 · Aerodrome · Slipstream · 0x
                  </span>
                </div>
                <span style={{ color: OG_COLORS.muted, fontSize: 10, fontWeight: 650 }}>
                  Instant 50% swap fee share streamed to token creators
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

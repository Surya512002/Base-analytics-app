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
  yieldApy?: string;
  badge?: string;
};

type DisplayRow = {
  sym: string;
  name: string;
  chg: string;
  type: "stock" | "b20" | "token";
  badgeText: string;
  yieldInfo: string;
  vol?: string;
};

const DEFAULT_ROWS: DisplayRow[] = [
  {
    sym: "NVDAc",
    name: "NVIDIA Corp",
    chg: "+6.8%",
    type: "stock",
    badgeText: "EQUITY",
    yieldInfo: "1,070% APY · Beefy",
    vol: "$3.8M",
  },
  {
    sym: "AAPLc",
    name: "Apple Inc",
    chg: "+2.4%",
    type: "stock",
    badgeText: "EQUITY",
    yieldInfo: "78.1% APY · Beefy",
    vol: "$4.1M",
  },
  {
    sym: "TSLAc",
    name: "Tesla Inc",
    chg: "+5.1%",
    type: "stock",
    badgeText: "EQUITY",
    yieldInfo: "293% APY · Beefy",
    vol: "$2.9M",
  },
  {
    sym: "B20",
    name: "Vanity Mine",
    chg: "+18.5%",
    type: "b20",
    badgeText: "0xB200…",
    yieldInfo: "50% Fee Stream",
    vol: "$860K",
  },
];

/** Modern Cyber-Terminal link preview for X, Farcaster, and social crawlers. */
export function renderAppThumbnail(trending?: OgTrendingToken[]) {
  // If dynamic trending rows are supplied, merge the top trending with top yield vaults
  let rows: DisplayRow[] = DEFAULT_ROWS;

  if (trending && trending.length > 0) {
    const customRows: DisplayRow[] = [];
    // Include top 2 stock vaults
    customRows.push(DEFAULT_ROWS[0]); // NVDAc
    customRows.push(DEFAULT_ROWS[1]); // AAPLc

    // Include up to 2 trending items
    for (const t of trending.slice(0, 2)) {
      const isStock =
        t.type === "stock" ||
        t.sym.endsWith("c") ||
        t.sym === "TSLA" ||
        t.sym === "NVDA" ||
        t.sym === "COIN";
      const isB20 = t.type === "b20" || t.sym.startsWith("B20") || t.sym === "B20";

      customRows.push({
        sym: t.sym,
        name: isStock ? "Tokenized Stock" : isB20 ? "Vanity B20" : "Base Token",
        chg: t.chg || "+12.4%",
        type: isStock ? "stock" : isB20 ? "b20" : "token",
        badgeText: isStock ? "EQUITY" : isB20 ? "0xB200…" : "TOKEN",
        yieldInfo: isStock ? "Auto-Compound Yield" : "50% Fee Stream",
        vol: t.vol,
      });
    }

    if (customRows.length >= 3) {
      rows = customRows.slice(0, 4);
    }
  }

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
          padding: "24px 34px 18px",
          position: "relative",
          justifyContent: "space-between",
        }}
      >
        <OgHeader />

        <div
          style={{
            display: "flex",
            flex: 1,
            gap: 28,
            minHeight: 0,
            marginTop: 12,
            marginBottom: 12,
            alignItems: "stretch",
          }}
        >
          {/* Left Column: Hero Headline, Subtitle & 2x2 Feature Matrix */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1.15,
              justifyContent: "center",
            }}
          >
            {/* Eyebrow Pill */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                border: "1px solid rgba(0, 240, 255, 0.45)",
                background: "rgba(0, 82, 255, 0.18)",
                boxShadow: "0 0 16px rgba(0, 82, 255, 0.25)",
                borderRadius: 999,
                padding: "5px 13px",
                marginBottom: 9,
                alignSelf: "flex-start",
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: 7,
                  height: 7,
                  borderRadius: 99,
                  background: "#00F0FF",
                  boxShadow: "0 0 10px #00F0FF",
                }}
              />
              <span
                style={{
                  color: "#38BDF8",
                  fontSize: 10.5,
                  fontWeight: 900,
                  letterSpacing: "0.14em",
                }}
              >
                THE ONCHAIN EQUITIES &amp; YIELD TERMINAL
              </span>
            </div>

            {/* Big Impact Headline */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                color: OG_COLORS.text,
                fontSize: 47,
                fontWeight: 950,
                lineHeight: 1.03,
                letterSpacing: "-0.04em",
              }}
            >
              <span>Trade Real Stocks.</span>
              <span>Maximize Yield.</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span>On</span>
                <span
                  style={{
                    color: "#00F0FF",
                    textShadow: "0 0 30px rgba(0, 240, 255, 0.55)",
                  }}
                >
                  Base.
                </span>
              </div>
            </div>

            {/* Subtitle */}
            <span
              style={{
                color: OG_COLORS.muted,
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.42,
                maxWidth: 530,
                marginTop: 10,
              }}
            >
              Instant 24/5 liquidity for 260+ tokenized US equities ($NVDA, $AAPL, $TSLA). Auto-compounding vaults on Beefy &amp; Aerodrome (up to 1,070% APY), 3-mode B20 launchpad with 50% creator fee share, and smart multi-DEX routing.
            </span>

            {/* 2x2 High-Tech Feature Grid */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 7,
                marginTop: 14,
              }}
            >
              <div style={{ display: "flex", gap: 8 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flex: 1,
                    border: "1px solid rgba(0, 140, 255, 0.28)",
                    background: "rgba(15, 23, 42, 0.70)",
                    borderRadius: 10,
                    padding: "7px 11px",
                  }}
                >
                  <span style={{ fontSize: 13 }}>📈</span>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ color: OG_COLORS.text, fontSize: 11, fontWeight: 900 }}>
                      260+ Tokenized Equities
                    </span>
                    <span style={{ color: "#38BDF8", fontSize: 9.5, fontWeight: 700 }}>
                      1:1 Backed · 24/5 Liquidity
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flex: 1,
                    border: "1px solid rgba(16, 185, 129, 0.28)",
                    background: "rgba(15, 23, 42, 0.70)",
                    borderRadius: 10,
                    padding: "7px 11px",
                  }}
                >
                  <span style={{ fontSize: 13 }}>🌾</span>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ color: OG_COLORS.text, fontSize: 11, fontWeight: 900 }}>
                      Beefy &amp; Aero Vaults
                    </span>
                    <span style={{ color: "#34D399", fontSize: 9.5, fontWeight: 700 }}>
                      Auto-Compound up to 1,070% APY
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flex: 1,
                    border: "1px solid rgba(0, 240, 255, 0.28)",
                    background: "rgba(15, 23, 42, 0.70)",
                    borderRadius: 10,
                    padding: "7px 11px",
                  }}
                >
                  <span style={{ fontSize: 13 }}>⚡</span>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ color: OG_COLORS.text, fontSize: 11, fontWeight: 900 }}>
                      Multi-DEX Smart Swaps
                    </span>
                    <span style={{ color: "#38BDF8", fontSize: 9.5, fontWeight: 700 }}>
                      0.25% Fee · Aero &amp; Uniswap V3
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flex: 1,
                    border: "1px solid rgba(244, 114, 182, 0.28)",
                    background: "rgba(15, 23, 42, 0.70)",
                    borderRadius: 10,
                    padding: "7px 11px",
                  }}
                >
                  <span style={{ fontSize: 13 }}>🚀</span>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ color: OG_COLORS.text, fontSize: 11, fontWeight: 900 }}>
                      B20 Vanity Launchpad
                    </span>
                    <span style={{ color: "#F472B6", fontSize: 9.5, fontWeight: 700 }}>
                      50% Fee Stream · Base Vouchers
                    </span>
                  </div>
                </div>
              </div>
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
                padding: "15px 17px",
                borderRadius: 20,
                border: "1px solid rgba(0, 140, 255, 0.38)",
                background: "rgba(9, 18, 36, 0.92)",
                boxShadow: "0 24px 60px rgba(0,0,0,0.65), 0 0 35px rgba(0,82,255,0.18)",
                gap: 9,
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
                      color: "#00F0FF",
                      fontSize: 10.5,
                      fontWeight: 950,
                      letterSpacing: "0.14em",
                    }}
                  >
                    ⚡ LIVE MARKETS &amp; YIELD RADAR
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    background: "rgba(16, 185, 129, 0.15)",
                    border: "1px solid rgba(52, 211, 153, 0.35)",
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
                      fontWeight: 950,
                      letterSpacing: "0.08em",
                    }}
                  >
                    REAL-TIME ONCHAIN
                  </span>
                </div>
              </div>

              {/* 4 Live Asset / Vault Ticker Rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {rows.map((t) => (
                  <div
                    key={t.sym}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "rgba(255, 255, 255, 0.045)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: 11,
                      padding: "8px 11px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ color: OG_COLORS.text, fontSize: 14, fontWeight: 950 }}>
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
                              ? "rgba(0,82,255,0.40)"
                              : t.type === "b20"
                                ? "rgba(16,185,129,0.40)"
                                : "rgba(244,114,182,0.40)"
                          }`,
                          borderRadius: 5,
                          fontSize: 8.5,
                          fontWeight: 900,
                          padding: "1.5px 5px",
                        }}
                      >
                        {t.badgeText}
                      </span>
                    </div>

                    <span
                      style={{
                        color: t.type === "stock" ? "#34D399" : "#38BDF8",
                        fontSize: 10.5,
                        fontWeight: 800,
                      }}
                    >
                      {t.yieldInfo}
                    </span>

                    <span style={{ color: OG_COLORS.green, fontSize: 13, fontWeight: 950 }}>
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
                  gap: 4,
                  background: "rgba(0, 82, 255, 0.14)",
                  border: "1px solid rgba(0, 140, 255, 0.35)",
                  borderRadius: 12,
                  padding: "9px 12px",
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
                      color: "#00F0FF",
                      fontSize: 9.5,
                      fontWeight: 950,
                      letterSpacing: "0.12em",
                    }}
                  >
                    ⚡ MULTI-DEX &amp; YIELD ENGINE
                  </span>
                  <span
                    style={{
                      color: OG_COLORS.green,
                      fontSize: 9,
                      fontWeight: 950,
                      letterSpacing: "0.06em",
                    }}
                  >
                    0.25% SWAP FEE
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                  }}
                >
                  <span style={{ color: OG_COLORS.text, fontSize: 12, fontWeight: 900 }}>
                    Aerodrome · Uniswap V3 · Beefy · Slipstream
                  </span>
                </div>
                <span style={{ color: OG_COLORS.muted, fontSize: 9.5, fontWeight: 650 }}>
                  Instant 50% swap fee share streamed to token creators
                </span>
              </div>
            </div>
          </div>
        </div>

        <OgFooter cta="LAUNCH TERMINAL" />
      </div>
    </div>
  );
}

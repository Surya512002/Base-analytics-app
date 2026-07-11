import type { OgCardData } from "./types";
import {
  OgBackground,
  OgFooter,
  OgHeader,
  OG_COLORS,
} from "./brand-kit";

export function renderOgTokenCard(data: OgCardData) {
  const symbol = data.tokenSymbol ?? "TOKEN";
  const name = data.tokenName ?? "Base Token";
  const price = data.tokenPrice ?? "—";
  const change = data.tokenChange24h ?? 0;
  const mcap = data.tokenMcap ?? "—";
  const up = change >= 0;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, sans-serif",
        background: OG_COLORS.bg,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <OgBackground />
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          padding: "30px 40px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        <OgHeader label="LIVE MARKET" />
        <div style={{ display: "flex", flex: 1, gap: 34, minHeight: 0 }}>
          <div
            style={{
              display: "flex",
              flex: 1,
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                color: OG_COLORS.cyan,
                fontSize: 13,
                fontWeight: 900,
                letterSpacing: "0.18em",
              }}
            >
              TRADE ON BASE
            </span>
            <span
              style={{
                fontSize: 76,
                fontWeight: 950,
                color: OG_COLORS.text,
                marginTop: 12,
                lineHeight: 0.95,
                letterSpacing: "-0.055em",
              }}
            >
              ${symbol}
            </span>
            <span style={{ fontSize: 24, color: OG_COLORS.muted, marginTop: 12 }}>
              {name}
            </span>
            <div style={{ display: "flex", gap: 9, marginTop: 26 }}>
              {["Smart routing", "USD quotes", "In-app swaps"].map((tag) => (
                <span
                  key={tag}
                  style={{
                    color: OG_COLORS.text,
                    border: `1px solid ${OG_COLORS.border}`,
                    background: OG_COLORS.panel,
                    borderRadius: 999,
                    padding: "8px 12px",
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flex: 0.86,
              flexDirection: "column",
              justifyContent: "center",
              border: "1px solid rgba(107,163,255,0.30)",
              background: "rgba(255,255,255,0.055)",
              borderRadius: 24,
              padding: 26,
            }}
          >
            <span style={{ color: OG_COLORS.dim, fontSize: 11, fontWeight: 900 }}>
              CURRENT PRICE
            </span>
            <span
              style={{
                color: OG_COLORS.text,
                fontSize: 47,
                fontWeight: 950,
                letterSpacing: "-0.04em",
                marginTop: 6,
              }}
            >
              {price}
            </span>
            <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
              <div
                style={{
                  display: "flex",
                  flex: 1,
                  flexDirection: "column",
                  border: `1px solid ${OG_COLORS.border}`,
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <span style={{ color: OG_COLORS.dim, fontSize: 10 }}>24H</span>
                <span
                  style={{
                    color: up ? OG_COLORS.green : "#FB7185",
                    fontSize: 27,
                    fontWeight: 950,
                    marginTop: 4,
                  }}
                >
                  {up ? "+" : ""}
                  {change.toFixed(1)}%
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flex: 1,
                  flexDirection: "column",
                  border: `1px solid ${OG_COLORS.border}`,
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <span style={{ color: OG_COLORS.dim, fontSize: 10 }}>MARKET CAP</span>
                <span
                  style={{
                    color: OG_COLORS.cyan,
                    fontSize: 27,
                    fontWeight: 950,
                    marginTop: 4,
                  }}
                >
                  {mcap}
                </span>
              </div>
            </div>
          </div>
        </div>
        <OgFooter cta={`TRADE $${symbol}`} />
      </div>
    </div>
  );
}

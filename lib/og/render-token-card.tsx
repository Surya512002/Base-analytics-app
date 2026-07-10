import { BrandLogoMark, INK } from "@/lib/brand/logo-mark";
import type { OgCardData } from "./types";

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
        background: INK.deep,
        padding: 48,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 70% 45% at 50% -10%, rgba(255,255,255,0.04), transparent), #080808",
        }}
      />
      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <BrandLogoMark size={28} />
          <p
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: INK.dim,
              letterSpacing: "0.14em",
              margin: 0,
            }}
          >
            BASE ANALYTICS
          </p>
        </div>
        <h1
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: INK.ink,
            margin: "12px 0 4px",
            letterSpacing: "-0.03em",
          }}
        >
          ${symbol}
        </h1>
        <p style={{ fontSize: 26, color: INK.muted, margin: 0 }}>{name}</p>
        <div style={{ display: "flex", gap: 32, marginTop: 40 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <p style={{ fontSize: 13, color: INK.dim, margin: 0 }}>PRICE</p>
            <p style={{ fontSize: 34, fontWeight: 800, color: INK.ink, margin: "4px 0 0" }}>
              {price}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <p style={{ fontSize: 13, color: INK.dim, margin: 0 }}>24H</p>
            <p
              style={{
                fontSize: 34,
                fontWeight: 800,
                color: up ? "#4ade80" : "#fb7185",
                margin: "4px 0 0",
              }}
            >
              {up ? "+" : ""}
              {change.toFixed(1)}%
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <p style={{ fontSize: 13, color: INK.dim, margin: 0 }}>MCAP</p>
            <p style={{ fontSize: 34, fontWeight: 800, color: INK.ink, margin: "4px 0 0" }}>
              {mcap}
            </p>
          </div>
        </div>
        <p style={{ marginTop: "auto", fontSize: 16, color: INK.dim }}>
          Swap in-app · Uniswap + Aerodrome · USD quotes · B20 Launchpad
        </p>
      </div>
    </div>
  );
}

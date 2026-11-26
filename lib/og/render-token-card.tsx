import { Brand, Footer, Frame } from "./share-cards";
import { shortenAddress, type OgTokenCardData } from "./types";

const SOFT = "rgba(255,255,255,0.82)";

export function renderOgTokenCard(data: OgTokenCardData) {
  const { symbol, change24h: change } = data;
  const name = [data.name, shortenAddress(data.address)].filter(Boolean).join("  ·  ");
  const when = data.asOf ? `Price from DexScreener at ${data.asOf.toISOString().slice(11, 16)} UTC` : "No live price";
  const stats = [
    { label: "24 hours", value: change === undefined ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`, color: change === undefined ? SOFT : change >= 0 ? "#86EFAC" : "#FECACA" },
    { label: "Market cap", value: data.mcap ?? "—", color: "#FFFFFF" },
  ];

  return (
    <Frame>
      <Brand right="Token on Base" />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
        <div style={{ display: "flex", fontSize: symbol.length > 10 ? 64 : 88, fontWeight: 800, letterSpacing: -2 }}>${symbol}</div>
        <div style={{ display: "flex", fontSize: 28, color: SOFT, marginTop: 8 }}>{name}</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 44, marginTop: 30 }}>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 800 }}>{data.price ?? "—"}</div>
          {stats.map((s) => (
            <div key={s.label} style={{ display: "flex", flexDirection: "column", paddingBottom: 8 }}>
              <div style={{ display: "flex", fontSize: 22, color: SOFT }}>{s.label}</div>
              <div style={{ display: "flex", fontSize: 38, fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", fontSize: 22, color: SOFT, marginTop: 16 }}>{when}</div>
      </div>
      <Footer left="baseanalytics.app" cta="Open the token →" />
    </Frame>
  );
}

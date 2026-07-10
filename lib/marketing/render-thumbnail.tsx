function glass(extra?: Record<string, string | number>) {
  return {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 16,
    ...extra,
  };
}

function LogoMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect width="64" height="64" rx="14" fill="#0052FF" />
      <circle cx="51" cy="13" r="3.5" fill="#FFFFFF" />
      <path
        d="M32 15.5 45.5 24.5V43.5L32 52.5 18.5 43.5V24.5L32 15.5Z"
        stroke="#FFFFFF"
        strokeWidth="2.75"
        strokeLinejoin="round"
        fill="none"
      />
      <rect x="23.25" y="33.25" width="3.75" height="8.75" rx="0.5" fill="#FFFFFF" />
      <rect x="28.625" y="28" width="3.75" height="14" rx="0.5" fill="#FFFFFF" />
      <rect x="34" y="22.5" width="3.75" height="19.5" rx="0.5" fill="#FFFFFF" />
    </svg>
  );
}

const FEATURES = [
  { n: "01", title: "B20 Launchpad", desc: "Launch vanity tokens · seed Aerodrome liquidity" },
  { n: "02", title: "In-app swaps", desc: "Uniswap + Aerodrome · USD amounts · never leave" },
  { n: "03", title: "Wallet analytics", desc: "Onchain score · quests · badges · vouchers" },
] as const;

export type OgTrendingToken = { sym: string; chg: string; vol: string };

/** Default link preview — B20 launchpad + in-app trading on Base. */
export function renderAppThumbnail(trending?: OgTrendingToken[]) {
  const rows =
    trending?.length ?
      trending.slice(0, 3)
    : [{ sym: "B20", chg: "Live", vol: "Base" }];
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
        background: "#080808",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 85% 15%, rgba(0,82,255,0.2) 0%, transparent 55%), radial-gradient(circle at 10% 90%, rgba(16,185,129,0.12) 0%, transparent 50%), #080808",
          display: "flex",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: "28px 40px 22px",
          position: "relative",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <LogoMark size={40} />
            <span style={{ color: "#fff", fontSize: 17, fontWeight: 900, letterSpacing: "0.14em" }}>
              BASE ANALYTICS
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(16,185,129,0.12)",
              border: "1px solid rgba(16,185,129,0.35)",
              borderRadius: 100,
              padding: "6px 14px",
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: 99,
                background: "#10b981",
                boxShadow: "0 0 8px #10b981",
              }}
            />
            <span style={{ color: "#6ee7b7", fontSize: 10, fontWeight: 900, letterSpacing: "0.08em" }}>
              LIVE ON BASE
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, gap: 28, minHeight: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1.1, gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", flexWrap: "wrap", fontSize: 46, fontWeight: 900, lineHeight: 1.02 }}>
                <span style={{ color: "#fff", marginRight: 12 }}>Explore.</span>
                <span style={{ color: "#fff", marginRight: 12 }}>Trade.</span>
                <span
                  style={{
                    background: "linear-gradient(90deg, #60a5fa, #34d399)",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  Earn.
                </span>
              </div>
              <span style={{ color: "#e2e8f0", fontSize: 18, fontWeight: 800 }}>
                B20 launchpad + in-app swaps on Base
              </span>
              <span style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600, lineHeight: 1.45, maxWidth: 420 }}>
                Browse liquid tokens, swap via Uniswap &amp; Aerodrome with USD quotes, launch B20
                tokens, and scan your wallet — all in one mini-app.
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {FEATURES.map((f) => (
                <div
                  key={f.n}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    ...glass({ padding: "10px 14px", borderRadius: 14 }),
                  }}
                >
                  <span style={{ color: "#64748b", fontSize: 9, fontWeight: 900, letterSpacing: "0.1em", marginTop: 2 }}>
                    {f.n}
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ color: "#fff", fontSize: 13, fontWeight: 900 }}>{f.title}</span>
                    <span style={{ color: "#64748b", fontSize: 11, fontWeight: 600 }}>{f.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: "auto",
                background: "#ffffff",
                borderRadius: 14,
                padding: "14px 20px",
                fontSize: 14,
                fontWeight: 900,
                color: "#080808",
                boxShadow: "0 8px 32px rgba(255,255,255,0.12)",
              }}
            >
              Connect Wallet — Start Trading →
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", flex: 0.9, gap: 12 }}>
            <div
              style={{
                display: "flex",
                flex: 1,
                flexDirection: "column",
                ...glass({ padding: 22, borderRadius: 22 }),
                border: "1px solid rgba(0,82,255,0.28)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span style={{ color: "#60a5fa", fontSize: 10, fontWeight: 900, letterSpacing: "0.28em" }}>
                  TRENDING B20 · BASE
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                {rows.map((t) => (
                  <div
                    key={t.sym}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      padding: "12px 14px",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ color: "#fff", fontSize: 13, fontWeight: 900 }}>${t.sym}</span>
                      <span style={{ color: "#64748b", fontSize: 11, fontWeight: 600 }}>Vol {t.vol}</span>
                    </div>
                    <span style={{ color: "#34d399", fontSize: 18, fontWeight: 900 }}>{t.chg}</span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  background: "rgba(16,185,129,0.08)",
                  border: "1px solid rgba(16,185,129,0.25)",
                  borderRadius: 14,
                  padding: "14px 16px",
                }}
              >
                <span style={{ color: "#6ee7b7", fontSize: 10, fontWeight: 900, letterSpacing: "0.12em" }}>
                  SWAP PANEL
                </span>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ color: "#fff", fontSize: 22, fontWeight: 900 }}>0.01 ETH</span>
                  <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 700 }}>≈ $25.00</span>
                </div>
                <span style={{ color: "#64748b", fontSize: 11, fontWeight: 600 }}>
                  Route: Auto · Uniswap or Aerodrome best quote
                </span>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                {["Uniswap", "Aerodrome", "B20", "Basename", "Quests"].map((tag) => (
                  <span
                    key={tag}
                    style={{
                      color: "#94a3b8",
                      fontSize: 10,
                      fontWeight: 800,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 99,
                      padding: "5px 12px",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            padding: "10px 20px",
          }}
        >
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 900 }}>
            B20 · Swaps · Analytics · Vouchers · Base mini-app
          </span>
          <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700 }}>
            base-analytics-app.vercel.app
          </span>
        </div>
      </div>
    </div>
  );
}

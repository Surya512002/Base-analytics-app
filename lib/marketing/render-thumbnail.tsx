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

const MARKETS = [
  { asset: "BTC", prob: 58, price: "$97,240", dur: "1H" },
  { asset: "ETH", prob: 44, price: "$3,612", dur: "4H" },
  { asset: "SOL", prob: 62, price: "$148", dur: "Daily" },
] as const;

const FEATURES = [
  { n: "01", title: "Crypto Prediction Market", desc: "BTC · ETH · SOL — 15m, hourly, 4h & daily rounds" },
  { n: "02", title: "Trade & earn XP", desc: "Every trade counts toward quests & leaderboard" },
  { n: "03", title: "Vouchers & analytics", desc: "Gift cards, wallet scan & check-in rewards" },
] as const;

/** Link preview — matches the predictions-first homepage. */
export function renderAppThumbnail() {
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
        background: "#020508",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 85% 15%, rgba(0,229,255,0.18) 0%, transparent 55%), radial-gradient(circle at 10% 90%, rgba(255,51,102,0.14) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(16,185,129,0.08) 0%, transparent 60%), #020508",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.22,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
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
        {/* Header */}
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
              12 MARKETS LIVE · BASE
            </span>
          </div>
        </div>

        {/* Main */}
        <div style={{ display: "flex", flex: 1, gap: 28, minHeight: 0 }}>
          {/* LEFT — Hero */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1.1, gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", flexWrap: "wrap", fontSize: 48, fontWeight: 900, lineHeight: 1.02 }}>
                <span style={{ color: "#fff", marginRight: 12 }}>Crypto</span>
                <span
                  style={{
                    background: "linear-gradient(90deg, #60a5fa, #22d3ee)",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  Predictions
                </span>
              </div>
              <span style={{ color: "#34d399", fontSize: 20, fontWeight: 800 }}>
                Trade the market. Earn XP. Win USDC.
              </span>
              <span style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600, lineHeight: 1.45, maxWidth: 420 }}>
                Hourly, 4-hour & daily BTC/ETH/SOL rounds with live YES/NO odds — Polymarket-style CPMM on Base.
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
                    border: "1px solid rgba(255,255,255,0.1)",
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
                background: "linear-gradient(135deg, #ff4d7a, #3d7bff)",
                borderRadius: 14,
                padding: "14px 20px",
                fontSize: 14,
                fontWeight: 900,
                color: "#fff",
                boxShadow: "0 8px 32px rgba(61,123,255,0.35)",
              }}
            >
              Connect Wallet — Start Trading →
            </div>
          </div>

          {/* RIGHT — Live markets card */}
          <div style={{ display: "flex", flexDirection: "column", flex: 0.9, gap: 12 }}>
            <div
              style={{
                display: "flex",
                flex: 1,
                flexDirection: "column",
                ...glass({ padding: 22, borderRadius: 22 }),
                border: "1px solid rgba(16,185,129,0.28)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(16,185,129,0.12)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span style={{ color: "#34d399", fontSize: 14 }}>▲</span>
                <span style={{ color: "#34d399", fontSize: 10, fontWeight: 900, letterSpacing: "0.28em" }}>
                  LIVE ON BASE
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                {MARKETS.map((m) => (
                  <div
                    key={m.asset}
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
                      <span style={{ color: "#fff", fontSize: 13, fontWeight: 900 }}>
                        {m.asset} · {m.dur}
                      </span>
                      <span style={{ color: "#64748b", fontSize: 11, fontWeight: 600 }}>{m.price}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                      <span style={{ color: "#34d399", fontSize: 22, fontWeight: 900 }}>{m.prob}%</span>
                      <span style={{ color: "#64748b", fontSize: 9, fontWeight: 800, letterSpacing: "0.08em" }}>
                        YES
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <p style={{ margin: "0 0 12px", color: "#cbd5e1", fontSize: 12, fontWeight: 600, lineHeight: 1.45 }}>
                CPMM pricing · Chainlink resolution · $1 USDC per winning share
              </p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["BTC", "ETH", "SOL", "CPMM", "Chainlink"].map((tag) => (
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

            {/* Season progress strip */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                ...glass({ padding: "12px 16px", borderRadius: 14 }),
                border: "1px solid rgba(96,165,250,0.25)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#64748b", fontSize: 9, fontWeight: 900, letterSpacing: "0.12em" }}>
                  SEASON 1: PREDICTIONS
                </span>
                <span style={{ color: "#60a5fa", fontSize: 10, fontWeight: 900 }}>Quests · XP · USDC</span>
              </div>
              <div
                style={{
                  height: 6,
                  background: "#1e293b",
                  borderRadius: 99,
                  overflow: "hidden",
                  display: "flex",
                }}
              >
                <div
                  style={{
                    width: "62%",
                    height: "100%",
                    background: "linear-gradient(90deg, #f43f5e, #22d3ee)",
                    borderRadius: 99,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(90deg, rgba(0,82,255,0.22), rgba(16,185,129,0.15))",
            border: "1px solid rgba(34,211,238,0.22)",
            borderRadius: 12,
            padding: "10px 20px",
          }}
        >
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 900 }}>
            Predictions · Quests · Wallet analytics · Base mini-app
          </span>
          <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700 }}>
            base-analytics-app.vercel.app
          </span>
        </div>
      </div>
    </div>
  );
}

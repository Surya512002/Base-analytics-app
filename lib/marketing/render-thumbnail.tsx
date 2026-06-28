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

/** Link preview — Base Voucher hero + x402 payment tx panel + analytics strip. */
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
        background: "#071220",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 65% 50% at 25% 40%, rgba(0,229,255,0.2), transparent), radial-gradient(ellipse 50% 45% at 95% 20%, rgba(251,191,36,0.15), transparent), radial-gradient(ellipse 45% 40% at 80% 90%, rgba(255,51,102,0.14), transparent), #071220",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.25,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          display: "flex",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: "28px 40px 24px",
          position: "relative",
          gap: 14,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <LogoMark size={40} />
            <span style={{ color: "#fff", fontSize: 18, fontWeight: 900, letterSpacing: "0.12em" }}>
              BASE ANALYTICS
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(16,185,129,0.1)",
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

        {/* Main body */}
        <div style={{ display: "flex", flex: 1, gap: 24, minHeight: 0 }}>
          {/* LEFT — Voucher hero (primary) */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1.35, gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ color: "#22d3ee", fontSize: 11, fontWeight: 900, letterSpacing: "0.22em" }}>
                BASE VOUCHER
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", fontSize: 44, fontWeight: 900, lineHeight: 1.05 }}>
                <span style={{ color: "#fff", marginRight: 10 }}>Crypto</span>
                <span style={{ color: "#60a5fa" }}>Gift Cards</span>
              </div>
              <span style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600 }}>
                Create · redeem · share ETH & USDC vouchers onchain
              </span>
            </div>

            {/* Large voucher card */}
            <div
              style={{
                display: "flex",
                flex: 1,
                flexDirection: "column",
                ...glass({ padding: 20, borderRadius: 22 }),
                border: "2px solid rgba(34,211,238,0.35)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.45), 0 0 50px rgba(0,82,255,0.15)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flex: 1,
                  flexDirection: "column",
                  background:
                    "linear-gradient(135deg, rgba(37,99,235,0.5), rgba(34,211,238,0.22), rgba(139,92,246,0.32))",
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: 18,
                  padding: 22,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ color: "#94a3b8", fontSize: 10, fontWeight: 900, letterSpacing: "0.14em" }}>
                      CARD ID · 12-3
                    </span>
                    <span
                      style={{
                        color: "#fff",
                        fontSize: 15,
                        fontWeight: 700,
                        fontFamily: "monospace",
                        letterSpacing: "0.06em",
                      }}
                    >
                      K7M2P-9XQ4R-8N3WT-5J6YH
                    </span>
                  </div>
                  <span
                    style={{
                      color: "#6ee7b7",
                      fontSize: 10,
                      fontWeight: 900,
                      background: "rgba(16,185,129,0.18)",
                      border: "1px solid rgba(16,185,129,0.4)",
                      borderRadius: 99,
                      padding: "6px 12px",
                    }}
                  >
                    REDEEMABLE
                  </span>
                </div>

                <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ color: "#94a3b8", fontSize: 10, fontWeight: 800 }}>VOUCHER VALUE</span>
                    <span style={{ color: "#fff", fontSize: 52, fontWeight: 900, lineHeight: 1 }}>25.00</span>
                    <span style={{ color: "#22d3ee", fontSize: 16, fontWeight: 800, marginTop: 4 }}>USDC on Base</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <span style={{ fontSize: 36 }}>🎁</span>
                    <span style={{ color: "#e2e8f0", fontSize: 11, fontWeight: 700, fontStyle: "italic", maxWidth: 180, textAlign: "right" }}>
                      &quot;Happy day! Enjoy your gift.&quot;
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                {["Create batch", "Redeem", "Share card"].map((action) => (
                  <div
                    key={action}
                    style={{
                      display: "flex",
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      background:
                        action === "Create batch"
                          ? "linear-gradient(135deg, #ff4d7a, #3d7bff)"
                          : "rgba(255,255,255,0.07)",
                      border: action === "Create batch" ? "none" : "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 12,
                      padding: "10px 8px",
                      fontSize: 11,
                      fontWeight: 900,
                      color: "#fff",
                    }}
                  >
                    {action}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT — x402 payments (secondary but visible tx UI) */}
          <div style={{ display: "flex", flexDirection: "column", flex: 0.85, gap: 12 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                ...glass({ padding: 18, borderRadius: 20 }),
                border: "1px solid rgba(251,191,36,0.35)",
                background: "rgba(251,191,36,0.06)",
                flex: 1,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    background: "rgba(251,191,36,0.15)",
                    border: "1px solid rgba(251,191,36,0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                  }}
                >
                  ⚡
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ color: "#fff", fontSize: 16, fontWeight: 900 }}>x402 Payment</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span
                      style={{
                        color: "#22d3ee",
                        fontSize: 9,
                        fontWeight: 900,
                        background: "rgba(34,211,238,0.12)",
                        border: "1px solid rgba(34,211,238,0.3)",
                        borderRadius: 99,
                        padding: "3px 8px",
                      }}
                    >
                      HTTP 402 · Base
                    </span>
                    <span
                      style={{
                        color: "#fda4af",
                        fontSize: 9,
                        fontWeight: 900,
                        background: "rgba(255,51,102,0.12)",
                        border: "1px solid rgba(255,51,102,0.3)",
                        borderRadius: 99,
                        padding: "3px 8px",
                      }}
                    >
                      DECENTRALIZED
                    </span>
                  </div>
                </div>
              </div>

              <p style={{ margin: "0 0 12px", color: "#94a3b8", fontSize: 12, fontWeight: 600, lineHeight: 1.4 }}>
                Pay-per-use micropayments — no accounts, settled onchain via HTTP 402.
              </p>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(135deg, #ff4d7a, #3d7bff)",
                  borderRadius: 14,
                  padding: "12px 16px",
                  fontSize: 13,
                  fontWeight: 900,
                  color: "#fff",
                  marginBottom: 14,
                  boxShadow: "0 6px 24px rgba(255,77,122,0.3)",
                }}
              >
                ⚡ Pay 0.005 USDC
              </div>

              <span style={{ color: "#64748b", fontSize: 9, fontWeight: 900, letterSpacing: "0.14em", marginBottom: 8 }}>
                RECENT x402 SETTLEMENTS
              </span>

              {[
                { amount: "0.005 USDC", hash: "0x8f3a…c12e", status: "Confirmed", time: "2m ago" },
                { amount: "0.005 USDC", hash: "0x2b91…7f4a", status: "Confirmed", time: "1h ago" },
              ].map((tx) => (
                <div
                  key={tx.hash}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    ...glass({ padding: "10px 12px", borderRadius: 12 }),
                    marginBottom: 8,
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ color: "#fff", fontSize: 12, fontWeight: 800 }}>{tx.amount}</span>
                    <span style={{ color: "#64748b", fontSize: 10, fontWeight: 600, fontFamily: "monospace" }}>
                      {tx.hash} ↗
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                    <span style={{ color: "#6ee7b7", fontSize: 10, fontWeight: 900 }}>✓ {tx.status}</span>
                    <span style={{ color: "#475569", fontSize: 9, fontWeight: 600 }}>{tx.time}</span>
                  </div>
                </div>
              ))}

              <div
                style={{
                  display: "flex",
                  marginTop: "auto",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingTop: 10,
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <span style={{ color: "#fbbf24", fontSize: 11, fontWeight: 800 }}>2 payments</span>
                <span style={{ color: "#475569", fontSize: 11 }}>·</span>
                <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600 }}>View on Basescan ↗</span>
              </div>
            </div>

            {/* Analytics — compact tertiary */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                ...glass({ padding: "12px 16px", borderRadius: 14 }),
                border: "1px solid rgba(244,63,94,0.2)",
              }}
            >
              <span style={{ fontSize: 20 }}>📊</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ color: "#fff", fontSize: 12, fontWeight: 900 }}>Onchain Analytics</span>
                <span style={{ color: "#64748b", fontSize: 10, fontWeight: 600 }}>
                  Free wallet scan · badges · leaderboard
                </span>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <span style={{ color: "#22d3ee", fontSize: 18, fontWeight: 900 }}>72</span>
                <span style={{ color: "#475569", fontSize: 9, fontWeight: 700 }}>/100</span>
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
            background: "linear-gradient(90deg, rgba(0,82,255,0.25), rgba(255,51,102,0.18))",
            border: "1px solid rgba(34,211,238,0.28)",
            borderRadius: 12,
            padding: "10px 20px",
          }}
        >
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 900 }}>
            Vouchers first · x402 payments · wallet analytics
          </span>
          <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700 }}>
            base-analytics-app.vercel.app
          </span>
        </div>
      </div>
    </div>
  );
}

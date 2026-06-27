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
  { icon: "📊", label: "Onchain Score", value: "72/100" },
  { icon: "🎁", label: "Crypto Gift Cards", value: "ETH & USDC" },
  { icon: "⚡", label: "x402 Payments", value: "Live on Base" },
] as const;

export function renderAppThumbnail() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
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
            "radial-gradient(ellipse 70% 55% at 15% 20%, rgba(0,82,255,0.45), transparent), radial-gradient(ellipse 55% 45% at 90% 85%, rgba(255,51,102,0.28), transparent), #071220",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.35,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          display: "flex",
        }}
      />

      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          padding: "40px 48px",
          position: "relative",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 40,
        }}
      >
        {/* Left — brand & copy */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, maxWidth: 560 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
            <LogoMark size={56} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  color: "#fff",
                  fontSize: 28,
                  fontWeight: 900,
                  letterSpacing: "0.12em",
                }}
              >
                BASE ANALYTICS
              </span>
              <span style={{ color: "#64748b", fontSize: 13, fontWeight: 600, marginTop: 4 }}>
                Wallet intelligence on Base
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 20,
              ...glass({ borderRadius: 100, padding: "8px 16px", alignSelf: "flex-start" }),
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 99,
                background: "#10b981",
                boxShadow: "0 0 8px #10b981",
              }}
            />
            <span style={{ color: "#fda4af", fontSize: 11, fontWeight: 900, letterSpacing: "0.08em" }}>
              x402 LIVE · DECENTRALIZED ON BASE
            </span>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              margin: 0,
              fontSize: 52,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              color: "#fff",
            }}
          >
            <span style={{ marginRight: 12 }}>What&apos;s your</span>
            <span style={{ color: "#22d3ee" }}>onchain rank?</span>
          </div>

          <p
            style={{
              margin: "16px 0 28px",
              fontSize: 18,
              lineHeight: 1.45,
              color: "#94a3b8",
              fontWeight: 500,
              maxWidth: 480,
            }}
          >
            Free wallet scan, badges, quests & leaderboard — plus crypto gift cards anyone can redeem on Base.
          </p>

          <div style={{ display: "flex", gap: 12 }}>
            {FEATURES.map((f) => (
              <div
                key={f.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  ...glass({ padding: "12px 16px", borderRadius: 14, flex: 1 }),
                }}
              >
                <span style={{ fontSize: 20 }}>{f.icon}</span>
                <span style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 800 }}>{f.label}</span>
                <span style={{ color: "#22d3ee", fontSize: 11, fontWeight: 700 }}>{f.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right — dashboard preview card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 380,
            flexShrink: 0,
            ...glass({ padding: 20, borderRadius: 24 }),
            boxShadow: "0 24px 80px rgba(0,0,0,0.5), 0 0 40px rgba(0,82,255,0.15)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ color: "#64748b", fontSize: 10, fontWeight: 800, letterSpacing: "0.15em" }}>
              ONCHAIN SCORE
            </span>
            <span
              style={{
                color: "#fda4af",
                fontSize: 10,
                fontWeight: 800,
                background: "rgba(255,51,102,0.12)",
                border: "1px solid rgba(255,51,102,0.35)",
                borderRadius: 99,
                padding: "4px 10px",
              }}
            >
              Base Shark 🦈
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 20 }}>
            <span style={{ color: "#fff", fontSize: 72, fontWeight: 900, lineHeight: 1 }}>72</span>
            <span style={{ color: "#475569", fontSize: 28, fontWeight: 800 }}>/100</span>
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Active Days", val: "147" },
              { label: "Txs", val: "1.2k" },
              { label: "Badges", val: "4" },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  ...glass({ padding: "10px 12px", borderRadius: 12 }),
                }}
              >
                <p style={{ margin: 0, color: "#64748b", fontSize: 9, fontWeight: 700 }}>{s.label}</p>
                <p style={{ margin: "4px 0 0", color: "#fff", fontSize: 18, fontWeight: 900 }}>{s.val}</p>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              ...glass({ padding: 14, borderRadius: 14 }),
              border: "1px solid rgba(34,211,238,0.25)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>🎁</span>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ color: "#fff", fontSize: 13, fontWeight: 800 }}>Base Voucher</span>
                <span style={{ color: "#22d3ee", fontSize: 11, fontWeight: 600 }}>
                  Send ETH or USDC gift cards onchain
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #ff4d7a, #3d7bff)",
              borderRadius: 14,
              padding: "14px 20px",
              fontSize: 14,
              fontWeight: 900,
              color: "#fff",
              boxShadow: "0 8px 32px rgba(255,77,122,0.35)",
            }}
          >
            Connect Wallet — Free
          </div>
        </div>
      </div>
    </div>
  );
}

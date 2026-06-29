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
    </svg>
  );
}

/** OG / Farcaster frame image for /redeem */
export function renderRedeemThumbnail() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        fontFamily: "system-ui, sans-serif",
        background: "#040a14",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 60% 50% at 30% 30%, rgba(16,185,129,0.22), transparent), radial-gradient(ellipse 50% 45% at 85% 25%, rgba(139,92,246,0.2), transparent), radial-gradient(ellipse 45% 40% at 70% 85%, rgba(46,232,255,0.15), transparent), #040a14",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", padding: "36px 44px", position: "relative", height: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <LogoMark size={44} />
          <span style={{ color: "#fff", fontSize: 20, fontWeight: 900, letterSpacing: "0.1em" }}>
            BASE ANALYTICS
          </span>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            gap: 28,
            alignItems: "center",
          }}
        >
          <div style={{ flex: 1 }}>
            <p style={{ color: "#2ee8ff", fontSize: 13, fontWeight: 900, letterSpacing: "0.2em", margin: 0 }}>
              BASE VOUCHER
            </p>
            <h1 style={{ color: "#fff", fontSize: 52, fontWeight: 900, lineHeight: 1.05, margin: "12px 0 16px" }}>
              Redeem your
              <br />
              gift card
            </h1>
            <p style={{ color: "#94a8c0", fontSize: 20, fontWeight: 600, margin: 0, maxWidth: 420 }}>
              Claim ETH or USDC on Base — fully onchain, no middlemen.
            </p>
          </div>

          <div
            style={{
              width: 280,
              height: 170,
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "linear-gradient(135deg, #0d3d2e 0%, #111827 100%)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.5), 0 0 40px rgba(16,185,129,0.2)",
              padding: 24,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <p style={{ color: "#64748b", fontSize: 11, fontWeight: 800, letterSpacing: "0.15em", margin: 0 }}>
              CARD ID · 12-3
            </p>
            <p style={{ color: "#fff", fontSize: 36, fontWeight: 900, margin: 0 }}>$25.00</p>
            <p style={{ color: "#10b981", fontSize: 12, fontWeight: 900, margin: 0 }}>USDC · REDEEMABLE</p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "14px 24px",
            borderRadius: 14,
            background: "linear-gradient(135deg, #ff3d6e, #8b5cf6)",
            color: "#fff",
            fontSize: 18,
            fontWeight: 900,
            marginTop: 8,
          }}
        >
          Redeem Gift Card →
        </div>
      </div>
    </div>
  );
}

export const OG_VERSION = "15";

export const OG_COLORS = {
  bg: "#030712",
  canvas: "#050B17",
  card: "rgba(11, 21, 38, 0.85)",
  panel: "rgba(255, 255, 255, 0.05)",
  border: "rgba(255, 255, 255, 0.10)",
  borderAccent: "rgba(0, 82, 255, 0.35)",
  blue: "#0052FF",
  cyan: "#38BDF8",
  blueLight: "#60A5FA",
  green: "#10B981",
  greenLight: "#34D399",
  text: "#F8FAFC",
  muted: "#94A3B8",
  dim: "#64748B",
} as const;

export function OgLogo({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect width="64" height="64" rx="16" fill={OG_COLORS.blue} />
      <circle cx="51" cy="13" r="3.5" fill="#FFFFFF" />
      <path
        d="M32 15.5 45.5 24.5V43.5L32 52.5 18.5 43.5V24.5L32 15.5Z"
        stroke="#FFFFFF"
        strokeWidth="2.75"
        strokeLinejoin="round"
      />
      <rect x="23.25" y="33.25" width="3.75" height="8.75" rx="0.5" fill="#FFFFFF" />
      <rect x="28.625" y="28" width="3.75" height="14" rx="0.5" fill="#FFFFFF" />
      <rect x="34" y="22.5" width="3.75" height="19.5" rx="0.5" fill="#FFFFFF" />
    </svg>
  );
}

export function OgBackground() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        background: "#030712",
      }}
    >
      {/* Top right large Base Blue sphere glow */}
      <div
        style={{
          position: "absolute",
          top: "-15%",
          right: "-10%",
          width: 750,
          height: 600,
          display: "flex",
          background:
            "radial-gradient(circle, rgba(0, 82, 255, 0.35) 0%, rgba(59, 130, 246, 0.15) 40%, transparent 70%)",
        }}
      />
      {/* Bottom left cyan & emerald glow */}
      <div
        style={{
          position: "absolute",
          bottom: "-20%",
          left: "-10%",
          width: 650,
          height: 550,
          display: "flex",
          background:
            "radial-gradient(circle, rgba(14, 165, 233, 0.22) 0%, rgba(16, 185, 129, 0.10) 40%, transparent 70%)",
        }}
      />
      {/* Subtle center ambient violet glow */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "25%",
          width: 500,
          height: 400,
          display: "flex",
          background:
            "radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 65%)",
        }}
      />
      {/* Inset perimeter border */}
      <div
        style={{
          position: "absolute",
          inset: 12,
          display: "flex",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 24,
        }}
      />
    </div>
  );
}

export function OgHeader({ label = "BASE MAINNET · 8453" }: { label?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <OgLogo size={46} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              color: OG_COLORS.text,
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: "0.06em",
              lineHeight: 1.1,
            }}
          >
            BASE ANALYTICS
          </span>
          <span style={{ color: OG_COLORS.muted, fontSize: 12, fontWeight: 700, marginTop: 2 }}>
            Tokenized Stocks · B20 Launchpad · Multi-DEX Swaps · Lending
          </span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            border: "1px solid rgba(0, 82, 255, 0.40)",
            background: "rgba(0, 82, 255, 0.15)",
            borderRadius: 999,
            padding: "7px 13px",
          }}
        >
          <span
            style={{
              color: "#60A5FA",
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: "0.06em",
            }}
          >
            50% CREATOR FEE SHARE
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            border: "1px solid rgba(52, 211, 153, 0.35)",
            background: "rgba(16, 185, 129, 0.12)",
            borderRadius: 999,
            padding: "7px 13px",
          }}
        >
          <div
            style={{
              display: "flex",
              width: 8,
              height: 8,
              borderRadius: 99,
              background: OG_COLORS.green,
            }}
          />
          <span
            style={{
              color: "#A7F3D0",
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: "0.06em",
            }}
          >
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}

export function OgFooter({ cta = "LAUNCH BASE ANALYTICS" }: { cta?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        border: "1px solid rgba(255, 255, 255, 0.10)",
        background: "rgba(15, 23, 42, 0.70)",
        borderRadius: 16,
        padding: "12px 20px",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ color: OG_COLORS.muted, fontSize: 13, fontWeight: 700 }}>
          Built on Base · Non-Custodial · Instant Onchain Settlement
        </span>
        <span style={{ color: OG_COLORS.dim, fontSize: 12 }}>·</span>
        <span style={{ color: OG_COLORS.cyan, fontSize: 12, fontWeight: 800 }}>
          Uniswap V3 · Aerodrome · Slipstream · Morpho · 0x
        </span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: OG_COLORS.blue,
          borderRadius: 10,
          padding: "7px 16px",
          color: "#FFFFFF",
          fontSize: 13,
          fontWeight: 900,
          letterSpacing: "0.04em",
        }}
      >
        <span>{cta}</span>
        <span>→</span>
      </div>
    </div>
  );
}

export const OG_VERSION = "21";

export const OG_COLORS = {
  bg: "#030712",
  canvas: "#050B17",
  card: "rgba(9, 18, 36, 0.88)",
  cardElevated: "rgba(14, 26, 52, 0.94)",
  panel: "rgba(255, 255, 255, 0.05)",
  border: "rgba(255, 255, 255, 0.10)",
  borderAccent: "rgba(0, 82, 255, 0.40)",
  borderCyan: "rgba(0, 240, 255, 0.35)",
  borderGreen: "rgba(16, 185, 129, 0.35)",
  blue: "#0052FF",
  cyan: "#38BDF8",
  cyanElectric: "#00F0FF",
  blueLight: "#60A5FA",
  green: "#10B981",
  greenLight: "#34D399",
  amber: "#F59E0B",
  purple: "#8B5CF6",
  text: "#F8FAFC",
  muted: "#94A3B8",
  dim: "#64748B",
} as const;

export function OgLogo({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="ogLogoGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0052FF" />
          <stop offset="100%" stopColor="#0038B8" />
        </linearGradient>
        <linearGradient id="ogLogoAccent" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00F0FF" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#ogLogoGrad)" />
      <rect x="1" y="1" width="62" height="62" rx="15" stroke="rgba(255,255,255,0.20)" strokeWidth="1.5" />
      <circle cx="51" cy="13" r="3.5" fill="#00F0FF" />
      <path
        d="M32 15.5 45.5 24.5V43.5L32 52.5 18.5 43.5V24.5L32 15.5Z"
        stroke="#FFFFFF"
        strokeWidth="2.75"
        strokeLinejoin="round"
      />
      <rect x="23.25" y="33.25" width="3.75" height="8.75" rx="0.75" fill="#FFFFFF" />
      <rect x="28.625" y="27.5" width="3.75" height="14.5" rx="0.75" fill="#FFFFFF" />
      <rect x="34" y="21.5" width="3.75" height="20.5" rx="0.75" fill="url(#ogLogoAccent)" />
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
          top: "-18%",
          right: "-12%",
          width: 820,
          height: 640,
          display: "flex",
          background:
            "radial-gradient(circle, rgba(0, 82, 255, 0.40) 0%, rgba(59, 130, 246, 0.18) 38%, transparent 70%)",
        }}
      />
      {/* Bottom left cyan & emerald glow */}
      <div
        style={{
          position: "absolute",
          bottom: "-22%",
          left: "-12%",
          width: 720,
          height: 580,
          display: "flex",
          background:
            "radial-gradient(circle, rgba(0, 240, 255, 0.24) 0%, rgba(16, 185, 129, 0.14) 38%, transparent 68%)",
        }}
      />
      {/* Center ambient indigo/violet glow */}
      <div
        style={{
          position: "absolute",
          top: "28%",
          left: "22%",
          width: 580,
          height: 440,
          display: "flex",
          background:
            "radial-gradient(circle, rgba(99, 102, 241, 0.09) 0%, transparent 65%)",
        }}
      />

      {/* Cyber Grid Pattern */}
      <svg
        width="1200"
        height="630"
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.22,
        }}
      >
        <defs>
          <pattern id="ogCyberGrid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path
              d="M 60 0 L 0 0 0 60"
              fill="none"
              stroke="rgba(0, 160, 255, 0.35)"
              strokeWidth="0.8"
            />
            <circle cx="60" cy="0" r="1.5" fill="rgba(0, 240, 255, 0.6)" />
          </pattern>
        </defs>
        <rect width="1200" height="630" fill="url(#ogCyberGrid)" />
      </svg>

      {/* Outer frame perimeter border */}
      <div
        style={{
          position: "absolute",
          inset: 12,
          display: "flex",
          border: "1px solid rgba(255, 255, 255, 0.10)",
          borderRadius: 24,
        }}
      />

      {/* Top-left corner glowing cyan accent tick */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          width: 90,
          height: 2,
          display: "flex",
          background: "linear-gradient(90deg, #00F0FF 0%, transparent 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          width: 2,
          height: 90,
          display: "flex",
          background: "linear-gradient(180deg, #00F0FF 0%, transparent 100%)",
        }}
      />

      {/* Bottom-right corner glowing blue accent tick */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          right: 12,
          width: 90,
          height: 2,
          display: "flex",
          background: "linear-gradient(270deg, #0052FF 0%, transparent 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 12,
          right: 12,
          width: 2,
          height: 90,
          display: "flex",
          background: "linear-gradient(0deg, #0052FF 0%, transparent 100%)",
        }}
      />
    </div>
  );
}

export function OgHeader({
  label = "BASE MAINNET · 8453",
  subtitle = "260+ Tokenized Equities · Multi-DEX Swaps · Beefy & Aero Yields",
}: {
  label?: string;
  subtitle?: string;
}) {
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
        <OgLogo size={48} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span
              style={{
                color: OG_COLORS.text,
                fontSize: 23,
                fontWeight: 950,
                letterSpacing: "0.06em",
                lineHeight: 1.1,
              }}
            >
              BASE ANALYTICS
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "2px 8px",
                borderRadius: 6,
                background: "rgba(0, 82, 255, 0.22)",
                border: "1px solid rgba(0, 140, 255, 0.45)",
              }}
            >
              <span
                style={{
                  color: "#38BDF8",
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: "0.08em",
                }}
              >
                ONCHAIN
              </span>
            </div>
          </div>
          <span style={{ color: OG_COLORS.muted, fontSize: 12, fontWeight: 700, marginTop: 3 }}>
            {subtitle}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            border: "1px solid rgba(0, 240, 255, 0.40)",
            background: "rgba(0, 82, 255, 0.18)",
            boxShadow: "0 0 16px rgba(0, 82, 255, 0.25)",
            borderRadius: 999,
            padding: "7px 14px",
          }}
        >
          <span
            style={{
              color: "#38BDF8",
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
            border: "1px solid rgba(52, 211, 153, 0.45)",
            background: "rgba(16, 185, 129, 0.15)",
            boxShadow: "0 0 16px rgba(16, 185, 129, 0.20)",
            borderRadius: 999,
            padding: "7px 14px",
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

export function OgFooter({ cta = "LAUNCH TERMINAL" }: { cta?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        background: "rgba(11, 21, 38, 0.85)",
        borderRadius: 16,
        padding: "11px 20px",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ color: OG_COLORS.muted, fontSize: 12, fontWeight: 750 }}>
          Non-Custodial · Instant Settlement · 0.25% Fee
        </span>
        <span style={{ color: OG_COLORS.dim, fontSize: 12 }}>·</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {[
            { name: "Aerodrome", color: "#60A5FA" },
            { name: "Beefy", color: "#34D399" },
            { name: "Uniswap", color: "#F472B6" },
            { name: "Aave Pro", color: "#A78BFA" },
            { name: "IPOR Fusion", color: "#FBBF24" },
          ].map((proto) => (
            <div
              key={proto.name}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "2px 7px",
                borderRadius: 5,
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <span style={{ color: proto.color, fontSize: 11, fontWeight: 850 }}>
                {proto.name}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "linear-gradient(135deg, #0052FF 0%, #0038B8 100%)",
          border: "1px solid rgba(0, 240, 255, 0.40)",
          boxShadow: "0 0 18px rgba(0, 82, 255, 0.45)",
          borderRadius: 10,
          padding: "7px 18px",
          color: "#FFFFFF",
          fontSize: 12,
          fontWeight: 950,
          letterSpacing: "0.06em",
        }}
      >
        <span>{cta}</span>
        <span style={{ fontSize: 14 }}>↗</span>
      </div>
    </div>
  );
}

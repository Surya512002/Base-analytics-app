export const OG_VERSION = "12";

export const OG_COLORS = {
  bg: "#020508",
  panel: "rgba(255,255,255,0.055)",
  border: "rgba(255,255,255,0.12)",
  blue: "#0052FF",
  cyan: "#6BA3FF",
  green: "#34D399",
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
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          background:
            "radial-gradient(circle at 84% 10%, rgba(0,82,255,0.30), transparent 42%), radial-gradient(circle at 10% 90%, rgba(52,211,153,0.12), transparent 38%), #020508",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          opacity: 0.22,
          backgroundImage:
            "linear-gradient(rgba(107,163,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(107,163,255,0.08) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "linear-gradient(to bottom, black, transparent 82%)",
        }}
      />
    </>
  );
}

export function OgHeader({ label = "LIVE ON BASE" }: { label?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <OgLogo size={48} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              color: OG_COLORS.text,
              fontSize: 20,
              fontWeight: 900,
              letterSpacing: "0.12em",
            }}
          >
            BASE ANALYTICS
          </span>
          <span style={{ color: OG_COLORS.dim, fontSize: 11, fontWeight: 700 }}>
            Launch · Trade · Score · Gift
          </span>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          border: "1px solid rgba(52,211,153,0.35)",
          background: "rgba(52,211,153,0.10)",
          borderRadius: 999,
          padding: "8px 14px",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 8,
            height: 8,
            borderRadius: 99,
            background: OG_COLORS.green,
            boxShadow: "0 0 12px rgba(52,211,153,0.8)",
          }}
        />
        <span
          style={{
            color: "#A7F3D0",
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: "0.08em",
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

export function OgFooter({ cta }: { cta: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        border: `1px solid ${OG_COLORS.border}`,
        background: "rgba(255,255,255,0.045)",
        borderRadius: 16,
        padding: "12px 18px",
      }}
    >
      <span style={{ color: OG_COLORS.muted, fontSize: 13, fontWeight: 700 }}>
        Uniswap · Aerodrome · Slipstream · 0x
      </span>
      <span style={{ color: OG_COLORS.text, fontSize: 14, fontWeight: 900 }}>
        {cta} →
      </span>
    </div>
  );
}

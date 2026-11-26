/** Shared brand mark for OG / splash / icons (ink market). */
export function BrandLogoMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect width="64" height="64" rx="12" fill="#0052FF" />
      <path
        d="M32 14 46 23.5V42.5L32 52 18 42.5V23.5L32 14Z"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="none"
      />
      <rect x="23.5" y="33" width="3.5" height="9" rx="0.5" fill="#FFFFFF" />
      <rect x="29" y="27.5" width="3.5" height="14.5" rx="0.5" fill="#FFFFFF" />
      <rect x="34.5" y="22" width="3.5" height="20" rx="0.5" fill="#FFFFFF" />
    </svg>
  );
}

export const INK = {
  deep: "#080808",
  raised: "#111111",
  panel: "#141414",
  ink: "#f5f5f4",
  muted: "#a8a29e",
  dim: "#78716c",
  blue: "#0052FF",
  signal: "#e11d48",
  border: "rgba(255,255,255,0.1)",
} as const;

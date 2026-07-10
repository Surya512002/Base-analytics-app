const SIZES = {
  sm: 32,
  md: 40,
  lg: 44,
  xl: 80,
} as const;

type AppLogoSize = keyof typeof SIZES;

interface AppLogoProps {
  size?: AppLogoSize;
  className?: string;
}

/** Geometric bars + hex on Base blue — sharp mark for ink market UI. */
function LogoMark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Base Analytics"
      className="shrink-0"
    >
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

export default function AppLogo({ size = "sm", className = "" }: AppLogoProps) {
  return (
    <span className={`inline-flex ${className}`}>
      <LogoMark size={SIZES[size]} />
    </span>
  );
}

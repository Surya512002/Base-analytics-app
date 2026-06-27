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

/** Variation D — geometric bars + hex outline on Base blue (#0052FF). */
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

export default function AppLogo({ size = "sm", className = "" }: AppLogoProps) {
  return (
    <span className={`inline-flex ${className}`}>
      <LogoMark size={SIZES[size]} />
    </span>
  );
}

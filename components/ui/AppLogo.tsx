import { Hexagon } from "lucide-react";

const SIZES = {
  sm: { box: 32, icon: 16, radius: "rounded-xl" },
  md: { box: 40, icon: 20, radius: "rounded-2xl" },
  lg: { box: 44, icon: 22, radius: "rounded-2xl" },
  xl: { box: 80, icon: 36, radius: "rounded-3xl" },
} as const;

type AppLogoSize = keyof typeof SIZES;

interface AppLogoProps {
  size?: AppLogoSize;
  className?: string;
}

export default function AppLogo({ size = "sm", className = "" }: AppLogoProps) {
  const { box, icon, radius } = SIZES[size];

  return (
    <div
      className={`flex items-center justify-center glow-ring shrink-0 ${radius} ${className}`}
      style={{
        width: box,
        height: box,
        background: "linear-gradient(135deg, #0052FF, #00E5FF)",
      }}
      aria-hidden
    >
      <Hexagon size={icon} className="text-white" strokeWidth={2.25} />
    </div>
  );
}

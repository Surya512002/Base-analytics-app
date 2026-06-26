import Image from "next/image";

const SIZES = {
  sm: { box: 32, radius: "rounded-xl" },
  md: { box: 40, radius: "rounded-2xl" },
  lg: { box: 44, radius: "rounded-2xl" },
  xl: { box: 80, radius: "rounded-3xl" },
} as const;

type AppLogoSize = keyof typeof SIZES;

interface AppLogoProps {
  size?: AppLogoSize;
  className?: string;
}

export default function AppLogo({ size = "sm", className = "" }: AppLogoProps) {
  const { box, radius } = SIZES[size];

  return (
    <Image
      src="/icon.png"
      alt="Base Analytics"
      width={box}
      height={box}
      className={`shrink-0 object-cover ${radius} ${className}`}
      priority={size === "sm" || size === "xl"}
    />
  );
}

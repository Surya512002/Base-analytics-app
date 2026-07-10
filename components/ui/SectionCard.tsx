import type { ReactNode } from "react";

interface SectionCardProps {
  children: ReactNode;
  className?: string;
  padding?: boolean;
  bar?: boolean;
}

export default function SectionCard({
  children,
  className = "",
  padding = true,
  bar = true,
}: SectionCardProps) {
  return (
    <div className={`glass-panel rounded-3xl overflow-hidden ${className}`}>
      {bar && <div className="accent-bar" />}
      <div className={padding ? "p-5 sm:p-6" : ""}>{children}</div>
    </div>
  );
}

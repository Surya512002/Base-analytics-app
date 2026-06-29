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
    <div
      className={`glass-panel rounded-3xl overflow-hidden shadow-xl shadow-black/25 ${className}`}
    >
      {bar && <div className="h-0.5 bg-linear-to-r from-amber-400 via-violet-500 to-cyan-400" />}
      <div className={padding ? "p-5 sm:p-6" : ""}>{children}</div>
    </div>
  );
}

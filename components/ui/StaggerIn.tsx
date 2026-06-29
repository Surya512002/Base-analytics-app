"use client";

import type { ReactNode } from "react";

interface StaggerInProps {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
}

/** Staggered fade-up for child elements with `.stagger-child` */
export default function StaggerIn({
  children,
  className = "",
  as: Tag = "div",
}: StaggerInProps) {
  return <Tag className={`stagger-in ${className}`}>{children}</Tag>;
}

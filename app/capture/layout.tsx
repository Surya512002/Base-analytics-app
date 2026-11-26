import { notFound } from "next/navigation";

/** Staging screens for marketing screenshots: made-up app state, so never served in production. */
export default function CaptureLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}

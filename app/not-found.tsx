import Link from "next/link";
import AppLogo from "@/components/ui/AppLogo";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--bg-deep)] flex flex-col items-center justify-center p-6 text-center text-[var(--ink)] relative overflow-hidden">
      <AppLogo size="xl" className="mb-8 z-10" />

      <h1 className="z-10 mb-3 text-3xl font-extrabold text-[var(--ink)]">Page not found</h1>

      <p className="z-10 mb-8 max-w-md text-lg font-medium text-[var(--ink-muted)]">
        This address doesn&apos;t exist or has moved.
      </p>

      <Link href="/" className="z-10 rounded-xl px-6 py-3 font-bold btn-primary">
        Go to Home
      </Link>
    </div>
  );
}

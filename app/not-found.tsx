import Link from "next/link";
import AppLogo from "@/components/ui/AppLogo";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--bg-deep)] flex flex-col items-center justify-center p-6 text-center text-[var(--ink)] relative overflow-hidden">
      <AppLogo size="xl" className="mb-8 z-10" />

      <h2 className="text-4xl md:text-5xl font-black text-[var(--ink)] mb-4 tracking-tighter z-10">
        404 <span className="text-[var(--ink-dim)]">|</span> NOT FOUND
      </h2>

      <p className="text-[var(--ink-muted)] mb-10 font-medium text-lg z-10 max-w-md">
        This page doesn&apos;t exist or has moved offchain.
      </p>

      <Link href="/" className="px-8 py-4 btn-primary rounded-full font-black text-lg z-10">
        Return to Base Analytics
      </Link>
    </div>
  );
}

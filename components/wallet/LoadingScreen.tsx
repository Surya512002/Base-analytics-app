import AppLogo from "@/components/ui/AppLogo";

export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center">
      <div className="text-center space-y-4">
        <AppLogo size="xl" className="mx-auto" />
        <div>
          <p className="text-[var(--ink)] font-semibold text-lg tracking-tight">BASE.ANALYTICS</p>
          <p className="text-[var(--ink-dim)] text-xs tracking-wide mt-1.5">Loading…</p>
        </div>
      </div>
    </div>
  );
}

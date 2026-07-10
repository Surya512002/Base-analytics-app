import AppBackground from "@/components/ui/AppBackground";
import CreatorProfilePanel from "@/components/launchpad/CreatorProfilePanel";
import Link from "next/link";

export default async function CreatorPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const addr = address?.trim().toLowerCase();
  const valid = addr?.startsWith("0x") && addr.length === 42 ? addr : null;

  return (
    <main className="min-h-screen text-white font-sans relative">
      <AppBackground />
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
        <Link
          href="/explore"
          className="inline-block text-sm font-bold text-[#6BA3FF] hover:text-white mb-6"
        >
          ← Back to explore
        </Link>
        {valid ? (
          <CreatorProfilePanel address={valid} />
        ) : (
          <p className="text-slate-500">Invalid creator address.</p>
        )}
      </div>
    </main>
  );
}

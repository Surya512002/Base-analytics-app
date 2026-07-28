import CreatorPageClient from "@/components/launchpad/CreatorPageClient";

export default async function CreatorPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const addr = address?.trim().toLowerCase();
  const valid = addr?.startsWith("0x") && addr.length === 42 ? addr : null;

  if (!valid) {
    return (
      <main className="flex min-h-screen items-center justify-center text-[var(--ink-muted)]">
        Invalid creator address.
      </main>
    );
  }

  return <CreatorPageClient address={valid} />;
}

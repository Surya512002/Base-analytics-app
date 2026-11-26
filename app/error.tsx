"use client";

import { useEffect } from "react";
import Link from "next/link";
import AppLogo from "@/components/ui/AppLogo";

/** Shown when a screen fails to draw. Nothing here sends or signs anything. */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg-deep)] p-6 text-center text-[var(--ink)]">
      <AppLogo size="xl" />
      <h1 className="text-2xl font-extrabold">Something went wrong on this screen</h1>
      <p className="max-w-md text-[var(--ink-muted)]">
        Try again. If you had just confirmed a transaction, check your wallet or BaseScan before repeating it.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => retry()} className="btn-primary min-h-[44px] rounded-xl px-5 font-bold">
          Try again
        </button>
        <Link href="/" className="inline-flex min-h-[44px] items-center rounded-xl border border-[var(--border-subtle)] px-5 font-bold">
          Go to Home
        </Link>
      </div>
    </main>
  );
}

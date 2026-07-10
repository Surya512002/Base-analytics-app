import { NextResponse } from "next/server";
import { listLaunchedTokens } from "@/lib/launchpad/token-store";
import { listAnnouncements } from "@/lib/launchpad/announcements-store";

export const dynamic = "force-dynamic";

export type CalendarEvent = {
  id: string;
  type: "launch" | "vesting" | "anti-snipe" | "announcement";
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  at: number;
  label: string;
  detail?: string;
};

export async function GET() {
  try {
    const tokens = await listLaunchedTokens();
    const events: CalendarEvent[] = [];

    for (const t of tokens) {
      events.push({
        id: `launch-${t.address}`,
        type: "launch",
        tokenAddress: t.address,
        tokenSymbol: t.symbol,
        tokenName: t.name,
        at: t.createdAt,
        label: "Token launched",
      });

      if (t.vestingSchedule?.length) {
        for (const v of t.vestingSchedule) {
          const unlockAt =
            t.createdAt +
            (v.cliffMonths ?? 0) * 30 * 86_400_000 +
            (v.vestMonths ?? 0) * 30 * 86_400_000;
          events.push({
            id: `vest-${t.address}-${v.address}-${v.pct}`,
            type: "vesting",
            tokenAddress: t.address,
            tokenSymbol: t.symbol,
            tokenName: t.name,
            at: unlockAt,
            label: `Vesting unlock · ${v.pct}%`,
            detail: v.address ? `→ ${v.address.slice(0, 8)}…` : undefined,
          });
        }
      }

      if (t.poolOpenBlock && t.antiSnipeBlocks) {
        const approxMs = t.createdAt + t.antiSnipeBlocks * 2000;
        events.push({
          id: `snipe-${t.address}`,
          type: "anti-snipe",
          tokenAddress: t.address,
          tokenSymbol: t.symbol,
          tokenName: t.name,
          at: approxMs,
          label: "Anti-snipe window ends",
          detail: `${t.antiSnipeBlocks} blocks after pool open`,
        });
      }

      const announcements = await listAnnouncements(t.address);
      for (const a of announcements) {
        events.push({
          id: `ann-${a.id}`,
          type: "announcement",
          tokenAddress: t.address,
          tokenSymbol: t.symbol,
          tokenName: t.name,
          at: a.createdAt,
          label: "Creator announcement",
          detail: a.body.slice(0, 80),
        });
      }
    }

    events.sort((a, b) => b.at - a.at);

    const now = Date.now();
    const upcoming = events.filter((e) => e.at >= now - 86_400_000).slice(0, 40);
    const recent = events.filter((e) => e.at < now).slice(0, 20);

    return NextResponse.json({ upcoming, recent, total: events.length });
  } catch (err) {
    console.error("[calendar]", err);
    return NextResponse.json({ upcoming: [], recent: [], total: 0 });
  }
}

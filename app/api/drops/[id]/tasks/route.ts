import { NextResponse } from "next/server";
import { checkRateLimitAsync, rateLimitResponse } from "@/lib/api/rate-limit";
import { errorResponse, limitIp, requireWallet } from "@/lib/drops/http";
import { checkTask, defaultDeps, parseDropId } from "@/lib/drops/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/drops/:id/tasks { wallet, taskId, submission? } → check one task for the signed-in
 * wallet and remember the result.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = await limitIp(req, "task", 40, 60_000);
  if (limited) return limited;
  const raw = await req.text();
  if (raw.length > 16 * 1024) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  let body: { wallet?: string; taskId?: unknown; submission?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const auth = await requireWallet(body.wallet);
  if (!auth.ok) return auth.res;
  if (typeof body.taskId !== "string" || body.taskId.length > 32) {
    return NextResponse.json({ error: "Invalid task" }, { status: 400 });
  }
  // External checks cost API calls: cap per wallet too.
  const perWallet = await checkRateLimitAsync(`drops-task-wallet:${auth.wallet}`, 30, 60_000);
  if (!perWallet.ok) return rateLimitResponse(perWallet.retryAfterSec);
  try {
    const id = parseDropId((await ctx.params).id);
    const result = await checkTask(defaultDeps(), id, auth.wallet, body.taskId, body.submission);
    return NextResponse.json({ result: { status: result.status, message: result.message, at: result.at } });
  } catch (err) {
    return errorResponse(err);
  }
}

import { NextResponse } from "next/server";
import {
  B20_LAUNCH_NOTIFICATION,
  broadcastBaseNotification,
  listAllOptedInUsers,
  listNotificationUsers,
  sendBaseNotification,
} from "@/lib/base/notifications-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function readAdminSecret(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  return req.headers.get("x-admin-secret")?.trim() ?? null;
}

function assertAdmin(req: Request): boolean {
  const expected = process.env.BASE_NOTIFICATIONS_ADMIN_SECRET?.trim();
  if (!expected) return false;
  return readAdminSecret(req) === expected;
}

/** Admin-only Base App notification sender. */
export async function POST(req: Request) {
  if (!assertAdmin(req)) return unauthorized();

  let body: {
    action?: string;
    wallet_addresses?: string[];
    title?: string;
    message?: string;
    target_path?: string;
    preset?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action ?? "send";
  const preset =
    body.preset === "b20_launch"
      ? B20_LAUNCH_NOTIFICATION
      : { title: body.title ?? "", message: body.message ?? "", targetPath: body.target_path };

  try {
    if (action === "list") {
      const users = await listAllOptedInUsers();
      return NextResponse.json({ count: users.length, addresses: users.slice(0, 50) });
    }

    if (action === "list_page") {
      const page = await listNotificationUsers({ notificationEnabled: true, limit: 100 });
      return NextResponse.json(page);
    }

    if (action === "broadcast") {
      if (!preset.title || !preset.message) {
        return NextResponse.json(
          { error: "title and message required (or preset: b20_launch)" },
          { status: 400 }
        );
      }
      const result = await broadcastBaseNotification({
        title: preset.title,
        message: preset.message,
        targetPath: preset.targetPath,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "send") {
      const wallets = body.wallet_addresses ?? [];
      if (!wallets.length) {
        return NextResponse.json({ error: "wallet_addresses required" }, { status: 400 });
      }
      if (!preset.title || !preset.message) {
        return NextResponse.json(
          { error: "title and message required (or preset: b20_launch)" },
          { status: 400 }
        );
      }
      const result = await sendBaseNotification({
        walletAddresses: wallets,
        title: preset.title,
        message: preset.message,
        targetPath: preset.targetPath,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json(
      { error: "Unknown action — use send, broadcast, list, or list_page" },
      { status: 400 }
    );
  } catch (e) {
    console.error("[admin/base-notifications]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Notification failed" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  if (!assertAdmin(req)) return unauthorized();
  try {
    const users = await listAllOptedInUsers();
    return NextResponse.json({
      optedInCount: users.length,
      sample: users.slice(0, 10),
      b20Preset: B20_LAUNCH_NOTIFICATION,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

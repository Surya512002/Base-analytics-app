import { NextResponse } from "next/server";
import {
  setFarcasterNotificationDetails,
  type FarcasterNotificationDetails,
} from "@/lib/farcaster/notification-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WebhookEvent = {
  event?: string;
  notificationDetails?: FarcasterNotificationDetails;
};

async function verifyWebhookEvent(
  requestJson: unknown
): Promise<{ fid: number; event: WebhookEvent } | null> {
  if (!process.env.NEYNAR_API_KEY?.trim()) {
    return null;
  }

  try {
    const mod = await import("@farcaster/miniapp-node");
    const data = await mod.parseWebhookEvent(
      requestJson,
      mod.verifyAppKeyWithNeynar
    );
    return {
      fid: data.fid,
      event: data.event as WebhookEvent,
    };
  } catch (e) {
    console.warn("[webhook] verification failed", e);
    return null;
  }
}

/** Farcaster mini-app webhook — verifies JFS when NEYNAR_API_KEY is set. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const verified = await verifyWebhookEvent(body);
  if (!verified) {
    if (!process.env.NEYNAR_API_KEY?.trim()) {
      return NextResponse.json({
        success: true,
        note: "Webhook received — set NEYNAR_API_KEY to verify Farcaster events",
      });
    }
    return NextResponse.json({ success: false, error: "Invalid webhook" }, { status: 401 });
  }

  const { fid, event } = verified;
  const type = event.event;

  try {
    switch (type) {
      case "miniapp_added":
        if (event.notificationDetails) {
          await setFarcasterNotificationDetails(fid, event.notificationDetails);
        } else {
          await setFarcasterNotificationDetails(fid, null);
        }
        break;
      case "miniapp_removed":
        await setFarcasterNotificationDetails(fid, null);
        break;
      case "notifications_enabled":
        if (event.notificationDetails) {
          await setFarcasterNotificationDetails(fid, event.notificationDetails);
        }
        break;
      case "notifications_disabled":
        await setFarcasterNotificationDetails(fid, null);
        break;
      default:
        console.info("[webhook] unhandled event", type, { fid });
    }
  } catch (e) {
    console.error("[webhook] handler error", e);
    return NextResponse.json({ success: false }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "base-analytics-webhook",
    verification: Boolean(process.env.NEYNAR_API_KEY?.trim()),
  });
}

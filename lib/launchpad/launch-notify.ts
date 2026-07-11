import { cacheGet, cacheSet } from "@/lib/redis-cache";

const THROTTLE_KEY = "launch-notify:throttle";
const THROTTLE_TTL = 60 * 10; // 10 minutes between global launch broadcasts

export async function notifyNewTokenLaunch(input: {
  symbol: string;
  name: string;
  address: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const apiKey =
    process.env.BASE_DASHBOARD_API_KEY?.trim() ||
    process.env.BASE_NOTIFICATIONS_API_KEY?.trim();
  if (!apiKey) {
    return { sent: false, reason: "BASE_DASHBOARD_API_KEY not set" };
  }

  const throttled = await cacheGet<boolean>(THROTTLE_KEY);
  if (throttled) {
    return { sent: false, reason: "throttled" };
  }

  try {
    const { broadcastBaseNotification } = await import(
      "@/lib/base/notifications-client"
    );
    const symbol = input.symbol.trim().slice(0, 12);
    const result = await broadcastBaseNotification({
      title: `$${symbol} launched 🚀`,
      message: `${input.name.slice(0, 80)} just went live on Base Analytics — tap to explore and trade.`,
      targetPath: `/explore/token/${input.address.toLowerCase()}`,
    });

    if (result.totalRecipients > 0) {
      await cacheSet(THROTTLE_KEY, true, THROTTLE_TTL).catch(() => {});
    }

    return {
      sent: result.sentCount > 0,
      reason:
        result.totalRecipients === 0
          ? "no opted-in recipients"
          : result.sentCount === 0
            ? "send failed"
            : undefined,
    };
  } catch (e) {
    console.warn("[launch-notify]", e);
    return {
      sent: false,
      reason: e instanceof Error ? e.message : "notify failed",
    };
  }
}

/** Fire-and-forget — never blocks token registration. */
export function scheduleLaunchNotification(input: {
  symbol: string;
  name: string;
  address: string;
}): void {
  void notifyNewTokenLaunch(input).catch((e) =>
    console.warn("[launch-notify] background", e)
  );
}

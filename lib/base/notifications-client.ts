import { getAppUrl } from "@/lib/constants/app-url";

const BASE_DASHBOARD_API = "https://dashboard.base.org/api/v1/notifications";

export type BaseNotificationUser = {
  address: string;
  notificationsEnabled: boolean;
};

export type BaseUserPinStatus = {
  appPinned: boolean;
  notificationsEnabled: boolean;
};

export type SendNotificationResult = {
  success: boolean;
  sentCount: number;
  failedCount: number;
  results: {
    walletAddress: string;
    sent: boolean;
    failureReason?: string;
  }[];
};

function getApiKey(): string {
  const key =
    process.env.BASE_DASHBOARD_API_KEY?.trim() ||
    process.env.BASE_NOTIFICATIONS_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "Missing BASE_DASHBOARD_API_KEY — create one in Base Dashboard → Settings → API Key"
    );
  }
  return key;
}

export function getRegisteredAppUrl(): string {
  return (
    process.env.BASE_APP_REGISTERED_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    getAppUrl()
  );
}

async function dashboardFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE_DASHBOARD_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getApiKey(),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Base Dashboard API ${res.status}`;
    throw new Error(msg);
  }

  return data as T;
}

export async function fetchUserPinStatus(
  walletAddress: string
): Promise<BaseUserPinStatus> {
  const appUrl = getRegisteredAppUrl();
  const addr = walletAddress.trim().toLowerCase();

  try {
    const data = await dashboardFetch<{
      appPinned?: boolean;
      notificationsEnabled?: boolean;
      success?: boolean;
    }>("/app/user/status", {
      method: "POST",
      body: JSON.stringify({ app_url: appUrl, wallet_address: addr }),
    });
    return {
      appPinned: data.appPinned === true,
      notificationsEnabled: data.notificationsEnabled === true,
    };
  } catch {
    const page = await listNotificationUsers({ notificationEnabled: true, limit: 100 });
    const match = page.users.find((u) => u.address.toLowerCase() === addr);
    if (match) {
      return {
        appPinned: true,
        notificationsEnabled: match.notificationsEnabled,
      };
    }
    return { appPinned: false, notificationsEnabled: false };
  }
}

export async function listNotificationUsers(opts?: {
  notificationEnabled?: boolean;
  cursor?: string;
  limit?: number;
}): Promise<{ users: BaseNotificationUser[]; nextCursor?: string }> {
  const appUrl = getRegisteredAppUrl();
  const qs = new URLSearchParams({ app_url: appUrl });
  if (opts?.notificationEnabled === true) qs.set("notification_enabled", "true");
  if (opts?.cursor) qs.set("cursor", opts.cursor);
  if (opts?.limit) qs.set("limit", String(Math.min(100, opts.limit)));

  const data = await dashboardFetch<{
    users?: { address: string; notificationsEnabled?: boolean }[];
    nextCursor?: string;
  }>(`/app/users?${qs.toString()}`);

  return {
    users: (data.users ?? []).map((u) => ({
      address: u.address,
      notificationsEnabled: u.notificationsEnabled === true,
    })),
    nextCursor: data.nextCursor,
  };
}

export async function listAllOptedInUsers(): Promise<string[]> {
  const addresses: string[] = [];
  let cursor: string | undefined;

  do {
    const page = await listNotificationUsers({
      notificationEnabled: true,
      cursor,
      limit: 100,
    });
    for (const u of page.users) {
      if (u.notificationsEnabled) addresses.push(u.address);
    }
    cursor = page.nextCursor;
  } while (cursor);

  return [...new Set(addresses.map((a) => a.toLowerCase()))];
}

export async function sendBaseNotification(input: {
  walletAddresses: string[];
  title: string;
  message: string;
  targetPath?: string;
}): Promise<SendNotificationResult> {
  const title = input.title.trim().slice(0, 30);
  const message = input.message.trim().slice(0, 200);
  const wallets = [
    ...new Set(
      input.walletAddresses
        .map((a) => a.trim().toLowerCase())
        .filter((a) => /^0x[a-f0-9]{40}$/.test(a))
    ),
  ];

  if (!wallets.length) throw new Error("No valid wallet addresses");
  if (wallets.length > 1000) {
    throw new Error("Maximum 1,000 addresses per request — use broadcast helper");
  }

  const body: Record<string, unknown> = {
    app_url: getRegisteredAppUrl(),
    wallet_addresses: wallets,
    title,
    message,
  };
  if (input.targetPath?.trim()) {
    const path = input.targetPath.trim();
    body.target_path = path.startsWith("/") ? path : `/${path}`;
  }

  return dashboardFetch<SendNotificationResult>("/send", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function broadcastBaseNotification(input: {
  title: string;
  message: string;
  targetPath?: string;
}): Promise<{
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  batches: number;
}> {
  const addresses = await listAllOptedInUsers();
  if (!addresses.length) {
    return { totalRecipients: 0, sentCount: 0, failedCount: 0, batches: 0 };
  }

  let sentCount = 0;
  let failedCount = 0;
  let batches = 0;

  for (let i = 0; i < addresses.length; i += 1000) {
    const chunk = addresses.slice(i, i + 1000);
    const result = await sendBaseNotification({
      walletAddresses: chunk,
      title: input.title,
      message: input.message,
      targetPath: input.targetPath,
    });
    sentCount += result.sentCount ?? 0;
    failedCount += result.failedCount ?? 0;
    batches += 1;
    if (i + 1000 < addresses.length) {
      await new Promise((r) => setTimeout(r, 3200));
    }
  }

  return {
    totalRecipients: addresses.length,
    sentCount,
    failedCount,
    batches,
  };
}

/** Preset copy for B20 launch announcements. */
export const B20_LAUNCH_NOTIFICATION = {
  title: "B20 Launch is Live 🚀",
  message:
    "Create your 0xB20 token, explore trending B20 & swap in-app on Base Analytics. Tap to launch or trade now.",
  targetPath: "/?tab=launchpad",
} as const;

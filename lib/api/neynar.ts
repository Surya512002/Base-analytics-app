/** Build a same-origin URL for the Neynar server proxy (client-safe). */
export function neynarApiUrl(
  path: string,
  params?: Record<string, string | number | undefined>
): string {
  const url = new URL(
    "/api/neynar",
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
  );
  url.searchParams.set("path", path);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.pathname + url.search;
}

export type NeynarFetchResult = {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
  unavailable: boolean;
};

/** Fetch via server proxy; `unavailable` is true when NEYNAR_API_KEY is not set. */
export async function fetchNeynar(
  path: string,
  params?: Record<string, string | number | undefined>
): Promise<NeynarFetchResult> {
  let attempt = 0;
  const maxAttempts = 2;

  while (attempt < maxAttempts) {
    try {
      const res = await fetch(neynarApiUrl(path, params), {
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok || res.status === 400 || res.status === 404) {
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        return {
          ok: res.ok,
          status: res.status,
          data,
          unavailable: res.status === 503,
        };
      }
    } catch {
      // Retry on network timeout
    }
    attempt++;
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  return {
    ok: false,
    status: 503,
    data: {},
    unavailable: true,
  };
}

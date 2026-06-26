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

/**
 * The visitor's country for compliance gating, from headers the visitor can't forge.
 *
 * On Vercel, `x-vercel-ip-country` is set by the platform's edge from the connecting IP.
 * `cf-ipcountry`, `x-mock-country` and `x-user-country` are ordinary request headers that any
 * client can send, so in a Vercel deployment they are ignored. Outside Vercel (local dev,
 * tests) they and COMPLIANCE_MOCK_COUNTRY still work for testing restricted regions.
 */
type HeaderBag = { get(name: string): string | null };

export function trustedCountryFromHeaders(headers: HeaderBag): string | null {
  const vercel = headers.get("x-vercel-ip-country");
  if (vercel?.trim()) return vercel.trim().toUpperCase();
  if (process.env.VERCEL) return null;
  const local =
    headers.get("cf-ipcountry") ||
    headers.get("x-mock-country") ||
    headers.get("x-user-country") ||
    process.env.COMPLIANCE_MOCK_COUNTRY ||
    null;
  return local?.trim().toUpperCase() || null;
}

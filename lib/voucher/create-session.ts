/** Tracks the in-flight voucher create session (survives Base App reloads). */

const sessionKey = (address: string) =>
  `base_voucher_create_session_${address.toLowerCase()}`;

export interface VoucherCreateSession {
  batchId: number;
  fundTxHash?: string;
  startedAt: number;
}

export function saveCreateSession(address: string, session: VoucherCreateSession): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(sessionKey(address), JSON.stringify(session));
}

export function loadCreateSession(address: string): VoucherCreateSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(sessionKey(address));
    return raw ? (JSON.parse(raw) as VoucherCreateSession) : null;
  } catch {
    return null;
  }
}

export function clearCreateSession(address: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(sessionKey(address));
}

export function setSessionFundTx(address: string, fundTxHash: string): void {
  const session = loadCreateSession(address);
  if (!session) return;
  saveCreateSession(address, { ...session, fundTxHash });
}

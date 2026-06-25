export function getDayKey(iso: string): string {
  return iso.slice(0, 10);
}

export function getWeekKey(iso: string): string {
  const d = new Date(iso);
  const thu = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  );
  const yr = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((thu.getTime() - yr.getTime()) / 86400000 + 1) / 7);
  return `${thu.getUTCFullYear()}-W${String(wk).padStart(2, "0")}`;
}

export function getMonthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function getISOWeekNumber(): number {
  const d = new Date();
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - y.getTime()) / 86400000 + 1) / 7);
}

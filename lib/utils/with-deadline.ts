/** Resolve with `fallback` if `promise` does not settle within `ms`. */
export function withDeadline<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export function deadlineExpired(started: number, ms: number): boolean {
  return Date.now() - started >= ms;
}

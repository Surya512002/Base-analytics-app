/** Resolve with the promise result, or `fallback` if `ms` elapses first. */
export async function withDeadline<T>(
  ms: number,
  promise: Promise<T>,
  fallback: T
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Just enough of ioredis for the storage tests: strings, hashes, lists, sets, multi. */
export class FakeRedis {
  data = new Map<string, unknown>();

  async get(k: string) {
    return (this.data.get(k) as string | undefined) ?? null;
  }
  async mget(...ks: string[]) {
    return ks.map((k) => (this.data.get(k) as string | undefined) ?? null);
  }
  async exists(k: string) {
    return this.data.has(k) ? 1 : 0;
  }
  async expire() {
    return 1;
  }
  async set(k: string, v: string, ...opts: Array<string | number>) {
    if (opts.includes("NX") && this.data.has(k)) return null;
    this.data.set(k, v);
    return "OK";
  }
  private hash(k: string) {
    if (!this.data.has(k)) this.data.set(k, {});
    return this.data.get(k) as Record<string, string>;
  }
  async hset(k: string, f: string, v: string) {
    const h = this.hash(k);
    const n = f in h ? 0 : 1;
    h[f] = v;
    return n;
  }
  async hsetnx(k: string, f: string, v: string) {
    const h = this.hash(k);
    if (f in h) return 0;
    h[f] = v;
    return 1;
  }
  async hget(k: string, f: string) {
    return this.hash(k)[f] ?? null;
  }
  async hdel(k: string, f: string) {
    const h = this.hash(k);
    const n = f in h ? 1 : 0;
    delete h[f];
    return n;
  }
  async hgetall(k: string) {
    return { ...(this.data.get(k) as Record<string, string> | undefined) };
  }
  async hincrby(k: string, f: string, by: number) {
    const h = this.hash(k);
    const next = BigInt(h[f] ?? "0") + BigInt(by);
    if (next > BigInt("9223372036854775807")) throw new Error("ERR increment or decrement would overflow");
    h[f] = next.toString();
    return Number(next);
  }
  private list(k: string) {
    if (!this.data.has(k)) this.data.set(k, []);
    return this.data.get(k) as string[];
  }
  async lpush(k: string, v: string) {
    return this.list(k).unshift(v);
  }
  async ltrim(k: string, a: number, b: number) {
    this.data.set(k, this.list(k).slice(a, b + 1));
    return "OK";
  }
  async lrange(k: string, a: number, b: number) {
    return this.list(k).slice(a, b + 1);
  }
  private setOf(k: string) {
    if (!this.data.has(k)) this.data.set(k, new Set<string>());
    return this.data.get(k) as Set<string>;
  }
  async sadd(k: string, ...vs: string[]) {
    const s = this.setOf(k);
    let n = 0;
    for (const v of vs) {
      if (!s.has(v)) {
        s.add(v);
        n++;
      }
    }
    return n;
  }
  async scard(k: string) {
    return this.setOf(k).size;
  }

  multi() {
    const ops: Array<() => Promise<unknown>> = [];
    const self = this as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>;
    const chain: Record<string, unknown> = {
      exec: async () => {
        const out = [];
        for (const op of ops) out.push([null, await op()]);
        return out;
      },
    };
    for (const name of ["hset", "hsetnx", "hdel", "hincrby", "lpush", "ltrim", "expire", "sadd"]) {
      chain[name] = (...a: unknown[]) => {
        ops.push(() => self[name](...a));
        return chain;
      };
    }
    return chain;
  }
}

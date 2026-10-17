/** Web stub — ioredis requires Node.js TCP/dns and is disabled on client builds. */
export class Redis {
  on() {
    return this;
  }
  disconnect() {}
  quit() {
    return Promise.resolve("OK");
  }
  get() {
    return Promise.resolve(null);
  }
  set() {
    return Promise.resolve("OK");
  }
  del() {
    return Promise.resolve(0);
  }
  ping() {
    return Promise.resolve("PONG");
  }
}

export default Redis;

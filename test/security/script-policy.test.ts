import { afterEach, describe, expect, it, vi } from "vitest";

async function scriptSrc(nodeEnv: string): Promise<string> {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", nodeEnv);
  const { default: config } = await import("../../next.config");
  const rules = await config.headers!();
  const csp = rules[0].headers.find((h) => h.key === "Content-Security-Policy")!.value;
  return csp.split("; ").find((d) => d.startsWith("script-src"))!;
}

describe("script policy", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("production does not allow eval", async () => {
    const policy = await scriptSrc("production");
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).toContain("'self'");
  });

  it("development still allows eval for hot reload", async () => {
    expect(await scriptSrc("development")).toContain("'unsafe-eval'");
  });
});

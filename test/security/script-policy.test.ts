import { afterEach, describe, expect, it, vi } from "vitest";

async function directive(name: string, nodeEnv = "production"): Promise<string | undefined> {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", nodeEnv);
  const { default: config } = await import("../../next.config");
  const rules = await config.headers!();
  const csp = rules[0].headers.find((h) => h.key === "Content-Security-Policy")!.value;
  return csp.split("; ").find((d) => d.startsWith(`${name} `));
}

describe("script policy", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("production does not allow eval", async () => {
    const policy = await directive("script-src");
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).toContain("'self'");
  });

  it("development still allows eval for hot reload", async () => {
    expect(await directive("script-src", "development")).toContain("'unsafe-eval'");
  });

  it("never runs inline event handlers, and forms stay on this app", async () => {
    expect(await directive("script-src-attr")).toBe("script-src-attr 'none'");
    expect(await directive("form-action")).toBe("form-action 'self'");
  });
});

import { describe, expect, it } from "vitest";
import { isTrustedAppHost } from "./trusted-hosts";

describe("isTrustedAppHost", () => {
  it("accepts our production domains and this project's previews", () => {
    expect(isTrustedAppHost("baseanalytics.app")).toBe(true);
    expect(isTrustedAppHost("www.baseanalytics.app")).toBe(true);
    expect(isTrustedAppHost("base-analytics-app.vercel.app")).toBe(true);
    expect(isTrustedAppHost("base-analytics-app-git-feat-x-surya512002s-projects.vercel.app")).toBe(true);
    expect(isTrustedAppHost("base-analytics-app-a1b2c3d4e-surya512002s-projects.vercel.app")).toBe(true);
  });

  it("accepts the host the request actually arrived on (e.g. localhost in dev)", () => {
    expect(isTrustedAppHost("localhost:3000", "localhost:3000")).toBe(true);
  });

  it("rejects look-alikes and other sites, which could replay a user's signature", () => {
    expect(isTrustedAppHost("evil.vercel.app")).toBe(false);
    expect(isTrustedAppHost("base-analytics-app-phish.vercel.app")).toBe(false);
    expect(isTrustedAppHost("baseanalytics.app.evil.com")).toBe(false);
    expect(isTrustedAppHost("localhost:3000")).toBe(false);
    expect(isTrustedAppHost("")).toBe(false);
  });
});

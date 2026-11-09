import { describe, it, expect } from "vitest";
import {
  sanitizeRpcOrigin,
  buildConnectSrcDirective,
  BASE_CONNECT_SRC_SOURCES,
} from "@/lib/security/csp";
import fs from "fs";
import path from "path";

describe("C1: CSP connect-src Security & Sanitization", () => {
  it("strips API keys and paths from keyed RPC URLs, preserving only the origin", () => {
    const keyedUrl = "https://example.g.alchemy.com/v2/SECRETKEY";
    const origin = sanitizeRpcOrigin(keyedUrl);

    expect(origin).toBe("https://example.g.alchemy.com");
    expect(origin).not.toContain("SECRETKEY");
    expect(origin).not.toContain("/v2/");

    const directive = buildConnectSrcDirective([keyedUrl]);
    expect(directive).toContain("https://example.g.alchemy.com");
    expect(directive).not.toContain("SECRETKEY");
    expect(directive).not.toContain("/v2/");
  });

  it("handles Infura, QuickNode, Alchemy and custom port keyed URLs safely", () => {
    const urls = [
      "https://base-mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
      "https://base-sepolia.g.alchemy.com/v2/ALCH_SECRET_9876543210",
      "https://quiet-frosty-water.base-mainnet.quiknode.pro/abc123secret456/",
      "http://localhost:8545/rpc?key=topsecret#frag",
    ];

    for (const u of urls) {
      const sanitized = sanitizeRpcOrigin(u);
      expect(sanitized).toBeDefined();
      expect(sanitized).not.toContain("secret");
      expect(sanitized).not.toContain("SECRET");
      expect(sanitized).not.toContain("9aa3d95b3bc440fa88ea12eaa4456161");
      expect(sanitized).not.toContain("ALCH_SECRET");
      expect(sanitized).not.toContain("abc123secret456");
      expect(sanitized).not.toContain("?");
      expect(sanitized).not.toContain("#");
      expect(sanitized).not.toContain("/v2/");
      expect(sanitized).not.toContain("/v3/");
    }

    expect(sanitizeRpcOrigin(urls[3])).toBe("http://localhost:8545");
  });

  it("rejects garbage inputs, non-http protocols, and injection attempts", () => {
    const garbageInputs = [
      "",
      "   ",
      "not-a-url",
      "javascript:alert(document.cookie)",
      "data:text/html,<script>alert(1)</script>",
      "https://evil.com; script-src 'unsafe-inline'",
      "https://evil.com 'unsafe-inline'",
      "https://evil.com\nscript-src *",
      "https://evil.com\r\ndefault-src *",
      "ftp://ftp.example.com",
      "file:///etc/passwd",
      null,
      undefined,
      "https://legit.com;connect-src https://hacker.com",
      "http://[invalid-ipv6",
      "https://foo bar.com",
      "https://foo\tbar.com",
    ];

    for (const input of garbageInputs) {
      const res = sanitizeRpcOrigin(input as string);
      expect(res).toBeNull();
    }

    // Directives built with only garbage inputs must remain identical to the base policy
    const directiveWithGarbage = buildConnectSrcDirective(garbageInputs);
    const baseDirective = `connect-src ${BASE_CONNECT_SRC_SOURCES.join(" ")}`;
    expect(directiveWithGarbage).toBe(baseDirective);
  });

  it("never includes server-only env variables in next.config.ts headers", () => {
    const nextConfigPath = path.resolve(process.cwd(), "next.config.ts");
    const nextConfigContent = fs.readFileSync(nextConfigPath, "utf8");

    // In headers(), only client-safe (NEXT_PUBLIC_) env vars may be referenced
    expect(nextConfigContent).not.toContain("process.env.BASE_SEPOLIA_RPC_URL");

    // Verify next.config.ts explicitly invokes buildConnectSrcDirective with ONLY NEXT_PUBLIC_ vars
    expect(nextConfigContent).toContain("process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC");
    expect(nextConfigContent).toContain("process.env.NEXT_PUBLIC_BASE_RPC_URL");
  });

  it("builds the expected final connect-src directive from realistic sample values", () => {
    const sampleSepolia = "https://base-sepolia.g.alchemy.com/v2/DEMO_KEY_12345";
    const sampleMainnet = "https://base-mainnet.g.alchemy.com/v2/DEMO_KEY_67890";

    const result = buildConnectSrcDirective([sampleSepolia, sampleMainnet]);

    // Check header structure
    expect(result.startsWith("connect-src ")).toBe(true);
    expect(result).toContain("'self'");
    expect(result).toContain("https://mainnet.base.org");
    expect(result).toContain("https://sepolia.base.org");
    expect(result).toContain("https://base-sepolia.g.alchemy.com");
    expect(result).toContain("https://base-mainnet.g.alchemy.com");

    // Ensure secrets are stripped
    expect(result).not.toContain("DEMO_KEY_12345");
    expect(result).not.toContain("DEMO_KEY_67890");
    expect(result).not.toContain("/v2/");

    // No semicolons inside the connect-src directive value
    expect(result).not.toContain(";");
  });
});

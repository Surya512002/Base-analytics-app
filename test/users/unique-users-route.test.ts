import { describe, it, expect, vi } from "vitest";
import { GET, POST } from "@/app/api/app/unique-users/route";
import * as redisModule from "@/lib/redis-unique-users";

describe("API: /api/app/unique-users Route Security & Verification", () => {
  it("GET returns 200 with ok: true and verified count", async () => {
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(typeof data.count).toBe("number");
    expect(typeof data.formatted).toBe("string");
  });

  it("POST rejects request missing txHash with HTTP 400", async () => {
    const req = new Request("http://localhost:3000/api/app/unique-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: "0x1111111111111111111111111111111111111111" }),
    });

    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toContain("txHash");
  });

  it("POST rejects request with invalid Ethereum address with HTTP 400", async () => {
    const req = new Request("http://localhost:3000/api/app/unique-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: "not-an-address",
        txHash: "0x52467d5bbbf878d6b8ec1159385ffca5f76b1f868c2d2aa6ffc5d57bba91f7a4",
      }),
    });

    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toContain("address");
  });

  it("POST succeeds with HTTP 200 when transaction verification succeeds", async () => {
    const spy = vi
      .spyOn(redisModule, "verifyAndRecordUserTransaction")
      .mockResolvedValueOnce({ success: true, count: 5 });

    const req = new Request("http://localhost:3000/api/app/unique-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: "0x1111111111111111111111111111111111111111",
        txHash: "0x52467d5bbbf878d6b8ec1159385ffca5f76b1f868c2d2aa6ffc5d57bba91f7a4",
      }),
    });

    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.count).toBe(5);

    spy.mockRestore();
  });
});

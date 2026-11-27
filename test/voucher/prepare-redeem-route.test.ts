import { describe, expect, it, vi } from "vitest";

const prepareRedeem = vi.fn(async () => ({ valid: true, calls: [] }));
vi.mock("@/lib/voucher/agent-api", () => ({ prepareRedeem, voucherContractReady: () => true }));

describe("gift redeem helper", () => {
  it("refuses a card code sent in the web address", async () => {
    const { GET } = await import("@/app/api/voucher/prepare-redeem/route");
    const res = GET();
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("POST");
    expect(prepareRedeem).not.toHaveBeenCalled();
  });

  it("accepts the card code in a POST body", async () => {
    const { POST } = await import("@/app/api/voucher/prepare-redeem/route");
    const res = await POST(
      new Request("http://x/api/voucher/prepare-redeem", { method: "POST", body: JSON.stringify({ cardId: "12-3", secret: "ABCDE" }) })
    );
    expect(res.status).toBe(200);
    expect(prepareRedeem).toHaveBeenCalledWith("12-3", "ABCDE");
  });
});

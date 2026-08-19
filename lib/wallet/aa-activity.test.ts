import { describe, expect, it } from "vitest";
import { countAaActivity, isWalletUserOp } from "@/lib/wallet/aa-activity";
import { ENTRYPOINT_V07 } from "@/lib/constants/contracts";
import type { AlchemyTransfer } from "@/lib/types/wallet";

const WALLET = "0xabc0000000000000000000000000000000000001";

function tx(over: Partial<AlchemyTransfer> & Pick<AlchemyTransfer, "hash">): AlchemyTransfer {
  return {
    category: "external",
    value: 0,
    asset: "ETH",
    from: WALLET,
    to: "0x1111111111111111111111111111111111111111",
    metadata: { blockTimestamp: "2026-08-19T00:00:00.000Z" },
    ...over,
  };
}

describe("countAaActivity", () => {
  it("ignores inbound internals on an EOA / Farcaster wallet", () => {
    const transfers = [
      tx({
        hash: "0xint1",
        category: "internal",
        from: "0x2222222222222222222222222222222222222222",
        to: WALLET,
        value: 0,
        metadata: {
          blockTimestamp: "2026-08-19T00:00:00.000Z",
          isSponsored: true,
          walletParticipated: true,
        },
      }),
      tx({
        hash: "0xext1",
        category: "external",
        from: WALLET,
        to: "0x3333333333333333333333333333333333333333",
        value: 0.2,
      }),
    ];
    expect(countAaActivity(transfers, WALLET)).toEqual({
      aaTxCount: 0,
      paymasterTxCount: 0,
    });
  });

  it("counts UserOps as AA and only sponsored UserOps as gasless", () => {
    const transfers = [
      tx({
        hash: "0xop1",
        category: "useroperation",
        to: ENTRYPOINT_V07,
        metadata: {
          blockTimestamp: "2026-08-19T00:00:00.000Z",
          isUserOperation: true,
          isSponsored: true,
          userOpHash: "0xaaa",
        },
      }),
      tx({
        hash: "0xop2",
        category: "useroperation",
        to: ENTRYPOINT_V07,
        metadata: {
          blockTimestamp: "2026-08-19T00:00:00.000Z",
          isUserOperation: true,
          isSponsored: false,
          userOpHash: "0xbbb",
        },
      }),
    ];
    expect(countAaActivity(transfers, WALLET)).toEqual({
      aaTxCount: 2,
      paymasterTxCount: 1,
    });
  });

  it("does not treat a plain EntryPoint send as AA without a UserOp flag", () => {
    expect(
      isWalletUserOp(
        tx({
          hash: "0xplain",
          category: "external",
          to: ENTRYPOINT_V07.toLowerCase(),
        }),
        WALLET
      )
    ).toBe(false);
  });

  it("ignores UserOps sent by a different address", () => {
    expect(
      countAaActivity(
        [
          tx({
            hash: "0xop-other",
            category: "useroperation",
            from: "0x9999999999999999999999999999999999999999",
            to: ENTRYPOINT_V07,
            metadata: {
              blockTimestamp: "2026-08-19T00:00:00.000Z",
              isUserOperation: true,
              isSponsored: true,
              userOpHash: "0xccc",
            },
          }),
        ],
        WALLET
      )
    ).toEqual({ aaTxCount: 0, paymasterTxCount: 0 });
  });
});

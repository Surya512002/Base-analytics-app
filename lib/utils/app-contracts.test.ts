import { describe, expect, it } from "vitest";
import { BOOSTER_CONTRACT, GM_GN_CONTRACT } from "@/lib/constants/contracts";
import { ENTRYPOINT_V07 } from "@/lib/constants/contracts";
import {
  buildAppActionHitsByHash,
  isPaymasterActivity,
} from "@/lib/utils/app-contracts";
import type { AlchemyTransfer } from "@/lib/types/wallet";

describe("buildAppActionHitsByHash", () => {
  const wallet = "0xabc000000000000000000000000000000000001";
  const hash = "0xdeadbeef";

  it("detects boost/gm via inner contract leg in paymaster batch", () => {
    const txs: AlchemyTransfer[] = [
      {
        hash,
        category: "useroperation",
        value: 0,
        asset: "ETH",
        from: wallet,
        to: ENTRYPOINT_V07.toLowerCase(),
        metadata: {
          blockTimestamp: "2026-01-01T00:00:00.000Z",
          isUserOperation: true,
          walletParticipated: true,
        },
      },
      {
        hash,
        category: "internal",
        value: 0,
        asset: "ETH",
        from: wallet,
        to: BOOSTER_CONTRACT.toLowerCase(),
        metadata: {
          blockTimestamp: "2026-01-01T00:00:00.000Z",
          walletParticipated: true,
        },
      },
    ];

    const hits = buildAppActionHitsByHash(txs, wallet);
    expect(hits.get(hash.toLowerCase())).toBe("booster");
  });

  it("detects gm when only inner leg targets GM contract", () => {
    const txs: AlchemyTransfer[] = [
      {
        hash,
        category: "useroperation",
        value: 0,
        asset: "ETH",
        from: wallet,
        to: ENTRYPOINT_V07.toLowerCase(),
        metadata: {
          blockTimestamp: "2026-01-01T00:00:00.000Z",
          isUserOperation: true,
        },
      },
      {
        hash,
        category: "internal",
        value: 0,
        asset: "ETH",
        from: "0x0000000000000000000000000000000000000001",
        to: GM_GN_CONTRACT.toLowerCase(),
        metadata: {
          blockTimestamp: "2026-01-01T00:00:00.000Z",
        },
      },
    ];

    const hits = buildAppActionHitsByHash(txs, wallet);
    expect(hits.get(hash.toLowerCase())).toBe("gm");
  });
});

describe("isPaymasterActivity", () => {
  const wallet = "0xabc000000000000000000000000000000000001";

  it("does not treat inbound internals as AA / gasless", () => {
    expect(
      isPaymasterActivity(
        {
          hash: "0xint",
          category: "internal",
          value: 0,
          asset: "ETH",
          from: "0x2222222222222222222222222222222222222222",
          to: wallet,
          metadata: {
            blockTimestamp: "2026-01-01T00:00:00.000Z",
            isSponsored: true,
            walletParticipated: true,
          },
        },
        wallet
      )
    ).toBe(false);
  });

  it("does not treat a plain EntryPoint send as paymaster activity", () => {
    expect(
      isPaymasterActivity(
        {
          hash: "0xep",
          category: "external",
          value: 0,
          asset: "ETH",
          from: wallet,
          to: ENTRYPOINT_V07.toLowerCase(),
          metadata: { blockTimestamp: "2026-01-01T00:00:00.000Z" },
        },
        wallet
      )
    ).toBe(false);
  });

  it("matches UserOps sent by the wallet", () => {
    expect(
      isPaymasterActivity(
        {
          hash: "0xop",
          category: "useroperation",
          value: 0,
          asset: "ETH",
          from: wallet,
          to: ENTRYPOINT_V07.toLowerCase(),
          metadata: {
            blockTimestamp: "2026-01-01T00:00:00.000Z",
            isUserOperation: true,
            isSponsored: true,
          },
        },
        wallet
      )
    ).toBe(true);
  });
});

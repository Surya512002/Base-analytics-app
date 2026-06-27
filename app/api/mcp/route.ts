import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  mcpLookupBatch,
  mcpPrepareCreate,
  mcpPrepareRedeem,
} from "@/lib/voucher/mcp-tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "voucher_prepare_create",
      {
        title: "Prepare Base Voucher gift card batch",
        description:
          "Prepare unsigned calldata and card secrets to create ETH/USDC gift cards on Base. " +
          "Returns calls[] for Base MCP send_calls and cards[] with cardId/secret/shareText. " +
          "Requires a separate Base MCP connection for wallet approval.",
        inputSchema: {
          total: z
            .string()
            .describe('Total deposit, e.g. "10" for $10 USDC or "0.01" for ETH'),
          cards: z
            .number()
            .int()
            .min(1)
            .max(50)
            .describe("Number of cards (1–50); total must divide evenly"),
          asset: z
            .enum(["USDC", "ETH"])
            .optional()
            .describe("Asset (default USDC)"),
          message: z
            .string()
            .optional()
            .describe("Optional message on cards (max 280 chars)"),
          creator: z
            .string()
            .optional()
            .describe("Creator wallet 0x… from Base MCP get_wallets (optimizes USDC approve)"),
        },
      },
      async ({ total, cards, asset, message, creator }) =>
        mcpPrepareCreate({ total, cards, asset, message, creator })
    );

    server.registerTool(
      "voucher_prepare_redeem",
      {
        title: "Prepare Base Voucher redeem",
        description:
          "Prepare unsigned redeem calldata for a gift card. Returns calls[] for Base MCP send_calls and preview amount.",
        inputSchema: {
          cardId: z
            .string()
            .describe('Card ID format "batchId-cardIndex", e.g. "12-3"'),
          secret: z
            .string()
            .describe("Gift card secret XXXXX-XXXXX-XXXXX-XXXXX"),
        },
      },
      async ({ cardId, secret }) => mcpPrepareRedeem({ cardId, secret })
    );

    server.registerTool(
      "voucher_lookup_batch",
      {
        title: "Lookup Base Voucher batch",
        description:
          "Read-only batch metadata (no secrets): amounts, card count, redemption status.",
        inputSchema: {
          batchId: z.number().int().min(1).describe("Onchain batch ID"),
        },
      },
      async ({ batchId }) => mcpLookupBatch(batchId)
    );
  },
  {},
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV === "development",
  }
);

export { handler as GET, handler as POST };

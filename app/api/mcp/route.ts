import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  mcpListByCreator,
  mcpLookupBatch,
  mcpPrepareCreate,
  mcpPrepareRedeem,
} from "@/lib/voucher/mcp-tools";
import { computeLiquidationStatus } from "@/lib/lending/liquidation-math";

export const runtime = "nodejs";
export const maxDuration = 60;

const MCP_API_KEY = process.env.MCP_API_KEY?.trim();

function assertMcpAuth(req: Request): Response | null {
  if (!MCP_API_KEY) return null;
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const apiKey = req.headers.get("x-api-key")?.trim();
  if (bearer === MCP_API_KEY || apiKey === MCP_API_KEY) return null;
  return new Response(JSON.stringify({ error: "Unauthorized MCP request" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

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
          unlock_timestamp: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Unix timestamp (seconds) before which cards cannot be redeemed (time-lock)"),
          expiration_timestamp: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Unix timestamp (seconds) after which cards expire and creator can reclaim"),
          required_signer: z
            .string()
            .optional()
            .describe("Optional 0x address requiring authorized signature to claim (conditional voucher)"),
        },
      },
      async ({ total, cards, asset, message, creator, unlock_timestamp, expiration_timestamp, required_signer }) =>
        mcpPrepareCreate({
          total,
          cards,
          asset,
          message,
          creator,
          unlockTimestamp: unlock_timestamp,
          expirationTimestamp: expiration_timestamp,
          requiredSigner: required_signer,
        })
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
        title: "Lookup Base Voucher batch status",
        description:
          "Live onchain batch metadata and per-card redemption status (no secrets). " +
          "Returns redeemedCount, unredeemedCount, and cards[] with redeemed flags.",
        inputSchema: {
          batchId: z.number().int().min(1).describe("Onchain batch ID"),
        },
      },
      async ({ batchId }) => mcpLookupBatch(batchId)
    );

    server.registerTool(
      "voucher_list_by_creator",
      {
        title: "List Base Voucher batches by creator wallet",
        description:
          "List all gift-card batches created by a wallet with live redemption counts. " +
          "Use the connected wallet from Base MCP get_wallets as creator. No card secrets returned.",
        inputSchema: {
          creator: z
            .string()
            .describe("Creator wallet 0x… from Base MCP get_wallets"),
        },
      },
      async ({ creator }) => mcpListByCreator(creator)
    );

    server.registerTool(
      "liquidation_status",
      {
        title: "Check Lending Liquidation Status & Remedy",
        description:
          "Calculate distance to liquidation, liquidation buffer USD, and exact deposit/repay amounts needed to achieve a safe health factor (1.50).",
        inputSchema: {
          healthFactor: z
            .number()
            .describe("Current onchain health factor, e.g. 1.15"),
          collateralUsd: z
            .number()
            .describe("Total collateral supplied in USD, e.g. 10000"),
          debtUsd: z
            .number()
            .describe("Total borrowed debt in USD, e.g. 7000"),
        },
      },
      async ({ healthFactor, collateralUsd, debtUsd }) => {
        const status = computeLiquidationStatus({
          healthFactor,
          totalCollateralUsd: collateralUsd,
          totalDebtUsd: debtUsd,
        });
        return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
      }
    );
  },
  {},
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV === "development",
  }
);

async function withAuth(
  req: Request,
  run: (req: Request) => Promise<Response>
): Promise<Response> {
  const denied = assertMcpAuth(req);
  if (denied) return denied;
  return run(req);
}

export async function GET(req: Request) {
  return withAuth(req, handler as (req: Request) => Promise<Response>);
}

export async function POST(req: Request) {
  return withAuth(req, handler as (req: Request) => Promise<Response>);
}

import { createClient } from "@farcaster/quick-auth";
import { getAddress } from "viem";
import { getAppUrl } from "@/lib/constants/app-url";

function authDomain(): string {
  try {
    return new URL(getAppUrl()).hostname;
  } catch {
    return "localhost";
  }
}

export async function verifyFarcasterSignIn(
  message: string,
  signature: string,
  expectedAddress?: string
): Promise<{ address: string } | { error: string }> {
  const domain = authDomain();
  const client = createClient();

  try {
    const { token } = await client.verifySiwf({
      message,
      signature,
      domain,
    });

    const payload = await client.verifyJwt({ token, domain });
    const rawAddress =
      typeof payload === "object" && payload && "address" in payload
        ? String((payload as { address?: string }).address ?? "")
        : "";

    if (!rawAddress.startsWith("0x")) {
      return { error: "Farcaster sign-in did not include a wallet address" };
    }

    const address = getAddress(rawAddress).toLowerCase();
    if (
      expectedAddress &&
      address !== expectedAddress.toLowerCase()
    ) {
      return { error: "Signed address does not match connected wallet" };
    }

    return { address };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Farcaster sign-in failed";
    return { error: msg };
  }
}

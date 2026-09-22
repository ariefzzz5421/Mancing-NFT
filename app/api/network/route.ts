import { createPublicClient, http, formatGwei } from "viem";
import { mainnet } from "viem/chains";
export async function GET() {
  try {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(
        process.env.ETHEREUM_RPC_URL ?? "https://ethereum-rpc.publicnode.com",
        { timeout: 6000, retryCount: 0 },
      ),
    });
    const gas = await client.getGasPrice();
    return Response.json(
      {
        state: "Operational",
        gasGwei: formatGwei(gas),
        updatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "public, s-maxage=30" } },
    );
  } catch {
    return Response.json({ state: "Offline", gasGwei: null }, { status: 503 });
  }
}

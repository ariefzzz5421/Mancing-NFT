import { createPublicClient, http, formatGwei } from "viem";
import { mainnet } from "viem/chains";
export async function GET() {
  try {
    if (process.env.ETHERSCAN_API_KEY) {
      try {
        const params = new URLSearchParams({ chainid: "1", module: "gastracker", action: "gasoracle", apikey: process.env.ETHERSCAN_API_KEY });
        const response = await fetch(`https://api.etherscan.io/v2/api?${params}`, { signal: AbortSignal.timeout(5000), next: { revalidate: 30 } });
        if (response.ok) {
          const data = await response.json() as { status?: string; result?: { ProposeGasPrice?: string } };
          const gas = Number(data.result?.ProposeGasPrice);
          if (data.status === "1" && Number.isFinite(gas) && gas > 0) return Response.json({ state: "Operational", gasGwei: String(gas), source: "etherscan", updatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "public, s-maxage=30" } });
        }
      } catch { /* Fall back to the configured RPC. */ }
    }
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

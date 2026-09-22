import { request, apiError, MarketError } from "@/lib/opensea/client";
import { record } from "@/lib/opensea/normalize";
import { SEAPORT } from "@/lib/web3/constants";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ hash: string }> },
) {
  try {
    const { hash } = await params;
    if (!/^0x[a-f0-9]{64}$/i.test(hash))
      throw new MarketError("Invalid order hash", 400);
    const r = record(
      await request(`/orders/chain/ethereum/protocol/${SEAPORT}/${hash}`, 0),
    );
    return Response.json(
      { status: typeof r.status === "string" ? r.status : "UNKNOWN" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}

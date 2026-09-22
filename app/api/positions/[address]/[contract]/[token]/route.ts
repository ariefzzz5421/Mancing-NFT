import { isAddress } from "viem";
import { request, apiError, MarketError } from "@/lib/opensea/client";
import { record, arr } from "@/lib/opensea/normalize";
export async function GET(
  _: Request,
  {
    params,
  }: { params: Promise<{ address: string; contract: string; token: string }> },
) {
  try {
    const { address, contract, token } = await params;
    if (!isAddress(address) || !isAddress(contract) || !/^\d+$/.test(token))
      throw new MarketError("Invalid position", 400);
    const raw = record(
      await request(
        `/events/chain/ethereum/contract/${contract}/nfts/${token}?limit=50`,
        0,
      ),
    );
    const events = arr(raw.asset_events)
      .map(record)
      .sort((a, b) => Number(b.event_timestamp) - Number(a.event_timestamp));
    const latest = events.find((e) =>
      ["sale", "transfer", "mint"].includes(String(e.event_type)),
    );
    const payment = record(latest?.payment);
    const buyer = String(
      latest?.buyer ??
        record(latest?.to_account).address ??
        latest?.to_address ??
        "",
    );
    const acquired =
      latest?.event_type === "sale" &&
      buyer.toLowerCase() === address.toLowerCase() &&
      Number(latest.quantity) === 1 &&
      Number(payment.decimals) === 18 &&
      ["ETH", "WETH"].includes(String(payment.symbol)) &&
      /^\d+$/.test(String(payment.quantity));
    return Response.json(
      {
        entryWei: acquired ? String(payment.quantity) : null,
        acquiredAt: acquired ? Number(latest.event_timestamp) * 1000 : null,
        source: acquired
          ? "OpenSea latest ownership event (sale)"
          : "Cost basis unavailable: latest event is not a verified purchase by this wallet",
        complete: !raw.next,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}

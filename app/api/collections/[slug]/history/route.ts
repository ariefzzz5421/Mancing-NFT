import { apiError, request } from "@/lib/opensea/client";
import { arr, record } from "@/lib/opensea/normalize";
import { formatEther } from "viem";

const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const ETH = "0x0000000000000000000000000000000000000000";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    if (!/^[a-z0-9][a-z0-9_-]{0,159}$/i.test(slug))
      return Response.json({ error: "Invalid collection slug." }, { status: 400 });
    const raw = record(await request(`/events/collection/${encodeURIComponent(slug)}?event_type=sale&limit=100`, 45));
    const events = arr(raw.asset_events);
    const points = events.flatMap((entry) => {
      const event = record(entry);
      const payment = record(event.payment);
      const token = String(payment.token_address ?? "").toLowerCase();
      const currency = token === ETH ? "ETH" : token === WETH ? "WETH" : null;
      const quantity = Number(event.quantity);
      const timestamp = Number(event.event_timestamp);
      const value = String(payment.quantity ?? "");
      if (currency === null || quantity !== 1 || Number(payment.decimals) !== 18 || !/^\d+$/.test(value) || !Number.isFinite(timestamp) || timestamp <= 0)
        return [];
      const priceEth = Number(formatEther(BigInt(value)));
      if (!Number.isFinite(priceEth) || priceEth <= 0) return [];
      return [{ id: String(record(event.transaction).transaction_hash ?? event.order_hash ?? `${timestamp}:${value}`), timestamp, priceEth, currency }];
    }).sort((a, b) => a.timestamp - b.timestamp);
    return Response.json({ points, excluded: events.length - points.length, updatedAt: new Date().toISOString(), coverage: "Recent OpenSea sale events in ETH or WETH only" }, {
      headers: { "Cache-Control": "public, s-maxage=45, stale-while-revalidate=30" },
    });
  } catch (error) {
    return apiError(error);
  }
}

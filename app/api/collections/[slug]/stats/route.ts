import { request, apiError } from "@/lib/opensea/client";
import { normalizeStats, record, arr } from "@/lib/opensea/normalize";
import { formatEther } from "viem";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const [stats, event] = await Promise.allSettled([
      request(`/collections/${encodeURIComponent(slug)}/stats`, 45),
      request(
        `/events/collection/${encodeURIComponent(slug)}?event_type=sale&limit=1`,
        45,
      ),
    ]);
    if (stats.status === "rejected") throw stats.reason;
    const normalized = normalizeStats(stats.value);
    if (event.status === "fulfilled") {
      const sale = record(arr(record(event.value).asset_events)[0]),
        payment = record(sale.payment);
      if (
        Number(payment.decimals) === 18 &&
        ["ETH", "WETH"].includes(String(payment.symbol)) &&
        /^\d+$/.test(String(payment.quantity)) &&
        Number(sale.quantity) === 1
      )
        normalized.lastSale = Number(
          formatEther(BigInt(String(payment.quantity))),
        );
    }
    return Response.json(normalized);
  } catch (e) {
    return apiError(e);
  }
}

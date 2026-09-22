import { isAddress } from "viem";
import { request, apiError, MarketError } from "@/lib/opensea/client";
import { record, arr, normalizeOrder } from "@/lib/opensea/normalize";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params;
    if (!isAddress(address)) throw new MarketError("Invalid address", 400);
    const q = new URL(req.url).searchParams,
      kind = q.get("kind") ?? "nfts",
      cursor = q.get("cursor");
    if (!["nfts", "offers", "listings", "events"].includes(kind))
      throw new MarketError("Invalid resource", 400);
    let path =
      kind === "nfts"
        ? `/chain/ethereum/account/${address}/nfts?limit=50`
        : kind === "events"
          ? `/events/accounts/${address}?chain=ethereum&limit=50`
          : `/account/${address}/${kind}?chains=ethereum&limit=50`;
    if (cursor)
      path += `&${kind === "offers" || kind === "listings" ? "after" : "next"}=${encodeURIComponent(cursor)}`;
    if (kind === "nfts" && q.get("collection"))
      path += `&collection=${encodeURIComponent(q.get("collection")!)}`;
    const raw = record(await request(path, 0));
    let rows: unknown[] = [];
    if (kind === "nfts")
      rows = arr(raw.nfts).map((x) => {
        const n = record(x);
        return {
          tokenId: String(n.identifier ?? ""),
          contract: String(n.contract ?? ""),
          collection: String(n.collection ?? ""),
          name: String(n.name ?? `#${n.identifier}`),
          image: typeof n.image_url === "string" ? n.image_url : null,
          standard: String(n.token_standard ?? ""),
        };
      });
    else if (kind === "events") rows = arr(raw.asset_events ?? raw.events);
    else
      rows = arr(raw[kind]).flatMap((x) => {
        const n = normalizeOrder(
          x,
          kind === "offers" ? "bid" : "ask",
          Math.floor(Date.now() / 1000),
          false,
        );
        return n
          ? [{ ...n, parameters: record(record(x).protocol_data).parameters }]
          : [];
      });
    return Response.json(
      {
        rows,
        next: raw.next ?? raw.next_cursor ?? null,
        coverage: "One page; load more to extend coverage",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}

import { isAddress } from "viem";
import { authenticatedOwner, database, databaseConfigured } from "@/lib/server/watchlist-store";
import { sameOrigin } from "@/lib/server/wallet-session";
import { request, apiError, MarketError } from "@/lib/opensea/client";
import { arr, normalizeCollection, record } from "@/lib/opensea/normalize";
import { SEAPORT, WETH } from "@/lib/web3/constants";

type LegacyReference = { hash: string; collection: string };

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) throw new MarketError("Same-origin request required.", 403);
    const owner = await authenticatedOwner(req);
    if (!owner) throw new MarketError("Sign in with your wallet to import prior orders.", 401);
    if (!databaseConfigured()) throw new MarketError("Trade database is not configured.", 503);
    const body = await req.json();
    const refs: LegacyReference[] = Array.isArray(body.orders) ? body.orders : [];
    if (!refs.length || refs.length > 10 || refs.some((item) => !/^0x[a-f0-9]{64}$/i.test(item.hash) ||
      !/^[a-z0-9][a-z0-9_-]{0,159}$/i.test(item.collection)))
      throw new MarketError("Import up to 10 valid browser order references at a time.", 400);
    const wallet = owner.slice("wallet:".length);
    let imported = 0;
    const skipped: string[] = [];
    for (const ref of refs) {
      try {
        const raw = record(await request(`/orders/chain/ethereum/protocol/${SEAPORT}/${ref.hash}`, 0));
        const params = record(record(raw.protocol_data).parameters);
        if (String(raw.chain) !== "ethereum" || String(params.offerer).toLowerCase() !== wallet ||
            String(raw.protocol_address).toLowerCase() !== SEAPORT.toLowerCase()) throw Error("Order does not belong to this Ethereum wallet.");
        const offeredNft = arr(params.offer).map(record).find((item) => Number(item.itemType) >= 2);
        const side = offeredNft ? "LIST" : "OFFER";
        const nft = offeredNft ?? arr(params.consideration).map(record).find((item) => Number(item.itemType) >= 2);
        const collection = normalizeCollection(await request(`/collections/${encodeURIComponent(ref.collection)}`, 300), ref.collection);
        if (!nft || !collection.contract || !isAddress(collection.contract) ||
            String(nft.token).toLowerCase() !== collection.contract.toLowerCase()) throw Error("Collection contract mismatch.");
        const quantity = Number(nft.startAmount);
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) throw Error("Unsupported order quantity.");
        const currency = record(arr(params.offer)[0]);
        if (side === "OFFER" && (Number(currency.itemType) !== 1 || String(currency.token).toLowerCase() !== WETH.toLowerCase())) throw Error("Unsupported currency.");
        const total = side === "OFFER" ? BigInt(String(currency.startAmount)) : arr(params.consideration).map(record)
          .filter((item) => Number(item.itemType) === 0).reduce((sum, item) => sum + BigInt(String(item.startAmount)), 0n);
        if (total <= 0n || total % BigInt(quantity) !== 0n) throw Error("Unsupported price.");
        const status = ["ACTIVE", "FULFILLED", "CANCELLED", "EXPIRED"].includes(String(raw.status)) ? String(raw.status) : "FAILED";
        const expiration = Number(params.endTime);
        const created = Number(raw.order_created_at ?? params.startTime);
        const { error } = await database().from("trade_orders").upsert({
          owner_id: owner, wallet_address: wallet, order_hash: ref.hash,
          collection_slug: ref.collection, contract_address: collection.contract.toLowerCase(),
          token_id: side === "LIST" ? String(nft.identifierOrCriteria) : null,
          side, price_wei: (total / BigInt(quantity)).toString(), quantity, status,
          created_at: Number.isSafeInteger(created) && created > 0 ? new Date(created * 1000).toISOString() : new Date().toISOString(),
          expires_at: Number.isSafeInteger(expiration) && expiration > 0 ? new Date(expiration * 1000).toISOString() : null,
        }, { onConflict: "order_hash" });
        if (error) throw Error("Database import failed.");
        imported++;
      } catch { skipped.push(ref.hash); }
    }
    return Response.json({ imported, skipped }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) { return apiError(cause); }
}

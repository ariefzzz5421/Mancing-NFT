import { isAddress, recoverTypedDataAddress } from "viem";
import { request, apiError, MarketError } from "@/lib/opensea/client";
import { SEAPORT, WETH } from "@/lib/web3/constants";
import { seaportTypes } from "@/lib/web3/seaport-types";
import { normalizeCollection, record, arr } from "@/lib/opensea/normalize";
import { sessionAddress } from "@/lib/server/wallet-session";
import { saveSubmittedTrade, markVerifiedPositionListed } from "@/lib/server/trade-store";
export async function POST(req: Request) {
  try {
    if (req.headers.get("origin") !== new URL(req.url).origin)
      throw new MarketError("Same-origin request required", 403);
    const text = await req.text();
    if (text.length > 50000) throw new MarketError("Order too large", 400);
    const b = JSON.parse(text);
    if (
      !["LIST", "OFFER"].includes(b.mode) ||
      !isAddress(b.order?.parameters?.offerer) ||
      !/^0x[0-9a-f]+$/i.test(b.order?.signature) ||
      typeof b.slug !== "string" || !/^[a-z0-9][a-z0-9_-]{0,159}$/i.test(b.slug)
    )
      throw new MarketError("Invalid signed order", 400);
    const recovered = await recoverTypedDataAddress({
      domain: {
        name: "Seaport",
        version: "1.6",
        chainId: 1,
        verifyingContract: SEAPORT,
      },
      types: seaportTypes,
      primaryType: "OrderComponents",
      message: b.order.parameters,
      signature: b.order.signature,
    });
    if (recovered.toLowerCase() !== b.order.parameters.offerer.toLowerCase())
      throw new MarketError("Order signature does not match maker", 400);
    const wallet = sessionAddress(req);
    if (!wallet || wallet !== recovered.toLowerCase())
      throw new MarketError("Sign in with the wallet that signed this order, then submit again.", 401);
    const collection = normalizeCollection(await request(`/collections/${encodeURIComponent(b.slug)}`, 0), b.slug);
    const parameters = record(b.order.parameters);
    const nft = record(arr(b.mode === "OFFER" ? parameters.consideration : parameters.offer)[0]);
    if (collection.chain !== "ethereum" || !collection.contract ||
        String(nft.token).toLowerCase() !== collection.contract.toLowerCase() ||
        ![2, 4].includes(Number(nft.itemType)))
      throw new MarketError("Signed NFT contract does not match the selected Ethereum collection.", 400);
    const quantity = Number(nft.startAmount);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100)
      throw new MarketError("Invalid signed NFT quantity.", 400);
    const currency = b.mode === "OFFER" ? record(arr(parameters.offer)[0]) : null;
    const consideration = arr(parameters.consideration).map(record);
    if (b.mode === "OFFER" && (Number(currency?.itemType) !== 1 || String(currency?.token).toLowerCase() !== WETH.toLowerCase()))
      throw new MarketError("Only WETH collection offers are supported.", 400);
    if (b.mode === "LIST" && consideration.some((item) => Number(item.itemType) !== 0))
      throw new MarketError("Only ETH listings are supported.", 400);
    const amounts = b.mode === "OFFER" ? [currency?.startAmount] : consideration.map((item) => item.startAmount);
    if (amounts.some((amount) => typeof amount !== "string" || !/^\d+$/.test(amount)))
      throw new MarketError("Invalid signed order amounts.", 400);
    const endTime = Number(parameters.endTime);
    if (!Number.isSafeInteger(endTime) || endTime <= Date.now() / 1000 || endTime > Date.now() / 1000 + 8 * 86400)
      throw new MarketError("Signed order expiration is invalid.", 400);
    const total = b.mode === "OFFER"
      ? BigInt(String(currency?.startAmount ?? "0"))
      : consideration.filter((item) => Number(item.itemType) === 0)
          .reduce((sum, item) => sum + BigInt(String(item.startAmount ?? "0")), 0n);
    if (total <= 0n || total % BigInt(quantity) !== 0n)
      throw new MarketError("Invalid signed order price.", 400);
    const payload =
      b.mode === "OFFER"
        ? {
            protocol_data: b.order,
            protocol_address: SEAPORT,
            criteria: b.criteria,
          }
        : { ...b.order, protocol_address: SEAPORT };
    const submitted = record(await request(
        b.mode === "OFFER" ? "/offers" : "/orders/ethereum/seaport/listings",
        0,
        payload,
      ));
    const hash = String(submitted.order_hash ?? "");
    let history: { saved: boolean; error: string | null } = { saved: false, error: "OpenSea did not return an order hash" };
    if (/^0x[a-f0-9]{64}$/i.test(hash)) {
      try {
        history = await saveSubmittedTrade({
          wallet, hash, slug: b.slug, contract: collection.contract,
          tokenId: b.mode === "LIST" ? String(nft.identifierOrCriteria) : null,
          side: b.mode, priceWei: (total / BigInt(quantity)).toString(), quantity,
          expiresAt: new Date(endTime * 1000).toISOString(),
        });
        if (history.saved && b.mode === "LIST")
          await markVerifiedPositionListed({ wallet, contract: collection.contract, tokenId: String(nft.identifierOrCriteria), priceWei: (total / BigInt(quantity)).toString() });
      } catch (error) {
        history = { saved: false, error: error instanceof Error ? error.message : "Database write failed" };
      }
    }
    return Response.json({ ...submitted, historySaved: history.saved, historyError: history.saved ? null : "Order accepted, but cloud history is unavailable. Local backup was kept." });
  } catch (e) {
    return apiError(e);
  }
}

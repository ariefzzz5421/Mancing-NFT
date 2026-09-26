import { Interface } from "ethers";
import { SeaportABI } from "@opensea/seaport-js/lib/abi/Seaport";
import { isAddress } from "viem";
import { request, apiError, MarketError } from "@/lib/opensea/client";
import { record, normalizeOrder } from "@/lib/opensea/normalize";
import { SEAPORT } from "@/lib/web3/constants";
export async function POST(req: Request) {
  try {
    if (req.headers.get("origin") !== new URL(req.url).origin)
      throw new MarketError("Same-origin request required", 403);
    const b = await req.json();
    if (!isAddress(b.address) || !isAddress(b.contract) || !/^0x[a-f0-9]{64}$/i.test(b.hash))
      throw new MarketError("Invalid buyer or order", 400);
    const raw = record(
      await request(`/orders/chain/ethereum/protocol/${SEAPORT}/${b.hash}`, 0),
    );
    const listing = normalizeOrder(raw, "ask");
    if (
      !listing ||
      listing.quantity !== 1 ||
      listing.tokenAddress?.toLowerCase() !== b.contract.toLowerCase() ||
      record(record(raw.price).current).currency !== "ETH"
    )
      throw new MarketError(
        "Listing is inactive, changed collection, or is not a single-item ETH listing",
        400,
      );
    const r = record(
      await request("/listings/fulfillment_data", 0, {
        listing: { hash: b.hash, chain: "ethereum", protocol_address: SEAPORT },
        fulfiller: { address: b.address },
        units_to_fill: 1,
        include_optional_creator_fees: b.includeRoyalty === true,
      }),
    );
    const tx = record(record(r.fulfillment_data).transaction);
    if (
      String(tx.to).toLowerCase() !== SEAPORT.toLowerCase() ||
      Number(tx.chain) !== 1 ||
      typeof tx.value !== "string" ||
      !/^\d+$/.test(tx.value)
    )
      throw new MarketError("Unsupported fulfillment transaction", 400);
    const iface = new Interface(SeaportABI),
      fn = iface.getFunction(String(tx.function));
    if (!fn || !fn.name.startsWith("fulfill") || fn.name.includes("Available"))
      throw new MarketError("Unsupported fulfillment method", 400);
    const inputs = record(tx.input_data);
    const data = iface.encodeFunctionData(
      fn,
      fn.inputs.map((i) => inputs[i.name]),
    );
    return Response.json(
      {
        to: SEAPORT,
        data,
        value: tx.value,
        priceWei: listing.priceWei,
        tokenId: listing.tokenId,
        contract: listing.tokenAddress,
        hash: listing.orderHash,
        expiresAt: Date.now() + 45000,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}

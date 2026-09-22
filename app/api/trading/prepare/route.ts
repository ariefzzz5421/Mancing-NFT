import { isAddress } from "viem";
import { request, apiError, MarketError } from "@/lib/opensea/client";
import { normalizeCollection, record, arr } from "@/lib/opensea/normalize";
import { wei } from "@/lib/quant/book";
import { SEAPORT, WETH } from "@/lib/web3/constants";
export async function POST(req: Request) {
  try {
    if (req.headers.get("origin") !== new URL(req.url).origin)
      throw new MarketError("Same-origin request required", 403);
    const b = await req.json();
    if (
      !isAddress(b.address) ||
      typeof b.slug !== "string" ||
      b.slug.length > 200 ||
      !["OFFER", "LIST"].includes(b.mode)
    )
      throw new MarketError("Invalid order request", 400);
    const amount = wei(String(b.price));
    if (
      !amount ||
      !Number.isSafeInteger(b.quantity) ||
      b.quantity < 1 ||
      b.quantity > 100 ||
      ![6, 12, 24, 72, 168].includes(b.hours)
    )
      throw new MarketError("Invalid price, quantity or expiration", 400);
    const c = normalizeCollection(
      await request(`/collections/${encodeURIComponent(b.slug)}`, 0),
      b.slug,
    );
    if (c.chain !== "ethereum" || !c.contract)
      throw new MarketError(
        "Trading currently supports Ethereum collections only",
        400,
      );
    const fees = c.fees
      .filter((f) => f.required || b.includeRoyalty === true)
      .map((f) => ({ recipient: f.recipient, basisPoints: f.bps }));
    if (
      fees.some(
        (f) =>
          !isAddress(f.recipient) ||
          !Number.isSafeInteger(f.basisPoints) ||
          f.basisPoints < 0,
      ) ||
      fees.reduce((s, f) => s + f.basisPoints, 0) >= 10000
    )
      throw new MarketError("Invalid collection fee schedule", 400);
    const common = {
      endTime: String(Math.floor(Date.now() / 1000) + b.hours * 3600),
      fees,
    };
    if (b.mode === "OFFER") {
      const partial = record(
        await request("/offers/build", 0, {
          offerer: b.address,
          quantity: b.quantity,
          criteria: { collection: { slug: b.slug } },
          protocol_address: SEAPORT,
          offer_protection_enabled: true,
        }),
      );
      const p = record(partial.partialParameters);
      const items = arr(p.consideration).map(record);
      if (
        items.length !== 1 ||
        Number(items[0].itemType) !== 4 ||
        String(items[0].token).toLowerCase() !== c.contract.toLowerCase()
      )
        throw new MarketError(
          "Unsupported collection-offer parameters; order was not prepared",
          400,
        );
      return Response.json({
        input: {
          ...common,
          zone: p.zone,
          zoneHash: p.zoneHash,
          restrictedByZone: true,
          allowPartialFills: b.quantity > 1,
          offer: [
            { token: WETH, amount: (amount * BigInt(b.quantity)).toString() },
          ],
          consideration: [
            {
              itemType: 2,
              token: c.contract,
              criteria: String(items[0].identifierOrCriteria),
              amount: String(b.quantity),
              recipient: b.address,
            },
          ],
        },
        criteria: partial.criteria,
        fees,
        protocol: SEAPORT,
      });
    }
    if (!/^\d+$/.test(String(b.tokenId)) || b.quantity !== 1)
      throw new MarketError("Select one owned ERC-721 NFT", 400);
    return Response.json({
      input: {
        ...common,
        offer: [{ itemType: 2, token: c.contract, identifier: b.tokenId }],
        consideration: [{ amount: amount.toString(), recipient: b.address }],
      },
      fees,
      protocol: SEAPORT,
    });
  } catch (e) {
    return apiError(e);
  }
}

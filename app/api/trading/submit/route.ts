import { isAddress, recoverTypedDataAddress } from "viem";
import { request, apiError, MarketError } from "@/lib/opensea/client";
import { SEAPORT } from "@/lib/web3/constants";
import { seaportTypes } from "@/lib/web3/seaport-types";
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
      !/^0x[0-9a-f]+$/i.test(b.order?.signature)
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
    const payload =
      b.mode === "OFFER"
        ? {
            protocol_data: b.order,
            protocol_address: SEAPORT,
            criteria: b.criteria,
          }
        : { ...b.order, protocol_address: SEAPORT };
    return Response.json(
      await request(
        b.mode === "OFFER" ? "/offers" : "/orders/ethereum/seaport/listings",
        0,
        payload,
      ),
    );
  } catch (e) {
    return apiError(e);
  }
}

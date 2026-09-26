import { formatEther } from "viem";

/** One visible decimal tick above a collection bid, with at least four ETH decimals. */
export function topOfferPrice(bestBidWei: bigint, bestAskWei?: bigint | null) {
  if (bestBidWei <= 0n) return null;
  const fraction = formatEther(bestBidWei).split(".")[1]?.replace(/0+$/, "") ?? "";
  const places = Math.min(18, Math.max(4, fraction.length));
  const tickWei = 10n ** BigInt(18 - places);
  const priceWei = bestBidWei + tickWei;
  if (bestAskWei && priceWei >= bestAskWei) return null;
  return { priceWei, tickWei, priceEth: formatEther(priceWei) };
}

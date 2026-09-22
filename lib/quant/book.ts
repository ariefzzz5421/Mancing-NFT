import { formatEther, parseEther } from "viem";
import type { Level, NormalizedOrder, Side } from "@/types/market";
export function wei(value: string) {
  try {
    if (!/^\d+(\.\d{0,18})?$/.test(value)) return null;
    return parseEther(value);
  } catch {
    return null;
  }
}
export function eth(value: string | bigint | null | undefined) {
  if (value == null) return "—";
  return formatEther(BigInt(value));
}
export function price(value: number | null | undefined) {
  return value == null || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString("en-US", { maximumSignificantDigits: 7 });
}
export function aggregate(
  orders: NormalizedOrder[],
  side: Side,
  tick = 1n,
): Level[] {
  const grouped = new Map<string, Level>();
  for (const o of orders.filter((o) => o.side === side)) {
    const p = BigInt(o.priceWei),
      step = tick > 0n ? tick : 1n;
    const bucket = (
      side === "ask" ? ((p + step - 1n) / step) * step : (p / step) * step
    ).toString();
    const row = grouped.get(bucket) ?? {
      priceWei: bucket,
      quantity: 0,
      cumulativeQuantity: 0,
      valueWei: "0",
      cumulativeValueWei: "0",
      orders: [],
    };
    row.quantity += o.quantity;
    row.valueWei = (BigInt(row.valueWei) + p * BigInt(o.quantity)).toString();
    row.orders.push(o);
    grouped.set(bucket, row);
  }
  let quantity = 0,
    value = 0n;
  return [...grouped.values()]
    .sort(
      (a, b) =>
        (BigInt(a.priceWei) < BigInt(b.priceWei) ? -1 : 1) *
        (side === "ask" ? 1 : -1),
    )
    .map((row) => {
      quantity += row.quantity;
      value += BigInt(row.valueWei);
      return {
        ...row,
        cumulativeQuantity: quantity,
        cumulativeValueWei: value.toString(),
      };
    });
}
export function spread(bid?: string, ask?: string) {
  if (!bid || !ask || BigInt(bid) <= 0n) return null;
  const absolute = BigInt(ask) - BigInt(bid);
  return { absolute, bps: Math.round(Number(absolute * 1000000n / BigInt(bid)) / 100) };
}
export function edge(
  entry: bigint,
  exit: bigint,
  quantity: number,
  feeBps: number,
  royaltyBps: number,
  gas: bigint,
  slippageBps: number,
) {
  if (
    entry <= 0n ||
    exit <= 0n ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    [feeBps, royaltyBps, slippageBps].some(
      (x) => !Number.isSafeInteger(x) || x < 0 || x > 10000,
    ) ||
    feeBps + royaltyBps > 10000 ||
    gas < 0n
  )
    return null;
  const capital = entry * BigInt(quantity),
    gross = exit * BigInt(quantity),
    fees = (gross * BigInt(feeBps)) / 10000n,
    royalty = (gross * BigInt(royaltyBps)) / 10000n,
    slippage = (gross * BigInt(slippageBps)) / 10000n;
  const proceeds = gross - fees - royalty - slippage - gas,
    net = proceeds - capital;
  return {
    capital,
    gross,
    fees,
    royalty,
    slippage,
    proceeds,
    net,
    roiBps: Number((net * 10000n) / capital),
  };
}
export function liquidity(levels: Level[], side: Side) {
  const qty = levels.reduce((s, l) => s + l.quantity, 0),
    total = levels.reduce((s, l) => s + BigInt(l.valueWei), 0n),
    best = BigInt(levels[0]?.priceWei ?? 0);
  return {
    qty,
    total,
    average: qty ? total / BigInt(qty) : null,
    bands: [1, 2, 5, 10].map((percent) => ({
      percent,
      quantity: levels
        .filter((l) =>
          side === "ask"
            ? BigInt(l.priceWei) * 100n <= best * BigInt(100 + percent)
            : BigInt(l.priceWei) * 100n >= best * BigInt(100 - percent),
        )
        .reduce((s, l) => s + l.quantity, 0),
    })),
  };
}
export function sweep(asks: Level[], target: bigint, complete: boolean) {
  const levels = asks.filter((l) => BigInt(l.priceWei) < target),
    quantity = levels.reduce((s, l) => s + l.quantity, 0),
    capital = levels.reduce((s, l) => s + BigInt(l.valueWei), 0n);
  const next = asks.find((l) => BigInt(l.priceWei) >= target)?.priceWei ?? null;
  return {
    quantity,
    capital,
    average: quantity ? capital / BigInt(quantity) : null,
    highest: levels.at(-1)?.priceWei ?? null,
    next,
    complete,
  };
}

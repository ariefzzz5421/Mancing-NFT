import type { ActivityEventType, NormalizedActivityEvent } from "@/lib/types";
import { getTransactionExplorerUrl, type SupportedChain } from "@/lib/chains";

type UnknownRecord = Record<string, unknown>;

const supportedEventTypes = new Set<ActivityEventType>([
  "sale",
  "transfer",
  "mint",
  "listing",
  "offer",
  "trait_offer",
  "collection_offer",
]);

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readPath(value: unknown, path: Array<string | number>): unknown {
  return path.reduce<unknown>((current, key) => {
    if (typeof key === "number") {
      return Array.isArray(current) ? current[key] : undefined;
    }

    return isRecord(current) ? current[key] : undefined;
  }, value);
}

function readString(value: unknown) {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function firstString(source: unknown, paths: Array<Array<string | number>>) {
  for (const path of paths) {
    const value = readString(readPath(source, path));

    if (value) {
      return value;
    }
  }

  return null;
}

function firstNumber(source: unknown, paths: Array<Array<string | number>>) {
  for (const path of paths) {
    const value = readNumber(readPath(source, path));

    if (value !== null) {
      return value;
    }
  }

  return null;
}

function baseUnitsToNumber(value: string, decimals: number) {
  if (value.includes(".")) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const clean = value.replace(/^0+(?=\d)/, "");
  const normalized = clean || "0";

  if (decimals <= 0) {
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const padded = normalized.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, "");
  const decimal = fraction ? `${whole}.${fraction.slice(0, 18)}` : whole;
  const parsed = Number(decimal);

  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeEventType(value: string | null): ActivityEventType {
  const normalized = value?.toLowerCase().replace(/-/g, "_");

  switch (normalized) {
    case "item_sold":
      return "sale";
    case "item_transferred":
      return "transfer";
    case "item_minted":
      return "mint";
    case "item_listed":
      return "listing";
    case "item_received_offer":
    case "item_offered":
      return "offer";
    default:
      break;
  }

  return normalized && supportedEventTypes.has(normalized as ActivityEventType)
    ? (normalized as ActivityEventType)
    : "unknown";
}

function normalizeTimestamp(value: string | null) {
  if (!value) {
    return new Date().toISOString();
  }

  const numeric = Number(value);
  const date =
    Number.isFinite(numeric) && value.length <= 13
      ? new Date(numeric * 1000)
      : new Date(value);

  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function readPrice(event: unknown) {
  const rawValue =
    firstString(event, [
      ["payment", "quantity"],
      ["payment", "value"],
      ["price", "current", "value"],
      ["price", "value"],
      ["price", "quantity"],
      ["base_price"],
      ["protocol_data", "parameters", "consideration", 0, "startAmount"],
    ]) ?? null;
  const decimals =
    firstNumber(event, [
      ["payment", "decimals"],
      ["payment", "token", "decimals"],
      ["price", "current", "decimals"],
      ["price", "decimals"],
      ["payment_token", "decimals"],
    ]) ?? 18;
  const paymentSymbol =
    firstString(event, [
      ["payment", "symbol"],
      ["payment", "token", "symbol"],
      ["price", "current", "currency"],
      ["price", "currency"],
      ["payment_token", "symbol"],
    ]) ?? undefined;

  if (!rawValue) {
    return { paymentSymbol };
  }

  const priceEth = baseUnitsToNumber(rawValue, decimals);
  return {
    paymentSymbol,
    priceEth: priceEth !== null && priceEth > 0 ? priceEth : undefined,
  };
}

function readAddress(event: unknown, paths: Array<Array<string | number>>) {
  const value = firstString(event, paths);
  return value?.startsWith("0x") ? value : value ?? undefined;
}

export function normalizeActivityEvent(
  event: unknown,
  chain: SupportedChain = "ethereum",
): NormalizedActivityEvent {
  let eventType = normalizeEventType(
    firstString(event, [["event_type"], ["eventType"], ["type"]]),
  );
  const timestamp = normalizeTimestamp(
    firstString(event, [
      ["event_timestamp"],
      ["created_date"],
      ["created_at"],
      ["transaction", "timestamp"],
      ["timestamp"],
    ]),
  );
  const tokenId =
    firstString(event, [
      ["nft", "identifier"],
      ["nft", "token_id"],
      ["asset", "identifier"],
      ["asset", "token_id"],
      ["token", "id"],
      ["token_id"],
    ]) ?? undefined;
  const tokenName =
    firstString(event, [
      ["nft", "name"],
      ["asset", "name"],
      ["token", "name"],
    ]) ?? undefined;
  const imageUrl =
    firstString(event, [
      ["nft", "image_url"],
      ["asset", "image_url"],
      ["token", "image_url"],
    ]) ?? undefined;
  const txHash =
    firstString(event, [
      ["transaction"],
      ["transaction", "transaction_hash"],
      ["transaction", "hash"],
      ["transaction_hash"],
      ["tx_hash"],
      ["txHash"],
    ]) ?? undefined;
  const orderHash =
    firstString(event, [
      ["order_hash"],
      ["orderHash"],
      ["order", "order_hash"],
      ["listing", "order_hash"],
      ["offer", "order_hash"],
      ["protocol_data", "parameters", "orderHash"],
    ]) ?? undefined;
  const openseaUrl =
    firstString(event, [
      ["nft", "opensea_url"],
      ["nft", "permalink"],
      ["asset", "permalink"],
      ["asset", "opensea_url"],
    ]) ?? undefined;
  const { paymentSymbol, priceEth } = readPrice(event);
  const buyer = readAddress(event, [
    ["buyer"],
    ["buyer", "address"],
    ["winner_account", "address"],
    ["to_account", "address"],
    ["to_address"],
  ]);
  const seller = readAddress(event, [
    ["seller"],
    ["seller", "address"],
    ["seller_account", "address"],
    ["from_account", "address"],
    ["from_address"],
  ]);
  const maker = readAddress(event, [
    ["maker", "address"],
    ["maker_account", "address"],
    ["account", "address"],
  ]);
  const from = readAddress(event, [
    ["from_account", "address"],
    ["from_address"],
    ["from", "address"],
  ]);
  const to = readAddress(event, [
    ["to_account", "address"],
    ["to_address"],
    ["to", "address"],
  ]);
  const id =
    firstString(event, [["id"], ["event_id"], ["eventId"]]) ??
    [eventType, tokenId, txHash, orderHash, timestamp].filter(Boolean).join(":");

  if (eventType === "unknown") {
    if (txHash && priceEth && (buyer || seller)) {
      eventType = "sale";
    } else if (txHash && (from || to)) {
      eventType = "transfer";
    } else if (orderHash && maker) {
      eventType = "offer";
    } else if (orderHash) {
      eventType = "listing";
    }
  }

  return {
    buyer,
    etherscanUrl: txHash ? getTransactionExplorerUrl(chain, txHash) : undefined,
    eventType,
    from,
    id,
    imageUrl,
    maker,
    openseaUrl,
    orderHash,
    paymentSymbol,
    priceEth,
    seller,
    timestamp,
    to,
    tokenId,
    tokenName,
    txHash,
  };
}

export function normalizeActivityEvents(
  events: unknown[],
  chain: SupportedChain = "ethereum",
) {
  return events.map((event) => normalizeActivityEvent(event, chain));
}

export function buildActivityWarnings(events: NormalizedActivityEvent[]) {
  const sales = events.filter((event) => event.eventType === "sale").length;
  const transfers = events.filter((event) => event.eventType === "transfer").length;
  const listings = events.filter((event) => event.eventType === "listing").length;
  const warnings: string[] = [];

  if (transfers >= 8 && transfers > sales * 3) {
    warnings.push("Activity has many transfers but few sales. Check whether volume is real demand.");
  }

  if (listings >= 6 && sales <= 1) {
    warnings.push("Floor may be moving through listings while sales remain low.");
  }

  return warnings;
}

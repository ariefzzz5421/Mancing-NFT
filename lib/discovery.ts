import { getChainConfig, isSupportedChain } from "@/lib/chains";
import type { MarketCollection } from "@/lib/types";

type UnknownRecord = Record<string, unknown>;

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
  if (typeof value === "string" && value.trim()) {
    return value.trim();
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
    if (value) return value;
  }

  return null;
}

function firstNumber(source: unknown, paths: Array<Array<string | number>>) {
  for (const path of paths) {
    const value = readNumber(readPath(source, path));
    if (value !== null) return value;
  }

  return null;
}

function readCollectionRows(payload: unknown) {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];

  for (const key of ["collections", "results", "items", "data"]) {
    const rows = payload[key];
    if (Array.isArray(rows)) return rows;
  }

  return [];
}

function normalizeChain(value: string | null) {
  const normalized = value?.toLowerCase().replace(/\s+/g, "_") ?? "unknown";

  if (normalized === "apechain") return "ape_chain";
  if (normalized === "eth" || normalized === "mainnet") return "ethereum";
  return normalized;
}

function readNativeSymbol(row: unknown, chain: string) {
  const explicit = firstString(row, [
    ["payment_tokens", 0, "symbol"],
    ["payment_token", "symbol"],
    ["currency", "symbol"],
    ["native_currency", "symbol"],
    ["primary_currency", "symbol"],
    ["nativeSymbol"],
  ]);

  if (explicit) return explicit.toUpperCase();
  if (isSupportedChain(chain)) return getChainConfig(chain).nativeSymbol;
  return chain === "solana" ? "SOL" : "ETH";
}

function normalizeCollection(row: unknown, rank: number): MarketCollection | null {
  const slug = firstString(row, [
    ["collection", "slug"],
    ["collection", "collection"],
    ["collection"],
    ["slug"],
    ["collection_slug"],
  ]);

  if (!slug) return null;

  const name =
    firstString(row, [
      ["collection", "name"],
      ["collection", "display_name"],
      ["name"],
      ["display_name"],
    ]) ?? slug;
  const chain = normalizeChain(
    firstString(row, [
      ["collection", "contracts", 0, "chain"],
      ["collection", "primary_asset_contracts", 0, "chain_identifier"],
      ["contracts", 0, "chain"],
      ["chain"],
      ["chain_identifier"],
    ]),
  );

  return {
    analyzable: isSupportedChain(chain),
    chain,
    floor: firstNumber(row, [
      ["stats", "floor_price"],
      ["statistics", "floor_price"],
      ["stats", "floor"],
      ["floor_price"],
      ["floorPrice"],
      ["floor"],
    ]),
    floorSymbol: firstString(row, [["stats", "floor_price_symbol"], ["statistics", "floor_price_symbol"], ["floor_price_symbol"]]),
    floorChange24h: firstNumber(row, [
      ["stats", "one_day_floor_price_change"],
      ["statistics", "one_day_floor_price_change"],
      ["stats", "floor_price_change"],
      ["one_day_floor_price_change"],
      ["floor_price_change_24h"],
      ["floor_price_change"],
    ]),
    imageUrl: firstString(row, [
      ["collection", "image_url"],
      ["collection", "imageUrl"],
      ["image_url"],
      ["imageUrl"],
    ]),
    name,
    nativeSymbol: readNativeSymbol(row, chain),
    owners: firstNumber(row, [
      ["stats", "num_owners"],
      ["statistics", "num_owners"],
      ["stats", "owners"],
      ["num_owners"],
      ["owners"],
    ]),
    rank,
    sales24h: firstNumber(row, [
      ["stats", "one_day_sales"],
      ["statistics", "one_day_sales"],
      ["stats", "sales"],
      ["one_day_sales"],
      ["sales_24h"],
      ["sales"],
    ]),
    supply: firstNumber(row, [["collection", "total_supply"], ["collection", "supply"], ["stats", "total_supply"], ["total_supply"], ["supply"]]),
    slug,
    totalVolume: firstNumber(row, [
      ["stats", "total_volume"],
      ["statistics", "total_volume"],
      ["stats", "volume"],
      ["total_volume"],
    ]),
    verified: Boolean(
      readPath(row, ["collection", "safelist_status"]) === "verified" ||
        readPath(row, ["safelist_status"]) === "verified" ||
        readPath(row, ["collection", "verified"]) === true ||
        readPath(row, ["verified"]) === true,
    ),
    volume24h: firstNumber(row, [
      ["stats", "one_day_volume"],
      ["statistics", "one_day_volume"],
      ["stats", "volume_24h"],
      ["one_day_volume"],
      ["volume_24h"],
      ["volume"],
    ]),
    volumeSymbol: firstString(row, [["stats", "one_day_volume_symbol"], ["statistics", "one_day_volume_symbol"], ["volume_symbol"]]),
  };
}

export function normalizeCollectionSearch(payload: unknown, limit = 8) {
  return readCollectionRows(payload)
    .filter((row) => !isRecord(row) || row.type === undefined || row.type === "collection")
    .map((row, index) => normalizeCollection(row, index + 1))
    .filter((row): row is MarketCollection => Boolean(row))
    .slice(0, limit);
}

export function normalizeCollectionLeaderboard(payload: unknown, limit = 20) {
  return readCollectionRows(payload)
    .map((row, index) => normalizeCollection(row, index + 1))
    .filter((row): row is MarketCollection => Boolean(row))
    .slice(0, limit);
}

import { NextRequest, NextResponse } from "next/server";
import {
  isSupportedChain,
  SUPPORTED_CHAINS,
} from "@/lib/chains";
import { parseCollectionInput } from "@/lib/collection-input";
import { fetchCollection, fetchContract, searchCollections, OpenSeaApiError } from "@/lib/opensea";
import { normalizeCollectionSearch } from "@/lib/discovery";
import type { CollectionResolution } from "@/lib/types";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readPath(value: unknown, path: Array<string | number>) {
  return path.reduce<unknown>((current, key) => {
    if (typeof key === "number") {
      return Array.isArray(current) ? current[key] : undefined;
    }

    return isRecord(current) ? current[key] : undefined;
  }, value);
}

function firstString(value: unknown, paths: Array<Array<string | number>>) {
  for (const path of paths) {
    const candidate = readPath(value, path);

    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }

  return null;
}

function normalizeAddress(value: string | null) {
  return value && /^0x[a-fA-F0-9]{40}$/.test(value) ? value.toLowerCase() : null;
}

function readCollectionSlug(payload: unknown) {
  const directCollection = readPath(payload, ["collection"]);

  if (typeof directCollection === "string") {
    return directCollection;
  }

  return firstString(payload, [
    ["collection", "slug"],
    ["collection", "collection"],
    ["collection_slug"],
    ["slug"],
  ]);
}

function readCollectionChain(payload: unknown): string | null {
  const candidates = [
    firstString(payload, [["chain"], ["blockchain"]]),
    firstString(payload, [["contracts", 0, "chain"], ["primary_asset_contracts", 0, "chain"]]),
  ];

  return candidates.find((value): value is string => Boolean(value)) ?? null;
}

function readContractAddress(payload: unknown) {
  return normalizeAddress(
    firstString(payload, [
      ["address"],
      ["contract", "address"],
      ["contracts", 0, "address"],
      ["primary_asset_contracts", 0, "address"],
    ]),
  );
}

function readCollectionName(payload: unknown) {
  return firstString(payload, [["name"], ["collection", "name"], ["collection", "display_name"]]);
}

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { error },
    {
      headers: { "Cache-Control": "no-store" },
      status,
    },
  );
}

async function resolveSlug(slug: string): Promise<CollectionResolution> {
  const payload = await fetchCollection(slug);
  const actualChain = readCollectionChain(payload) ?? "ethereum";

  return {
    chain: isSupportedChain(actualChain) ? actualChain : "ethereum",
    actualChain,
    collectionName: readCollectionName(payload),
    contractAddress: readContractAddress(payload),
    detectedFrom: "slug",
    slug,
  };
}

async function resolveContract(
  address: string,
  chainHint: string | null,
): Promise<CollectionResolution> {
  const chains = chainHint
    ? [chainHint, ...SUPPORTED_CHAINS.filter((chain) => chain !== chainHint)]
    : SUPPORTED_CHAINS;
  const results = await Promise.allSettled(
    chains.map(async (chain) => ({
      chain,
      payload: await fetchContract(chain, address),
    })),
  );

  for (const result of results) {
    if (result.status !== "fulfilled") {
      continue;
    }

    const slug = readCollectionSlug(result.value.payload);

    if (!slug) {
      continue;
    }

    return {
      chain: isSupportedChain(result.value.chain) ? result.value.chain : "ethereum",
      actualChain: result.value.chain,
      collectionName: readCollectionName(result.value.payload),
      contractAddress: readContractAddress(result.value.payload) ?? address,
      detectedFrom: "contract",
      slug,
    };
  }

  // For a bare contract, search OpenSea's wider chain index and verify the
  // exact contract in collection metadata before trusting a search match.
  if (!chainHint) {
    const matches = normalizeCollectionSearch(await searchCollections(address, 8), 8);
    const details = await Promise.allSettled(matches.map((item) => fetchCollection(item.slug)));
    for (let index = 0; index < details.length; index++) {
      const result = details[index];
      if (result.status !== "fulfilled") continue;
      const contracts = readPath(result.value, ["contracts"]);
      if (!Array.isArray(contracts) || !contracts.some((contract) => firstString(contract, [["address"]])?.toLowerCase() === address)) continue;
      const actualChain = readCollectionChain(result.value) ?? "ethereum";
      return { chain: isSupportedChain(actualChain) ? actualChain : "ethereum", actualChain, collectionName: readCollectionName(result.value), contractAddress: address, detectedFrom: "contract", slug: matches[index].slug };
    }
  }

  throw new OpenSeaApiError(
    "No matching OpenSea collection was found for this contract in the searched chains.",
    404,
  );
}

export async function GET(request: NextRequest) {
  const parsed = parseCollectionInput(request.nextUrl.searchParams.get("input") ?? "");

  if (!parsed) {
    return jsonError("Enter a collection slug, OpenSea URL, or EVM contract address.", 400);
  }

  try {
    const resolution =
      parsed.kind === "contract"
        ? await resolveContract(parsed.address, parsed.chainHint)
        : await resolveSlug(parsed.slug);

    return NextResponse.json(resolution, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
      },
    });
  } catch (cause) {
    if (cause instanceof OpenSeaApiError) {
      return jsonError(cause.message, cause.status);
    }

    return jsonError("Unable to detect this collection network.", 500);
  }
}

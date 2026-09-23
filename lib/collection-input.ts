import { extractSlug } from "@/lib/slug";

export type ParsedCollectionInput =
  | {
      address: string;
      chainHint: string | null;
      kind: "contract";
    }
  | {
      kind: "slug";
      slug: string;
    };

export function isEvmAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function parseOpenSeaPath(input: string): ParsedCollectionInput | null {
  let url: URL;

  try {
    url = new URL(input);
  } catch {
    return null;
  }

  if (!/(^|\.)opensea\.io$/i.test(url.hostname)) {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const collectionIndex = parts.findIndex((part) => part.toLowerCase() === "collection");

  if (collectionIndex >= 0 && parts[collectionIndex + 1]) {
    return {
      kind: "slug",
      slug: decodeURIComponent(parts[collectionIndex + 1]),
    };
  }

  const assetIndex = parts.findIndex((part) => ["asset", "assets", "item"].includes(part.toLowerCase()));

  if (assetIndex >= 0) {
    const chainValue = parts[assetIndex + 1] ?? "";
    const address = parts[assetIndex + 2] ?? "";

    if (isEvmAddress(address)) {
      return {
        address: address.toLowerCase(),
        chainHint: /^[a-z][a-z_0-9]{1,31}$/.test(chainValue) ? chainValue : null,
        kind: "contract",
      };
    }
  }

  return null;
}

export function parseCollectionInput(input: string): ParsedCollectionInput | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  const fromUrl = parseOpenSeaPath(trimmed);

  if (fromUrl) {
    return fromUrl;
  }

  if (isEvmAddress(trimmed)) {
    return {
      address: trimmed.toLowerCase(),
      chainHint: null,
      kind: "contract",
    };
  }

  const slug = extractSlug(trimmed);
  return slug ? { kind: "slug", slug } : null;
}

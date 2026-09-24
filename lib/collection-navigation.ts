/** Collection rows stay inside Mancing NFT; the separate OpenSea icon is external. */
export function getTerminalHref(slug: string, chain?: string | null) {
  const path = `/terminal/${encodeURIComponent(slug)}`;
  return chain && chain !== "ethereum"
    ? `${path}?chain=${encodeURIComponent(chain)}`
    : path;
}

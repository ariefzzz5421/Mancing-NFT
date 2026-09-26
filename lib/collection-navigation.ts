/** Collection rows stay inside Mancing NFT; the separate OpenSea icon is external. */
export function getTerminalHref(slug: string, chain?: string | null) {
  const path = `/terminal/${encodeURIComponent(slug)}`;
  return chain && chain !== "ethereum"
    ? `${path}?chain=${encodeURIComponent(chain)}`
    : path;
}

const recentTerminalKey = "mancing-recent-terminal";

export function rememberTerminal(slug: string, chain: string) {
  if (typeof window === "undefined" || !/^[a-z0-9][a-z0-9_.-]{0,159}$/i.test(slug)) return;
  window.localStorage.setItem(recentTerminalKey, getTerminalHref(slug, chain));
}

export function recentTerminal() {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(recentTerminalKey);
  if (!value || !/^\/terminal\/[a-z0-9_.%-]+(?:\?chain=[a-z0-9_-]+)?$/i.test(value)) return null;
  return value;
}

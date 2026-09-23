import { createWalletClient, custom, getAddress, type Address, type EIP1193Provider } from "viem";

export async function restoreWatchlistSession(address: Address) {
  const response = await fetch("/api/auth/session", { cache: "no-store" });
  if (!response.ok) return false;
  const data = await response.json() as { address: string | null };
  return data.address?.toLowerCase() === address.toLowerCase();
}

export async function signInWatchlist(address: Address, provider: EIP1193Provider) {
  const challengeResponse = await fetch(`/api/auth/challenge?address=${encodeURIComponent(address)}`, { cache: "no-store" });
  const challenge = await challengeResponse.json();
  if (!challengeResponse.ok) throw Error(challenge.error ?? "Wallet sign-in unavailable.");
  const wallet = createWalletClient({ transport: custom(provider) });
  const signature = await wallet.signMessage({ account: getAddress(address), message: challenge.message });
  const response = await fetch("/api/auth/session", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: challenge.address, nonce: challenge.nonce, issuedAt: challenge.issuedAt, proof: challenge.proof, signature }),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error ?? "Wallet sign-in failed.");
  return `wallet:${address.toLowerCase()}`;
}

export async function signOutWatchlist() {
  await fetch("/api/auth/session", { method: "DELETE" });
}

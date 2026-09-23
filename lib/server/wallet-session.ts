import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getAddress, isAddress, verifyMessage } from "viem";

const COOKIE = "mancing_wallet_session";
const CHALLENGE_LIFETIME_MS = 5 * 60_000;
const SESSION_LIFETIME_SECONDS = 7 * 24 * 60 * 60;

function secret() {
  const value = process.env.WATCHLIST_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("Wallet session secret is not configured.");
  return value;
}

export function walletAuthConfigured() {
  return Boolean(process.env.WATCHLIST_SESSION_SECRET && process.env.WATCHLIST_SESSION_SECRET.length >= 32);
}

function mac(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function equal(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function message(origin: string, address: string, nonce: string, issuedAt: string) {
  const domain = new URL(origin).host;
  return `${domain} wants you to sign in with your Ethereum account:\n${getAddress(address)}\n\nSign in to Mancing NFT to sync your watchlists. This does not submit a transaction.\n\nURI: ${origin}\nVersion: 1\nChain ID: 1\nNonce: ${nonce}\nIssued At: ${issuedAt}`;
}

export function newChallenge(request: Request, address: string) {
  if (!isAddress(address)) throw new Error("Invalid wallet address.");
  const origin = new URL(request.url).origin;
  const nonce = randomBytes(16).toString("hex");
  const issuedAt = new Date().toISOString();
  const account = getAddress(address);
  return {
    address: account,
    nonce,
    issuedAt,
    proof: mac(`${origin}|${account}|${nonce}|${issuedAt}`),
    message: message(origin, account, nonce, issuedAt),
  };
}

export async function verifyChallenge(request: Request, input: unknown) {
  if (!input || typeof input !== "object") return null;
  const data = input as Record<string, unknown>;
  const { address, nonce, issuedAt, proof, signature } = data;
  if (typeof address !== "string" || !isAddress(address) ||
      typeof nonce !== "string" || !/^[a-f0-9]{32}$/.test(nonce) ||
      typeof issuedAt !== "string" || typeof proof !== "string" ||
      typeof signature !== "string" || !/^0x[a-f0-9]{130}$/i.test(signature)) return null;
  const timestamp = Date.parse(issuedAt);
  if (!Number.isFinite(timestamp) || timestamp > Date.now() + 30_000 || Date.now() - timestamp > CHALLENGE_LIFETIME_MS) return null;
  const origin = new URL(request.url).origin;
  const account = getAddress(address);
  if (!equal(proof, mac(`${origin}|${account}|${nonce}|${issuedAt}`))) return null;
  const valid = await verifyMessage({ address: account, message: message(origin, account, nonce, issuedAt), signature: signature as `0x${string}` });
  return valid ? account.toLowerCase() : null;
}

export function sessionCookie(address: string, request: Request) {
  const payload = Buffer.from(JSON.stringify({ address, exp: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS })).toString("base64url");
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${payload}.${mac(payload)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_LIFETIME_SECONDS}${secure}`;
}

export function clearSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export function sessionAddress(request: Request) {
  if (!walletAuthConfigured()) return null;
  const raw = request.headers.get("cookie")?.split("; ").find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!raw || raw.length > 1024) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature || !equal(signature, mac(payload))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { address?: string; exp?: number };
    return parsed.address && isAddress(parsed.address) && typeof parsed.exp === "number" && parsed.exp > Date.now() / 1000
      ? getAddress(parsed.address).toLowerCase() : null;
  } catch { return null; }
}

export function sameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}

import "server-only";
import type { Health } from "@/types/market";
const base = "https://api.opensea.io/api/v2";
let health: Health = {
  state: "Not checked",
  lastSuccess: null,
  lastStatus: null,
  updatedAt: null,
};
const pending = new Map<string, Promise<unknown>>();
const cache = new Map<string, { expires: number; value: unknown }>();
let cooldown = 0;
let cooldownStatus = 503;
let cooldownMessage = "Market service temporarily unavailable";
export class MarketError extends Error {
  constructor(
    message: string,
    public status = 503,
  ) {
    super(message);
  }
}
export function getHealth() {
  return { ...health };
}
export async function request<T = unknown>(
  path: string,
  ttl = 30,
  body?: unknown,
): Promise<T> {
  if (Date.now() < cooldown)
    throw new MarketError(cooldownMessage, cooldownStatus);
  const key = body ? null : path;
  const cached = key && ttl > 0 ? cache.get(key) : null;
  if (cached && cached.expires > Date.now()) return cached.value as T;
  if (key && pending.has(key)) return pending.get(key) as Promise<T>;
  const run = async () => {
    if (!process.env.OPENSEA_API_KEY) {
      health = {
        ...health,
        state: "Authentication Failed",
        lastStatus: null,
        updatedAt: new Date().toISOString(),
      };
      throw new MarketError("OpenSea server credential is missing.", 401);
    }
    let response: Response;
    try {
      response = await fetch(base + path, {
        method: body ? "POST" : "GET",
        headers: {
          "X-API-KEY": process.env.OPENSEA_API_KEY,
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(12000),
      });
    } catch {
      health = {
        ...health,
        state: "Offline",
        lastStatus: null,
        updatedAt: new Date().toISOString(),
      };
      throw new MarketError(
        "OpenSea request timed out or network unavailable.",
        504,
      );
    }
    const time = new Date().toISOString();
    if (!response.ok) {
      const state =
        response.status === 401 || response.status === 403
          ? "Authentication Failed"
          : response.status === 429
            ? "Rate Limited"
            : "Offline";
      health = {
        ...health,
        state,
        lastStatus: response.status,
        updatedAt: time,
      };
      if (state === "Authentication Failed" || state === "Rate Limited") {
        cooldown = Date.now() + 30000;
        cooldownStatus = response.status;
        cooldownMessage = state;
      }
      throw new MarketError(
        state === "Authentication Failed"
          ? "OpenSea authentication failed. Refresh the server API credential."
          : `OpenSea ${state.toLowerCase()} (HTTP ${response.status}).`,
        response.status,
      );
    }
    if (
      /^\/(offers|listings)\/collection\//.test(path) &&
      Date.now() >= cooldown
    )
      health = {
        state: "Operational",
        lastSuccess: time,
        lastStatus: response.status,
        updatedAt: time,
      };
    const value = (await response.json()) as T;
    if (key && ttl > 0) {
      if (cache.size >= 500) cache.delete(cache.keys().next().value!);
      cache.set(key, { value, expires: Date.now() + ttl * 1000 });
    }
    return value;
  };
  const promise = run();
  if (key) pending.set(key, promise);
  try {
    return await promise;
  } finally {
    if (key) pending.delete(key);
  }
}
export function apiError(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof MarketError
          ? error.message
          : "Market data temporarily unavailable",
      health: getHealth(),
    },
    {
      status: error instanceof MarketError ? error.status : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

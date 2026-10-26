/** Keep server configuration details out of collection-facing error messages. */
export function readableMarketError(cause: unknown, fallback = "Market data is unavailable.") {
  const message = cause instanceof Error ? cause.message : fallback;
  if (!message) return fallback;
  if (/OPENSEA_API_KEY|server credential|authentication failed|API key is missing/i.test(message)) {
    return "Market data is unavailable. Check the data connection.";
  }
  return message;
}

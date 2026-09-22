# Mancing NFT — NFT Quant Trading Terminal

## Run and verify

Use Node 20.9+ (Node 24 tested), `npm ci`, and `npm run dev`. Required server environment: `OPENSEA_API_KEY`. Optional: `ETHEREUM_RPC_URL` (otherwise public Ethereum RPC), and `ETHERSCAN_API_KEY` for existing wallet research. Never prefix secrets with `NEXT_PUBLIC_`.

Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Routes and data

`/` and `/terminal/[slug]` provide the terminal. `/scanner`, `/orders`, `/positions`, `/watchlist`, `/wallet`, and `/settings` provide dedicated workspaces. Existing `/collection/[slug]` and `/wallets` retain holder, activity and tracked-wallet research.

Browser → internal API → OpenSea. The server uses the current collection listing/offer endpoints. The normalizer accepts fixed-price Ethereum ERC-721 asks and WETH collection offers; token/trait bids are excluded from the comparable collection book. Normalized prices are integer wei serialized as strings. Signing never uses floating-point prices. Unsupported orders are counted and excluded.

Order pages are bounded to three 200-order pages per side. Partial coverage is labeled. Advertised depth does not prove maker funding: overlapping offers may share funds, and competing transactions can invalidate listings. Incomplete depth never establishes a full collection sweep or definitive best price. Fee and slippage inputs in analytics are editable assumptions.

Server instance caches enforce strict TTL: metadata 900 seconds, stats 45 seconds, books 20 seconds. No stale-while-revalidate market fallback. Concurrent identical reads share a pending request; cache capacity is bounded. Frontground polling runs every 60 seconds and pauses in hidden tabs. Authentication and rate-limit errors trigger a 30-second instance cooldown. Serverless instances do not share this memory cache or health history; shared Redis would be needed for cross-instance global quotas.

Health probes an authenticated offers endpoint, not credential presence or public metadata. HTTP 401/403, 429 and upstream/network failures have distinct states. No credential values are returned.

## Trading

Browser injected wallets connect through viem. Offers require Ethereum mainnet and sufficient WETH. Seaport SDK is dynamically imported for exact approval checks and order signing. Collection offers use `/offers/build` and `/offers`; listings use `/orders/ethereum/seaport/listings`. Metadata fees are shown in the order review. Optional creator royalties default on. Review expires after 60 seconds. Order signatures are verified against the maker on the server (EOA signatures only).

Buying a selected ask requests fresh fulfillment data, allows only single-item ETH listings at Seaport 1.6, displays full payment, simulates the transaction, estimates gas and requests wallet confirmation. Quotes expire after 45 seconds. Cancellation is an on-chain wallet transaction for Seaport 1.6 orders. The agent does not execute trades during verification.

Account lists paginate at 50 records. Order history covers up to 200 orders created in the same browser and rechecks OpenSea status. It does not claim to import complete wallet history. Owned NFTs can request acquisition cost from the latest ownership event; transfers or unavailable history leave basis unknown with an explicitly manual input. Floor marks and advertised bid-based estimates remain separate, before exit fees; bid funding and token eligibility require execution-time validation.

## Credential incident / remaining live verification

On 2026-09-22 and 2026-09-23, the existing local OpenSea credential returned HTTP 401 `API key has expired` for fresh listing and offer reads. Metadata could return cached HTTP 200. The official instant key endpoint returned HTTP 429, so no replacement credential was created or installed. Replace the key in `.env.local` and the linked Vercel Production environment, then redeploy and rerun API/wallet acceptance checks. Never paste the key into source or commit it.

Live offer/listing submission, ownership retrieval, purchase, and cancellation require an operational key plus user wallet confirmation and remain unverified end to end. Explicit unit fixtures are used only in tests, never in production routes.

## Verification record

Lint, TypeScript, ten quantitative/normalization tests, production build and dependency audit pass. Browser checks covered 360, 390, 768, 1024, 1280 and 1440px without page overflow; all new routes, browser watchlist persistence, missing-wallet and search authentication errors passed. An isolated browser fixture validated bid/ask prefills, 11.54% spread, sweep capital, injected-wallet connection and balance display. No real wallet signature or transaction was requested.

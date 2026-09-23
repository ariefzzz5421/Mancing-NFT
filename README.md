# Mancing NFT

NFT Quant Trading Terminal for collection liquidity research and non-custodial Ethereum trading.

## Workspaces

- Overview: real OpenSea trending collections and 24h volume ranking, with collection search and direct terminal access. Trending floor and volume are shown only when OpenSea statistics are available.
- Terminal: collection search, aggregated asks and collection-wide bids, spread, liquidity bands, net-edge estimates and sweep targets.
- Scanner: compare up to eight collections with explicit depth coverage and cost assumptions.
- Wallet, Orders and Positions: injected or Privy wallet balances, paginated holdings, order creation/cancellation and floor-versus-bid estimates.
- Watchlist and Settings: a built-in Default list, named groups selected from the star dialog, wallet-scoped Supabase sync, real API health and reported OpenSea request quota, diagnostics and trading preferences.
- Existing collection holder/activity research and tracked-wallet tools remain accessible.

## Run

Use Node 20.9+ (Node 24 tested).

```sh
git clone https://github.com/ariefzzz5421/Mancing-NFT.git
cd Mancing-NFT
npm ci
```

Copy `.env.example` to `.env.local`, set `OPENSEA_API_KEY`, then run `npm run dev`.
Optional `ETHEREUM_RPC_URL` supplies a server-only RPC; otherwise public Ethereum RPC is used. `ETHERSCAN_API_KEY` supports the existing wallet research tools. No server credential belongs in a `NEXT_PUBLIC_` variable.

For wallet-backed watchlists, run `supabase/migrations/20260923_watchlist_items.sql` and `supabase/migrations/20260923_watchlist_groups.sql` in the intended Supabase project. Set `SUPABASE_SERVICE_ROLE_KEY` and a random 32-byte or longer `WATCHLIST_SESSION_SECRET` on the server. A wallet signs a short-lived, site-bound sign-in message; an HttpOnly session cookie then scopes items and groups to that wallet. The service-role key and session secret must never be public. `NEXT_PUBLIC_PRIVY_APP_ID` remains optional for Privy-powered wallet connection; configure the deployed site as an allowed origin in Privy before enabling it. Settings shows the actual configuration state.

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

## Execution and data boundaries

Orders are prepared through server-only OpenSea APIs and signed by the connected wallet using Seaport. The application never requests or stores private keys. Ethereum ERC-721 trading and EOA order signatures are supported; other formats are explicitly excluded. Quotes, funding, gas and order validity are rechecked before requesting wallet execution.

Depth is advertised liquidity, not guaranteed executable capital. Partial pagination, shared maker funds, fees and resale uncertainty are visible. Gross spread is never described as profit. Production routes never supply mock market data.

The previous production OpenSea credential returned 401. A temporary replacement key restored authenticated order-book access on 23 September 2026; it expires around 29 September 2026 and must be replaced with a permanent server-side OpenSea key. See [architecture, scope and verification notes](docs/MANCING-NFT.md).

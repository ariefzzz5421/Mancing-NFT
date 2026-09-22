# Mancing NFT

NFT Quant Trading Terminal for collection liquidity research and non-custodial Ethereum trading.

## Workspaces

- Terminal: collection search, aggregated asks and collection-wide bids, spread, liquidity bands, net-edge estimates and sweep targets.
- Scanner: compare up to eight collections with explicit depth coverage and cost assumptions.
- Wallet, Orders and Positions: injected-wallet balances, paginated holdings, order creation/cancellation and floor-versus-bid estimates.
- Watchlist and Settings: preserved browser watchlists, real API health, diagnostics and trading preferences.
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

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

## Execution and data boundaries

Orders are prepared through server-only OpenSea APIs and signed by the connected wallet using Seaport. The application never requests or stores private keys. Ethereum ERC-721 trading and EOA order signatures are supported; other formats are explicitly excluded. Quotes, funding, gas and order validity are rechecked before requesting wallet execution.

Depth is advertised liquidity, not guaranteed executable capital. Partial pagination, shared maker funds, fees and resale uncertainty are visible. Gross spread is never described as profit. Production routes never supply mock market data.

The existing OpenSea credential was found expired during verification. A replacement server credential is required for complete live API and trading acceptance. See [architecture, scope and verification notes](docs/MANCING-NFT.md).

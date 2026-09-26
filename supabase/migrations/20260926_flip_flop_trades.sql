-- Wallet-scoped execution ledger. Only the server service role may access it.
create table if not exists public.trade_orders (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null check (owner_id ~ '^wallet:0x[0-9a-f]{40}$'),
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-f]{40}$'),
  order_hash text not null unique check (order_hash ~ '^0x[0-9a-fA-F]{64}$'),
  collection_slug text not null check (length(collection_slug) between 1 and 160),
  contract_address text not null check (contract_address ~ '^0x[0-9a-f]{40}$'),
  token_id text,
  side text not null check (side in ('OFFER', 'LIST', 'BUY')),
  price_wei text not null check (price_wei ~ '^[0-9]+$'),
  quantity integer not null check (quantity between 1 and 100),
  status text not null default 'ACTIVE' check (status in ('PREPARED', 'ACTIVE', 'FILLED', 'FULFILLED', 'CANCELLED', 'EXPIRED', 'FAILED')),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  filled_at timestamptz,
  tx_hash text,
  updated_at timestamptz not null default now()
);
create index if not exists trade_orders_owner_created_idx on public.trade_orders (owner_id, created_at desc);
create index if not exists trade_orders_owner_status_idx on public.trade_orders (owner_id, status, created_at desc);
create index if not exists trade_orders_wallet_collection_idx on public.trade_orders (wallet_address, collection_slug, created_at desc);
alter table public.trade_orders enable row level security;
revoke all on public.trade_orders from anon, authenticated;
grant select, insert, update, delete on public.trade_orders to service_role;

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null check (owner_id ~ '^wallet:0x[0-9a-f]{40}$'),
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-f]{40}$'),
  collection_slug text not null check (length(collection_slug) between 1 and 160),
  contract_address text not null check (contract_address ~ '^0x[0-9a-f]{40}$'),
  token_id text not null check (token_id ~ '^[0-9]+$'),
  entry_price_wei text not null check (entry_price_wei ~ '^[0-9]+$'),
  entry_order_hash text not null check (entry_order_hash ~ '^0x[0-9a-fA-F]{64}$'),
  entry_tx_hash text,
  current_floor_wei text,
  listing_price_wei text,
  exit_price_wei text,
  exit_tx_hash text,
  status text not null default 'INVENTORY' check (status in ('INVENTORY', 'LIST_PREPARED', 'LIST_ACTIVE', 'SOLD', 'CLOSED')),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (owner_id, contract_address, token_id, entry_order_hash)
);
create index if not exists positions_owner_status_idx on public.positions (owner_id, status, created_at desc);
create index if not exists positions_wallet_token_idx on public.positions (wallet_address, contract_address, token_id);
alter table public.positions enable row level security;
revoke all on public.positions from anon, authenticated;
grant select, insert, update, delete on public.positions to service_role;

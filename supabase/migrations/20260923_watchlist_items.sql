-- Private watchlist storage for authenticated Privy users. The application
-- verifies Privy access tokens server-side before using its server-only key.
create table if not exists public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null check (length(owner_id) between 8 and 255),
  chain text not null check (chain in ('ethereum', 'ape_chain')),
  slug text not null check (length(slug) between 1 and 160),
  name text,
  image_url text,
  contract_address text,
  notes text,
  target_floors jsonb not null default '[]'::jsonb,
  dev_wallets jsonb not null default '[]'::jsonb,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, chain, slug)
);

create index if not exists watchlist_items_owner_added_idx
  on public.watchlist_items (owner_id, added_at desc);

alter table public.watchlist_items enable row level security;
revoke all on public.watchlist_items from anon, authenticated;
grant select, insert, update, delete on public.watchlist_items to service_role;

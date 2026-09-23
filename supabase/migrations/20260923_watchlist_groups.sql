create table if not exists public.watchlist_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null check (length(owner_id) between 8 and 255),
  name text not null check (length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);

create unique index if not exists watchlist_groups_owner_name_idx
  on public.watchlist_groups (owner_id, lower(name));
create index if not exists watchlist_groups_owner_created_idx
  on public.watchlist_groups (owner_id, created_at);

alter table public.watchlist_groups enable row level security;
revoke all on public.watchlist_groups from anon, authenticated;
grant select, insert, update, delete on public.watchlist_groups to service_role;

alter table public.watchlist_items add column if not exists group_id uuid
  references public.watchlist_groups(id) on delete set null;
create index if not exists watchlist_items_owner_group_idx
  on public.watchlist_items (owner_id, group_id);

## Supabase Backend Overview

### Tables

1. `user_chart_settings`

- Purpose: Persist per-user chart layout/settings (optionally per-symbol)
- Key fields:
  - `user_id uuid` (FK to `auth.users`)
  - `symbol text not null default ''` ('' = global settings)
  - `timeframe text`, `chart_type text`
  - `show_volume boolean`, `show_ma boolean`, `show_sessions boolean`
  - `indicators jsonb` (array of indicator configs)
  - Unique: `(user_id, symbol)`
- RLS: users can select/insert/update/delete only their rows

2. `user_watchlist`

- Purpose: Single normalized watchlist with favorite flag per row
- Key fields:
  - `user_id uuid` (FK to `auth.users`)
  - `symbol text` (uppercase ticker)
  - `is_favorite boolean` (true = Focus)
  - `added_at timestamptz`
  - Unique: `(user_id, symbol)`
- RLS: users can select/insert/update/delete only their rows

### Flows

- Login hydration:

  - `user_chart_settings`: fetch per-symbol row (current symbol) or global fallback (''). Apply to UI.
  - `user_watchlist`: fetch all rows to hydrate the single watchlist; `is_favorite=true` becomes the Focus set.

- Persistence:
  - Chart changes debounce-save to `user_chart_settings` with upsert on `(user_id,symbol)`.
  - Watchlist changes call `syncUserWatchlist` which upserts current rows and deletes removed symbols.

### SQL

Run in Supabase SQL editor:

```sql
-- user_chart_settings
create extension if not exists pgcrypto;

create table if not exists public.user_chart_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null default '',
  timeframe text,
  chart_type text,
  show_volume boolean,
  show_ma boolean,
  show_sessions boolean,
  indicators jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, symbol)
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists set_user_chart_settings_updated_at on public.user_chart_settings;
create trigger set_user_chart_settings_updated_at
before update on public.user_chart_settings
for each row execute function public.set_updated_at();

alter table public.user_chart_settings enable row level security;

drop policy if exists "Allow read own settings" on public.user_chart_settings;
create policy "Allow read own settings"
on public.user_chart_settings
for select
using (auth.uid() = user_id);

drop policy if exists "Allow upsert own settings" on public.user_chart_settings;
create policy "Allow upsert own settings"
on public.user_chart_settings
for insert
with check (auth.uid() = user_id);

drop policy if exists "Allow update own settings" on public.user_chart_settings;
create policy "Allow update own settings"
on public.user_chart_settings
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Allow delete own settings" on public.user_chart_settings;
create policy "Allow delete own settings"
on public.user_chart_settings
for delete
using (auth.uid() = user_id);

-- user_watchlist
create table if not exists public.user_watchlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  is_favorite boolean not null default false,
  added_at timestamptz not null default now(),
  primary key (user_id, symbol)
);

alter table public.user_watchlist enable row level security;

drop policy if exists "Read own watchlist" on public.user_watchlist;
create policy "Read own watchlist"
on public.user_watchlist
for select
using (auth.uid() = user_id);

drop policy if exists "Upsert own watchlist" on public.user_watchlist;
create policy "Upsert own watchlist"
on public.user_watchlist
for insert
with check (auth.uid() = user_id);

drop policy if exists "Update own watchlist" on public.user_watchlist;
create policy "Update own watchlist"
on public.user_watchlist
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Delete own watchlist" on public.user_watchlist;
create policy "Delete own watchlist"
on public.user_watchlist
for delete
using (auth.uid() = user_id);
```

### Clients

- `src/services/chartSettingsService.ts`

  - `getUserChartSettings(userId, symbol?)`
  - `upsertUserChartSettings(row)`

- `src/services/watchlistService.ts`
  - `fetchUserWatchlist(userId)`
  - `syncUserWatchlist(userId, items)` where `items` = `{ symbol, isFavorite }[]`

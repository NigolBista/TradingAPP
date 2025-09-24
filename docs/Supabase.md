## Supabase Backend Overview

This file is the single source of truth for our backend schema so the LLM can reason about the app correctly.

### Types (enums)

- `alert_condition`: "above" | "below" | "crosses_above" | "crosses_below"
- `alert_repeat`: "unlimited" | "once_per_min" | "once_per_day"
- `queue_status`: "queued" | "processing" | "retrying" | "failed" | "succeeded"
- `trade_signal_kind`: "setup" | "entry" | "tp" | "exit"
- `trade_action`: "buy" | "sell"

### Tables

1. `alerts`

- Purpose: User price alerts evaluated by a scheduled function.
- Key fields: `user_id`, `symbol`, `price`, `condition alert_condition`, `repeat alert_repeat`, `is_active`.
- State fields: `last_price`, `triggered_at`, `last_notified_at` maintained by evaluator.
- RLS: users can CRUD only their rows.

2. `alert_events`

- Purpose: Append-only stream of fired alerts for realtime UI and audit.
- Key fields: `user_id`, `alert_id`, `symbol`, `price`, `condition`, `fired_at`.
- RLS: users can read their events. Inserts are performed by service role.

3. `notifications_queue`

- Purpose: Outbox queue for push notifications; processed by the `notify` edge function.
- Key fields: `user_id`, `channel`, `payload jsonb`, `status queue_status`, `priority`, `attempts`, `scheduled_at`, `locked_at`, `error`.
- RLS: users may read their own rows; writes are performed by service role.

4. `trade_signals`

- Purpose: Generated trading signals streamed to clients via realtime.
- Key fields: `user_id`, `symbol`, `kind trade_signal_kind`, `action trade_action`, `timeframe`, risk fields (`confidence`, `entry_price`, `stop_loss`, `targets[]`), `rationale`, `unique_key`.
- RLS: users can read their rows. Inserts are performed by service role.

5. `user_devices`

- Purpose: Expo push tokens per user/device.
- Key fields: `user_id`, `expo_push_token`, `platform`, `app_version`, `last_seen`.
- Uniqueness: `(user_id, expo_push_token)`.
- RLS: users can upsert their own devices.

6. `user_symbol_strategies`

- Purpose: Per-user enabled strategies per symbol.
- Key fields: `user_id`, `symbol`, `strategy_id`.
- RLS: users can CRUD their rows.

7. `user_chart_settings`

- Purpose: Persist per-user chart layout/settings. Supports multiple named layouts with a default flag.
- Key fields: `id uuid`, `user_id`, `name text`, `is_default boolean`, UI flags and `indicators jsonb`.
- Unique: one `is_default=true` per `user_id` enforced by logic; clients query the default or by `id`.
- RLS: users can CRUD their rows.

8. `user_watchlist`

- Purpose: Single normalized watchlist with favorite flag per row.
- Key fields: `user_id`, `symbol`, `is_favorite`, `added_at`.
- Unique: `(user_id, symbol)`.
- RLS: users can CRUD their rows.

9. `user_trade_drafts`

- Purpose: Persist per-user draft trade plans keyed by symbol.
- Key fields: `user_id`, `symbol`, `entries numeric[]`, `exits numeric[]`, `tps numeric[]`, `updated_at`.
- Unique: `(user_id, symbol)` enforced via upsert conflict target.
- RLS: users can CRUD their own drafts.

10. `user_strategy_preferences`

- Purpose: Persist each user's strategy configuration and group selection.
- Key fields: `user_id uuid PK/FK`, `selected_strategy_group_id uuid`,
  `trade_mode trade_strategy_mode`, `trade_pace trade_strategy_pace`,
  `context_mode trade_context_mode`, `strategy_complexity strategy_complexity_level`,
  `auto_apply_complexity boolean`, `news_sentiment_enabled boolean`,
  `created_at timestamptz`, `updated_at timestamptz`.
- RLS: users can CRUD exactly one row tied to their user id.

### Types (new)

- `trade_strategy_mode`: `day` | `swing`
- `trade_strategy_pace`: `auto` | `day` | `scalp` | `swing`
- `trade_context_mode`: `price_action` | `news_sentiment`
- `strategy_complexity_level`: `simple` | `partial` | `advanced`

### Flows

- Login hydration:

  - Fetch `alerts` and start realtime via `alertsService.startRealtime` to receive `trade_signals`, `alert_events`, and `alerts` changes.
  - Sync `user_chart_settings` global row only (`symbol=''`) and apply to all tickers.
  - Sync `user_watchlist` for UI state.
  - Register device token into `user_devices` when notifications are enabled.

- Alert evaluation and delivery:

  - `evaluate-alerts` edge function:
    - Loads active `alerts`, fetches prices, checks `condition` vs `price` with `last_price` for cross logic.
    - Writes `alert_events` on triggers, updates `alerts.triggered_at` and `last_notified_at`.
    - Enqueues push into `notifications_queue` and then invokes `notify`.
  - `notify` edge function:
    - Pulls queued/retrying jobs, locks and sends push via Expo using tokens from `user_devices`.
    - Updates job `status` to `succeeded` or `retrying` with backoff; marks `failed` if no devices.

- `publish-signal` edge function:
  - Validates the sender belongs to the strategy group.
  - Inserts trade signal rows for each member (even the sender) with group metadata attached.
  - Enqueues push notifications for each recipient into `notifications_queue`.

### SQL

Run in Supabase SQL editor:

```sql
-- Core extension
create extension if not exists pgcrypto;

-- Enum types (idempotent)
do $$ begin
  create type public.alert_condition as enum ('above','below','crosses_above','crosses_below');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.alert_repeat as enum ('unlimited','once_per_min','once_per_day');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.queue_status as enum ('queued','processing','retrying','failed','succeeded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.trade_signal_kind as enum ('setup','entry','tp','exit');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.trade_action as enum ('buy','sell');
exception when duplicate_object then null; end $$;

-- updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- Strategy preference enums
do $$ begin
  create type public.trade_strategy_mode as enum ('day','swing');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.trade_strategy_pace as enum ('auto','day','scalp','swing');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.trade_context_mode as enum ('price_action','news_sentiment');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.strategy_complexity_level as enum ('simple','partial','advanced');
exception when duplicate_object then null; end $$;

-- alerts
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  price numeric not null,
  condition public.alert_condition not null,
  message text,
  is_active boolean not null default true,
  last_price numeric,
  triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  repeat public.alert_repeat not null default 'unlimited',
  last_notified_at timestamptz
);

drop trigger if exists set_alerts_updated_at on public.alerts;
create trigger set_alerts_updated_at
before update on public.alerts
for each row execute function public.set_updated_at();

alter table public.alerts enable row level security;
drop policy if exists "alerts_read_own" on public.alerts;
create policy "alerts_read_own" on public.alerts for select using (auth.uid() = user_id);
drop policy if exists "alerts_insert_own" on public.alerts;
create policy "alerts_insert_own" on public.alerts for insert with check (auth.uid() = user_id);
drop policy if exists "alerts_update_own" on public.alerts;
create policy "alerts_update_own" on public.alerts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "alerts_delete_own" on public.alerts;
create policy "alerts_delete_own" on public.alerts for delete using (auth.uid() = user_id);

-- alert_events (append-only)
create table if not exists public.alert_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_id uuid not null references public.alerts(id) on delete cascade,
  symbol text not null,
  price numeric not null,
  condition public.alert_condition not null,
  fired_at timestamptz not null default now()
);

alter table public.alert_events enable row level security;
drop policy if exists "alert_events_read_own" on public.alert_events;
create policy "alert_events_read_own" on public.alert_events for select using (auth.uid() = user_id);

-- notifications_queue
create table if not exists public.notifications_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null default 'push',
  payload jsonb not null,
  status public.queue_status not null default 'queued',
  priority integer not null default 0,
  attempts integer not null default 0,
  scheduled_at timestamptz not null default now(),
  locked_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

drop trigger if exists set_notifications_queue_updated_at on public.notifications_queue;
create trigger set_notifications_queue_updated_at
before update on public.notifications_queue
for each row execute function public.set_updated_at();

alter table public.notifications_queue enable row level security;
drop policy if exists "notifications_read_own" on public.notifications_queue;
create policy "notifications_read_own" on public.notifications_queue for select using (auth.uid() = user_id);
-- (No insert/update policies: jobs are written by service role)

-- trade_signals
create table if not exists public.trade_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  kind public.trade_signal_kind not null,
  action public.trade_action not null,
  timeframe text not null,
  confidence numeric,
  entry_price numeric,
  stop_loss numeric,
  targets numeric[],
  rationale text,
  metadata jsonb,
  unique_key text unique,
  created_at timestamptz not null default now()
);

alter table public.trade_signals enable row level security;
drop policy if exists "signals_read_own" on public.trade_signals;
create policy "signals_read_own" on public.trade_signals for select using (auth.uid() = user_id);
-- (No insert/update policies: signals are produced by service role)

-- user_devices
create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform text,
  app_version text,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

alter table public.user_devices enable row level security;
drop policy if exists "devices_read_own" on public.user_devices;
create policy "devices_read_own" on public.user_devices for select using (auth.uid() = user_id);
drop policy if exists "devices_insert_own" on public.user_devices;
create policy "devices_insert_own" on public.user_devices for insert with check (auth.uid() = user_id);
drop policy if exists "devices_update_own" on public.user_devices;
create policy "devices_update_own" on public.user_devices for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "devices_delete_own" on public.user_devices;
create policy "devices_delete_own" on public.user_devices for delete using (auth.uid() = user_id);

-- user_symbol_strategies
create table if not exists public.user_symbol_strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  strategy_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, symbol, strategy_id)
);

alter table public.user_symbol_strategies enable row level security;
drop policy if exists "uss_read_own" on public.user_symbol_strategies;
create policy "uss_read_own" on public.user_symbol_strategies for select using (auth.uid() = user_id);
drop policy if exists "uss_insert_own" on public.user_symbol_strategies;
create policy "uss_insert_own" on public.user_symbol_strategies for insert with check (auth.uid() = user_id);
drop policy if exists "uss_update_own" on public.user_symbol_strategies;
create policy "uss_update_own" on public.user_symbol_strategies for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "uss_delete_own" on public.user_symbol_strategies;
create policy "uss_delete_own" on public.user_symbol_strategies for delete using (auth.uid() = user_id);

-- user_chart_settings (named layouts)
create table if not exists public.user_chart_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Default',
  is_default boolean not null default false,
  timeframe text,
  chart_type text,
  show_volume boolean,
  show_ma boolean,
  show_sessions boolean,
  indicators jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_user_chart_settings_updated_at on public.user_chart_settings;
create trigger set_user_chart_settings_updated_at
before update on public.user_chart_settings
for each row execute function public.set_updated_at();

alter table public.user_chart_settings enable row level security;
drop policy if exists "ucs_read_own" on public.user_chart_settings;
create policy "ucs_read_own" on public.user_chart_settings for select using (auth.uid() = user_id);
drop policy if exists "ucs_insert_own" on public.user_chart_settings;
create policy "ucs_insert_own" on public.user_chart_settings for insert with check (auth.uid() = user_id);
drop policy if exists "ucs_update_own" on public.user_chart_settings;
create policy "ucs_update_own" on public.user_chart_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "ucs_delete_own" on public.user_chart_settings;
create policy "ucs_delete_own" on public.user_chart_settings for delete using (auth.uid() = user_id);

-- user_watchlist
create table if not exists public.user_watchlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  is_favorite boolean not null default false,
  added_at timestamptz not null default now(),
  primary key (user_id, symbol)
);

alter table public.user_watchlist enable row level security;
drop policy if exists "uwl_read_own" on public.user_watchlist;
create policy "uwl_read_own" on public.user_watchlist for select using (auth.uid() = user_id);
drop policy if exists "uwl_insert_own" on public.user_watchlist;
create policy "uwl_insert_own" on public.user_watchlist for insert with check (auth.uid() = user_id);
drop policy if exists "uwl_update_own" on public.user_watchlist;
create policy "uwl_update_own" on public.user_watchlist for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "uwl_delete_own" on public.user_watchlist;
create policy "uwl_delete_own" on public.user_watchlist for delete using (auth.uid() = user_id);

-- user_strategy_preferences (1 row per user)
create table if not exists public.user_strategy_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  selected_strategy_group_id uuid,
  trade_mode public.trade_strategy_mode default 'day',
  trade_pace public.trade_strategy_pace default 'auto',
  context_mode public.trade_context_mode default 'price_action',
  strategy_complexity public.strategy_complexity_level default 'simple',
  auto_apply_complexity boolean default false,
  news_sentiment_enabled boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_user_strategy_preferences_updated_at on public.user_strategy_preferences;
create trigger set_user_strategy_preferences_updated_at
before update on public.user_strategy_preferences
for each row execute function public.set_updated_at();

alter table public.user_strategy_preferences enable row level security;
drop policy if exists "usp_read_own" on public.user_strategy_preferences;
create policy "usp_read_own" on public.user_strategy_preferences for select using (auth.uid() = user_id);
drop policy if exists "usp_insert_own" on public.user_strategy_preferences;
create policy "usp_insert_own" on public.user_strategy_preferences for insert with check (auth.uid() = user_id);
drop policy if exists "usp_update_own" on public.user_strategy_preferences;
create policy "usp_update_own" on public.user_strategy_preferences for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "usp_delete_own" on public.user_strategy_preferences;
create policy "usp_delete_own" on public.user_strategy_preferences for delete using (auth.uid() = user_id);
```

### Edge functions

- `supabase/functions/evaluate-alerts/index.ts`: evaluates active alerts, writes `alert_events`, updates `alerts`, and enqueues `notifications_queue`, then invokes `notify`.
- `supabase/functions/notify/index.ts`: processes the queue and sends Expo pushes from `user_devices`.
- `supabase/functions/publish-signal/index.ts`: validates sender, inserts trade signals, and enqueues notifications.

### Clients

- `src/services/alertsService.ts`

  - `fetchAlerts(userId, symbol?)`, `createAlert`, `updateAlert`, `deleteAlert`
  - `registerDeviceToken(userId, expoPushToken)` → upserts into `user_devices`
  - `processNotificationQueue()` → invokes `notify`
  - `startRealtime(userId, handlers)` → subscribes to `trade_signals`, `alert_events`, and `alerts` changes

- `src/services/barsService.ts`

  - `subscribeAlertEvents(onInsert)` → realtime stream of `alert_events`

- `src/services/draftPlanService.ts`
  - `fetchUserDraftPlan(userId, symbol)`
  - `upsertUserDraftPlan({ userId, symbol, draft })`
  - `deleteUserDraftPlan(userId, symbol)`
  - `mapRemoteDraftPlan(row)` helper to convert to store payloads
  - Intended for use with `useTradeDraftSync`

### Migration: convert from global-per-user to named layouts

Run this once if your table previously had a `symbol` column and only one row per user:

```sql
begin;

-- 1) Add new columns
alter table public.user_chart_settings
  add column if not exists name text not null default 'Default',
  add column if not exists is_default boolean not null default false;

-- 2) Mark the most recent row per user as default; keep others (if any) non-default
with ranked as (
  select id,
         row_number() over (
           partition by user_id
           order by coalesce(updated_at, created_at) desc
         ) as rn
  from public.user_chart_settings
)
update public.user_chart_settings t
set is_default = (r.rn = 1)
from ranked r
where t.id = r.id;

-- 3) Drop legacy unique on (user_id, symbol) if present; keep RLS
do $$ begin
  execute (
    select 'drop index ' || string_agg(indexname, ', ')
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'user_chart_settings'
      and indexdef ilike '%(user_id, symbol)%'
  );
exception when others then null; end $$;

-- 4) Optionally drop the legacy symbol column
alter table public.user_chart_settings
  drop column if exists symbol;

commit;
```

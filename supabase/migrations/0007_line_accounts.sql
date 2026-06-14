-- BubanGo migration 0007 — LINE account binding
--
-- Stores the link between a BubanGo user (profiles.id == auth.users.id) and a
-- verified LINE userId. The LINE userId is ONLY ever written by the server after
-- it has verified a LINE ID token (see src/app/api/line/link/route.ts) — the
-- browser never writes this table directly with an unverified id.
--
-- Why a separate table (not a column on profiles):
--   * one-to-one but optional — most rows would be null early on;
--   * lets us add LINE-specific columns (display_name, picture_url) and, later,
--     a messaging/push opt-in without touching the core profile.
--
-- SCOPE (this migration): binding only. No push-notification / messaging columns
-- yet — those arrive with the LINE Messaging channel work. See
-- docs/LINE_ACCOUNT_BINDING.md.
--
-- Idempotent: create table/index if not exists + drop-then-create policies, so
-- it is safe to re-run.

create extension if not exists "pgcrypto";

-- set_updated_at() already ships in supabase/schema.sql; re-declare defensively
-- so this migration is self-contained and order-independent.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- line_accounts
-- ---------------------------------------------------------------------------

create table if not exists public.line_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  line_user_id text not null,
  display_name text,
  picture_url text,
  linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.line_accounts is
  'Binding between a BubanGo user (profiles.id) and a verified LINE userId. '
  'line_user_id is written only by the server after verifying a LINE ID token.';

-- One LINE account per BubanGo user, and one BubanGo user per LINE account.
-- The user_id unique index is also the ON CONFLICT arbiter used by the upsert
-- in the link route; the line_user_id unique index is what surfaces a
-- "already linked to someone else" (Postgres 23505) conflict.
create unique index if not exists line_accounts_user_id_key
  on public.line_accounts (user_id);
create unique index if not exists line_accounts_line_user_id_key
  on public.line_accounts (line_user_id);

drop trigger if exists line_accounts_set_updated_at on public.line_accounts;
create trigger line_accounts_set_updated_at
  before update on public.line_accounts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — own row only (mirrors the profiles policies)
-- ---------------------------------------------------------------------------

alter table public.line_accounts enable row level security;

drop policy if exists "line_accounts_select_own" on public.line_accounts;
create policy "line_accounts_select_own"
  on public.line_accounts for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "line_accounts_insert_own" on public.line_accounts;
create policy "line_accounts_insert_own"
  on public.line_accounts for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "line_accounts_update_own" on public.line_accounts;
create policy "line_accounts_update_own"
  on public.line_accounts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "line_accounts_delete_own" on public.line_accounts;
create policy "line_accounts_delete_own"
  on public.line_accounts for delete
  to authenticated
  using (auth.uid() = user_id);

-- BubanGo MVP — Supabase schema
-- Run in Supabase SQL Editor or via `supabase db push` after linking project.
--
-- Notes:
-- - applicant_count: maintained by repository layer in MVP; move to trigger/RPC before production.
-- - acceptApplication: use RPC + transaction before production to avoid race conditions when
--   multiple workers apply and owners accept concurrently.
-- - MVP: repository may update applications.status and shifts.status in separate queries.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

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
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  phone text,
  role text not null check (role in ('shop_owner', 'worker')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user. Links Supabase Auth to app role (shop_owner | worker).';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- shops
-- ---------------------------------------------------------------------------

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  address text not null,
  area text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.shops is
  'Store / restaurant owned by a shop_owner profile.';

create index shops_owner_id_idx on public.shops (owner_id);

create trigger shops_set_updated_at
  before update on public.shops
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- workers
-- ---------------------------------------------------------------------------

create table public.workers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  phone text,
  area text,
  experience text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.workers is
  'Worker profile linked to a worker-role auth user via profiles.id.';

create index workers_user_id_idx on public.workers (user_id);

create trigger workers_set_updated_at
  before update on public.workers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- shifts
-- ---------------------------------------------------------------------------

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  title text not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  hourly_wage integer not null check (hourly_wage > 0),
  required_workers integer not null check (required_workers > 0),
  applicant_count integer not null default 0 check (applicant_count >= 0),
  status text not null default 'open'
    check (status in ('open', 'matched', 'completed', 'cancelled')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shifts_end_after_start check (end_time > start_time)
);

comment on table public.shifts is
  'Short-term shift postings published by shops.';

-- applicant_count: MVP repository increments on apply; production should use trigger or RPC.
comment on column public.shifts.applicant_count is
  'Denormalized count of applications. MVP: maintained in repository layer. '
  'Production: prefer DB trigger on applications INSERT/DELETE or periodic reconcile.';

comment on column public.shifts.required_workers is
  'Number of workers needed. Maps to TypeScript Shift.requiredWorkers.';

create index shifts_shop_id_idx on public.shifts (shop_id);
create index shifts_status_idx on public.shifts (status);
create index shifts_date_idx on public.shifts (date);
create index shifts_status_date_idx on public.shifts (status, date);

create trigger shifts_set_updated_at
  before update on public.shifts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- applications
-- ---------------------------------------------------------------------------

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts (id) on delete cascade,
  worker_id uuid not null references public.workers (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shift_id, worker_id)
);

comment on table public.applications is
  'Worker applications to shifts. accept/reject in MVP via repository; use RPC before production.';

-- acceptApplication race: two owners or concurrent accepts — use RPC + row lock in production.
comment on column public.applications.status is
  'MVP: repository updates status and may update shifts.status in a second query. '
  'Production: accept_application RPC should run in one transaction with FOR UPDATE on shift.';

create index applications_shift_id_idx on public.applications (shift_id);
create index applications_worker_id_idx on public.applications (worker_id);
create index applications_status_idx on public.applications (status);

create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.workers enable row level security;
alter table public.shifts enable row level security;
alter table public.applications enable row level security;

-- profiles: own row only
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- shops: read all authenticated; write own
create policy "shops_select_authenticated"
  on public.shops for select
  to authenticated
  using (true);

create policy "shops_insert_owner"
  on public.shops for insert
  to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'shop_owner'
    )
  );

create policy "shops_update_owner"
  on public.shops for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- workers: read all authenticated; write own
create policy "workers_select_authenticated"
  on public.workers for select
  to authenticated
  using (true);

create policy "workers_insert_self"
  on public.workers for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'worker'
    )
  );

create policy "workers_update_self"
  on public.workers for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- shifts: read all authenticated; write own shop
create policy "shifts_select_authenticated"
  on public.shifts for select
  to authenticated
  using (true);

create policy "shifts_insert_shop_owner"
  on public.shifts for insert
  to authenticated
  with check (
    exists (
      select 1 from public.shops
      where shops.id = shop_id
        and shops.owner_id = auth.uid()
    )
  );

create policy "shifts_update_shop_owner"
  on public.shifts for update
  to authenticated
  using (
    exists (
      select 1 from public.shops
      where shops.id = shifts.shop_id
        and shops.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.shops
      where shops.id = shop_id
        and shops.owner_id = auth.uid()
    )
  );

-- applications: worker insert/select own; shop owner select/update on own shifts
create policy "applications_insert_worker"
  on public.applications for insert
  to authenticated
  with check (
    exists (
      select 1 from public.workers
      where workers.id = worker_id
        and workers.user_id = auth.uid()
    )
  );

create policy "applications_select_worker"
  on public.applications for select
  to authenticated
  using (
    exists (
      select 1 from public.workers
      where workers.id = applications.worker_id
        and workers.user_id = auth.uid()
    )
  );

create policy "applications_select_shop_owner"
  on public.applications for select
  to authenticated
  using (
    exists (
      select 1 from public.shifts
      join public.shops on shops.id = shifts.shop_id
      where shifts.id = applications.shift_id
        and shops.owner_id = auth.uid()
    )
  );

create policy "applications_update_shop_owner"
  on public.applications for update
  to authenticated
  using (
    exists (
      select 1 from public.shifts
      join public.shops on shops.id = shifts.shop_id
      where shifts.id = applications.shift_id
        and shops.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.shifts
      join public.shops on shops.id = shifts.shop_id
      where shifts.id = shift_id
        and shops.owner_id = auth.uid()
    )
  );

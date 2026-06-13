# BubanGo Supabase Schema

This document describes the PostgreSQL schema in [`supabase/schema.sql`](../supabase/schema.sql). It is the live data model for `SupabaseRepository`, which is now the **default** backend (`NEXT_PUBLIC_DATA_BACKEND=supabase`). `localStorageRepository` remains a dev fallback (`=local`).

> **Apply order in the Supabase SQL Editor:** `supabase/schema.sql` → `supabase/migrations/0001_applicant_count_trigger.sql` → (if email confirmation stays on) `supabase/migrations/0002_handle_new_user.sql` → `supabase/migrations/0003_accept_application_rpc.sql` → `supabase/migrations/0004_apply_to_shift_rpc.sql`.
>
> **`acceptApplication` and `applyToShift` are now RPCs.**
> - `acceptApplication()` → `public.accept_application(p_application_id uuid)` (migration 0003). Locks the `shifts` row `FOR UPDATE`; ownership + capacity check + accept + `matched` flip in one transaction. **`SECURITY INVOKER`** — the owner already has the needed RLS privileges, so it only adds atomicity.
> - `applyToShift()` → `public.apply_to_shift(p_shift_id uuid)` (migration 0004). Derives the worker from `auth.uid()` (ignores any client-passed id), locks the shift `FOR UPDATE`, enforces role/open/full/duplicate. **`SECURITY DEFINER`** — a worker must lock a shift it doesn't own, which exceeds the worker's RLS write privileges; the security intent is re-implemented as explicit checks (auth + role + worker-from-auth).
>
> `rejectApplication` is unchanged (still repository-side).
>
> **Implementation note — `location` ↔ `title`:** the app stores the shift location string in the `shifts.title` column (no separate `location` column in the MVP). `hourly_wage`, `required_workers`, `applicant_count` map to `hourlyRate`, `requiredWorkers`, `applicantCount`. Conversions live in `src/lib/data/mappers.ts`.

## Tables overview

| Table | Purpose |
|-------|---------|
| `profiles` | App identity per `auth.users` row: display name, phone, role (`shop_owner` \| `worker`) |
| `shops` | Store owned by a `shop_owner`; address and area for discovery |
| `workers` | Worker résumé linked to a `worker` profile |
| `shifts` | Short-term shift postings (date, time, wage, `required_workers`, status) |
| `applications` | Worker applies to a shift; shop owner accepts or rejects |

### Entity relationships

```
auth.users
    └── profiles (1:1)
            ├── shops (1:N, shop_owner)
            └── workers (1:1, worker)

shops
    └── shifts (1:N)
            └── applications (1:N)
                    └── workers
```

## TypeScript ↔ Supabase column mapping

Frontend types live in `src/types/index.ts`. Snake_case in SQL, camelCase in TypeScript.

### profiles ↔ Session / auth context

| TypeScript (concept) | Supabase column | Notes |
|----------------------|-----------------|-------|
| `auth.user.id` | `profiles.id` | Same UUID as `auth.users` |
| — | `profiles.display_name` | No direct TS type today |
| — | `profiles.phone` | |
| `UserRole` (`shop` \| `worker`) | `profiles.role` | Map `shop` → `shop_owner`, `worker` → `worker` |
| `Session.currentShopId` | `shops.id` | Resolve via `shops.owner_id = auth.uid()` |
| `Session.currentWorkerId` | `workers.id` | Resolve via `workers.user_id = auth.uid()` |

### Shop

| TypeScript `Shop` | Supabase `shops` | Notes |
|-------------------|------------------|-------|
| `id` | `id` | |
| `userId` | `owner_id` | References `profiles.id` |
| `name` | `name` | |
| `address` | `address` | |
| `phone` | — | Today on `Shop`; consider `profiles.phone` or add column later |
| `description` | `description` | |
| — | `area` | New; can map from worker “可工作地區” patterns |

### Worker

| TypeScript `Worker` | Supabase `workers` | Notes |
|---------------------|--------------------|-------|
| `id` | `id` | |
| `userId` | `user_id` | References `profiles.id` |
| `name` | `name` | |
| `phone` | `phone` | |
| `areas[]` | `area` | MVP: join array to comma-separated `area` text |
| `experience` | `experience` | |

### Shift

| TypeScript `Shift` | Supabase `shifts` | Notes |
|--------------------|-------------------|-------|
| `id` | `id` | |
| `shopId` | `shop_id` | |
| `shopName` | — | Join `shops.name` in repository |
| `date` | `date` | ISO date string ↔ `date` |
| `startTime` | `start_time` | `HH:mm` ↔ `time` |
| `endTime` | `end_time` | |
| `hourlyRate` | `hourly_wage` | Integer NTD/hour |
| `requiredWorkers` | `required_workers` | **Canonical naming pair** |
| `applicantCount` | `applicant_count` | Denormalized; see maintenance notes below |
| `status` | `status` | `open`, `matched`, `completed`, `cancelled` (no `filled` in DB) |
| `description` | `description` | |
| `location` | — | MVP: use `shops.address` or `shifts.title` until a `location` column is added |
| — | `title` | Required in DB; derive from shop name + date in `createShift` |

#### requiredWorkers ↔ required_workers

| Layer | Name |
|-------|------|
| TypeScript (`Shift`, `CreateShiftInput`) | `requiredWorkers` |
| Supabase / SQL | `required_workers` |

Repository mappers should convert at the boundary:

```ts
// DB → TS
requiredWorkers: row.required_workers

// TS → DB
required_workers: input.requiredWorkers
```

### Application

| TypeScript `Application` | Supabase `applications` | Notes |
|--------------------------|---------------------------|-------|
| `id` | `id` | |
| `shiftId` | `shift_id` | |
| `workerId` | `worker_id` | |
| `workerName` | — | Join `workers.name` |
| `workerPhone` | — | Join `workers.phone` |
| `status` | `status` | TS: `pending`, `accepted`, `rejected`; DB also allows `cancelled` |
| `appliedAt` | `created_at` | |
| — | `message` | Optional application note |

## Repository method → table mapping

| `BubanGoRepository` method | Primary tables | Query pattern |
|----------------------------|----------------|---------------|
| `getData()` | all | Parallel selects + joins; build `BubanGoData` snapshot |
| `getCurrentSession()` | `profiles`, `shops`, `workers` | `auth.getUser()` → profile → shop/worker IDs |
| `getShifts()` | `shifts`, `shops` | `SELECT shifts.*, shops.name AS shop_name FROM shifts JOIN shops …` |
| `getShiftById(id)` | `shifts`, `shops` | Same with `WHERE shifts.id = $id` |
| `createShift(input)` | `shifts` | `INSERT` with `shop_id`, `required_workers`, `hourly_wage`, … |
| `getApplications()` | `applications`, `workers` | Admin/debug; scope by RLS in practice |
| `getApplicationsByWorker(workerId)` | `applications`, `workers` | `WHERE worker_id = $id` |
| `getApplicationsByShift(shiftId)` | `applications`, `workers` | `WHERE shift_id = $id` |
| `applyToShift(shiftId, workerId)` | `applications`, `shifts` | `apply_to_shift` RPC (migration 0004): worker from `auth.uid()`, lock shift `FOR UPDATE`, insert pending. `workerId` arg ignored in Supabase mode. |
| `acceptApplication(id)` | `applications`, `shifts` | Update status; set shift `matched` when accepted count ≥ `required_workers` |
| `rejectApplication(id)` | `applications` | `UPDATE status = 'rejected'` |

## RLS design principles (MVP)

1. **Authenticated baseline** — browsing shops, workers, and open shifts requires login (`to authenticated`).
2. **Own profile** — users read/write only their `profiles` row (`auth.uid() = id`).
3. **Role-gated writes** — `shops` insert requires `profiles.role = 'shop_owner'`; `workers` insert requires `role = 'worker'`.
4. **Ownership for mutations** — shop owners mutate only rows tied to `shops.owner_id = auth.uid()`.
5. **Application privacy** — workers see their applications; shop owners see applications on shifts they own.
6. **No anon writes** — all policies target `authenticated`; public read can be added later for marketing pages.

### Policy summary

| Table | SELECT | INSERT | UPDATE |
|-------|--------|--------|--------|
| `profiles` | own | own | own |
| `shops` | all authenticated | shop_owner, `owner_id = auth.uid()` | owner |
| `workers` | all authenticated | worker, `user_id = auth.uid()` | self |
| `shifts` | all authenticated | shop owner of `shop_id` | shop owner of `shop_id` |
| `applications` | worker own + shop owner of shift | worker own | shop owner of shift |

## Implementing `supabase-repository.ts`

### Step 1 — Client (do not wire to `getRepository` yet)

```ts
// src/lib/supabase/client.ts (future)
import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

### Step 2 — Row mappers

Create `src/lib/data/mappers.ts`:

- `mapShiftRow(row, shopName): Shift`
- `mapApplicationRow(row, worker): Application`
- Convert `required_workers` ↔ `requiredWorkers`, `hourly_wage` ↔ `hourlyRate`, etc.

### Step 3 — Implement each interface method

Replace `throw new Error("Supabase repository not implemented yet")` with Supabase queries. Use `.select('*, shops(name)')` for joins where RLS allows.

### Step 4 — `getCurrentSession()`

```ts
const { data: { user } } = await supabase.auth.getUser();
const profile = await supabase.from("profiles").select("*").eq("id", user.id).single();
// if shop_owner → find shops where owner_id = user.id
// if worker → find workers where user_id = user.id
```

### Step 5 — Switch backend

Only after manual QA, change `get-repository.ts` to return `supabaseRepository`.

## Repository vs RPC / DB function

| Logic | MVP (repository) | Before production |
|-------|------------------|-------------------|
| `applicant_count` increment on apply | `UPDATE shifts SET applicant_count = applicant_count + 1` after insert | Trigger on `applications` INSERT/DELETE or materialized reconcile |
| `matched` when enough acceptances | Read accepted count, `UPDATE shifts SET status = 'matched'` | Same inside `accept_application` RPC with `FOR UPDATE` on shift row |
| `acceptApplication` | ✅ Done — `accept_application` RPC (migration 0003): single transaction, `FOR UPDATE` on shift, ownership + capacity checks | — |
| Duplicate apply guard | `unique (shift_id, worker_id)` + handle conflict | Keep constraint; RPC returns friendly error |
| Concurrent accepts (race) | Acceptable for MVP demo | RPC locks shift row; check `required_workers` vs accepted count atomically |
| `getData()` full snapshot | Multiple selects in repository | Optional: one RPC returning JSON snapshot for SSR |

### RPCs

| RPC | Status | Responsibility |
|-----|--------|----------------|
| `accept_application(p_application_id)` | ✅ Implemented (migration 0003) | Lock shift `FOR UPDATE`, verify owner, accept one worker, auto-`matched` when quota met. `SECURITY INVOKER`. |
| `apply_to_shift(p_shift_id)` | ✅ Implemented (migration 0004) | Derive worker from `auth.uid()`, lock shift `FOR UPDATE`, enforce role/open/full/duplicate, insert pending application. `SECURITY DEFINER`. |
| `reject_application(application_id)` | Future | Set rejected (currently repository-side) |
| `publish_shift(...)` | Future | Insert shift with validation |

## Applying the schema

1. Create a Supabase project.
2. Open **SQL Editor** → paste [`supabase/schema.sql`](../supabase/schema.sql) → Run.
3. Enable Email auth (or preferred provider) under **Authentication**.
4. On sign-up, create a `profiles` row (app or trigger) with the correct `role`.

## Related docs

- [`DATA_LAYER.md`](./DATA_LAYER.md) — repository pattern and localStorage behavior
- [`MVP_SPEC.md`](./MVP_SPEC.md) — product scope

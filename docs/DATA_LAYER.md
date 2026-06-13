# BubanGo Data Layer

> **Status:** Supabase is now the **default** backend (`NEXT_PUBLIC_DATA_BACKEND=supabase`).
> The repository interface is **async**. `localStorageRepository` remains as a
> dev fallback (`NEXT_PUBLIC_DATA_BACKEND=local`). See "Switching backends" below.

## Overview

BubanGo separates **UI** from **data access** via the `BubanGoRepository` interface. Page components and feature components only talk to `useBubanGoData()`; the hook delegates to whichever repository is active.

```
Page / Feature Component
        ↓
  useBubanGoData() hook   ← async load + { ready, error } state
        ↓
  getRepository()  ← single switch point (NEXT_PUBLIC_DATA_BACKEND)
        ↓
  SupabaseRepository      (default)  — Supabase Auth + Postgres + RLS
  LocalStorageRepository  (fallback) — NEXT_PUBLIC_DATA_BACKEND=local
```

## Current implementation: LocalStorage

**File:** `src/lib/data/local-storage-repository.ts`

All MVP data is stored in a single JSON blob under the key `bubango_data`. A flag `bubango_initialized` marks first-run seeding.

### Lifecycle

1. On first `getData()` call, if `bubango_data` is missing, seed data from `src/lib/seed.ts` is written.
2. On every save, `normalizeData()` runs:
   - Recomputes `applicantCount` per shift from applications.
   - Sets shift `status` to `matched` when accepted applications ≥ `requiredWorkers`.
   - Reverts `matched` → `open` if accepted count drops below `requiredWorkers`.
   - Migrates legacy `headcount` fields to `requiredWorkers` on read/save (old localStorage data remains compatible).
3. Existing browser data is preserved — keys are unchanged; shift objects are normalized to `requiredWorkers` on load.

### Dev reset

```js
localStorage.removeItem("bubango_data");
localStorage.removeItem("bubango_initialized");
location.reload();
```

Or programmatically: `localStorageRepository.reset()`.

## Repository interface

**File:** `src/lib/data/bubango-repository.ts`

| Method | Business behavior |
|--------|-------------------|
| `getData()` | Load full snapshot (shops, workers, shifts, applications, session) |
| `getShifts()` | List all shifts |
| `getShiftById(id)` | Single shift detail |
| `createShift(input)` | Store owner publishes a new open shift |
| `getApplications()` | List all applications |
| `getApplicationsByWorker(workerId)` | Worker's application history |
| `getApplicationsByShift(shiftId)` | Applicants for a shift (store review) |
| `applyToShift(shiftId, workerId)` | Worker applies; creates `pending` application. **Supabase backend: atomic via the `apply_to_shift` RPC (migration 0004)** — derives the worker from `auth.uid()` (the `workerId` arg is ignored in Supabase mode), locks the shift `FOR UPDATE`, enforces role/open/full/duplicate. |
| `acceptApplication(id)` | Store accepts; may set shift → `matched`. **Supabase backend: atomic via the `accept_application` RPC (migration 0003)** — locks the shift `FOR UPDATE` so concurrent accepts can't exceed `required_workers`. |
| `rejectApplication(id)` | Store rejects; application → `rejected`. **Supabase backend: atomic via the `reject_application` RPC (migration 0006)** — locks the shift `FOR UPDATE`; rejecting an accepted worker reopens a `matched` shift if it drops below `required_workers`. |
| `getCurrentSession()` | Current shop/worker IDs (stand-in for auth) |

> **Note (Supabase):** two mutations run as database functions rather than client table writes, to be atomic and race-free:
> - `acceptApplication` → `public.accept_application` (`SECURITY INVOKER`; the owner already has the RLS privileges, so it only adds atomicity).
> - `applyToShift` → `public.apply_to_shift` (`SECURITY DEFINER`; a worker must lock a shift it doesn't own, so RLS privileges are insufficient — identity/role are validated explicitly instead, and the worker is derived from `auth.uid()`).
>
> The three write mutations — `applyToShift` (`apply_to_shift`), `acceptApplication` (`accept_application`), `rejectApplication` (`reject_application`) — are all atomic RPCs. All other methods are plain RLS-scoped table queries.
>
> Shop/worker creation outside registration goes through `src/lib/auth/onboarding-service.ts` (the `/onboarding/*` fallback). Migration **0005** adds unique indexes on `shops.owner_id` and `workers.user_id`, so one user can never have two shops/workers (one shop per owner is the MVP product decision — see `SUPABASE_SCHEMA.md`).

## Switching to Supabase

### Step 1 — Implement the repository

Fill in `src/lib/data/supabase-repository.ts` using the Supabase client. Each method has a TODO noting the target table.

| Repository method | Planned Supabase table(s) |
|-------------------|---------------------------|
| `getData` | `shops`, `workers`, `shifts`, `applications` + Auth session |
| `getCurrentSession` | `profiles` + Supabase Auth |
| `getShifts` / `getShiftById` / `createShift` | `shifts` (+ join `shops` for name) |
| `getApplications*` / `applyToShift` | `applications` |
| `acceptApplication` / `rejectApplication` | `applications` (+ trigger or app logic for `shifts.status`) |

### Step 2 — Change the active backend

**File:** `src/lib/data/get-repository.ts`

```ts
import { supabaseRepository } from "./supabase-repository";

export function getRepository(): BubanGoRepository {
  return supabaseRepository; // was: localStorageRepository
}
```

### Step 3 — No page changes required

Components already use `useBubanGoData()` only. Optionally extend the hook if Supabase needs async loading (e.g. `ready` waits on network).

### Files you should **not** need to touch

- `src/app/**` pages
- `src/components/store/**`, `shifts/**`, `worker/**`
- `src/lib/validation.ts`

### Files you **will** touch

| File | Why |
|------|-----|
| `src/lib/data/supabase-repository.ts` | Implement queries |
| `src/lib/data/get-repository.ts` | Swap active repository |
| `src/hooks/useBubanGoData.tsx` | Only if methods become async |
| New `src/lib/supabase/client.ts` | Supabase client setup |

## Deprecated

`src/lib/storage.ts` re-exports the local repository for backward compatibility. New code should use `getRepository()` or import from `src/lib/data/`.

# BubanGo — Project Status (MVP checkpoint)

Snapshot of what works and how the system is wired, as of the MVP checkpoint.
For product scope see [`MVP_SPEC.md`](./MVP_SPEC.md); for the data model see
[`SUPABASE_SCHEMA.md`](./SUPABASE_SCHEMA.md) and [`DATA_LAYER.md`](./DATA_LAYER.md).

## MVP capabilities

The full 補班 (shift-filling) closed loop works end-to-end on Supabase:

1. Shop owner registers → shop created.
2. Shop owner publishes an open shift.
3. Worker registers → worker profile created.
4. Worker browses open shifts and applies.
5. Shop owner sees applicants and accepts one.
6. Shift flips to `matched` when accepted count reaches `required_workers`; it
   disappears from the worker's open list.
7. Shop owner can reject a pending or accepted application; rejecting an accepted
   worker reopens a `matched` shift if it drops below quota.
8. Onboarding fallback: if a shop/worker row is missing after login, the user is
   routed to `/onboarding/{shop,worker}` to complete it.

## Frontend / UI

Mobile-first UI built on a small in-repo design system (no external UI library):

- **UI primitives** (`src/components/ui/`): `Button`, `Card`, `Badge`, `Alert`,
  `Input`, `Textarea`, `PageHeader`, `EmptyState`, plus `Icon` (inline-SVG set,
  `currentColor`) and `Spinner`/`PageLoading`. Design tokens live in
  `globals.css` (`--color-primary*`, `--color-secondary*`, etc.).
- **Scannable shift cards**: `ShiftCard` leads with date (+ 今天/明天 relative
  chip), time, location, hourly wage, and a status badge — the five fields a
  worker scans first. Display helpers (`formatRelativeDay`, `formatHours`,
  `formatRelativeTime`, …) are in `src/lib/utils.ts`.
- **Layout**: `MobileShell` (max-w-md column) + `BottomNav` (role-aware,
  icon tabs, honours `env(safe-area-inset-bottom)`).
- Each screen has dedicated empty / loading / error+success states.

> This layer is presentation-only — it consumes `useBubanGoData()` and the
> existing services/RPCs unchanged. No auth, RLS, repository, or data-model
> behaviour is affected by UI work.

## Backend architecture

```
Next.js 15 (App Router, React 19, Tailwind) — client components
        │  useBubanGoData() hook (async, { ready, error })
        ▼
  getRepository()  ← NEXT_PUBLIC_DATA_BACKEND switch
        ├── SupabaseRepository (default)  → Supabase JS (anon key) → Postgres + RLS
        └── LocalStorageRepository (dev fallback, NEXT_PUBLIC_DATA_BACKEND=local)
```

- snake_case ↔ camelCase conversion: `src/lib/data/mappers.ts`.
- Auth/onboarding services: `src/lib/auth/{auth-service,profile-service,onboarding-service}.ts`.
- Supabase clients: `src/lib/supabase/{browser,server,env}.ts` (anon key only;
  `env.ts` normalizes a misconfigured `/rest/v1` URL suffix).
- Route protection: `src/middleware.ts`.

## Supabase tables

| Table | Purpose |
|-------|---------|
| `profiles` | One row per auth user: `display_name`, `phone`, `role` (`shop_owner` \| `worker`) |
| `shops` | Store owned by a `shop_owner` (`name`, `address`, `area`, `description`) |
| `workers` | Worker profile (`name`, `phone`, `area`, `experience`) |
| `shifts` | Shift posting (`date`, times, `hourly_wage`, `required_workers`, `applicant_count`, `status`; `title` holds the location string in MVP) |
| `applications` | Worker → shift application (`status`: pending/accepted/rejected/cancelled) |
| `line_accounts` | Optional 1:1 LINE binding (`line_user_id`, display/picture); own-row RLS. Written only by the server after verifying a LINE ID token (migration 0007) |

## Active DB objects (migrations)

| Object | Migration | Kind | Notes |
|--------|-----------|------|-------|
| `sync_applicant_count` | 0001 | trigger (SECURITY DEFINER) | Maintains `shifts.applicant_count` on application INSERT/DELETE (workers can't UPDATE shifts under RLS) |
| `handle_new_user` | 0002 | trigger (SECURITY DEFINER) | On `auth.users` INSERT, creates `profiles` + `shops`/`workers` from sign-up metadata |
| `accept_application(p_application_id)` | 0003 | RPC (SECURITY INVOKER) | Lock shift `FOR UPDATE`, verify owner, accept, auto-`matched` |
| `apply_to_shift(p_shift_id)` | 0004 | RPC (SECURITY DEFINER) | Worker from `auth.uid()`, lock shift, enforce role/open/full/duplicate, insert pending |
| `reject_application(p_application_id)` | 0006 | RPC (SECURITY INVOKER) | Verify owner, lock shift, reject pending/accepted, reopen `matched`→`open` if below quota |
| `line_accounts` + own-row RLS | 0007 | table + policies | Optional LINE binding; server-only writes after ID-token verification. See [`LINE_ACCOUNT_BINDING.md`](./LINE_ACCOUNT_BINDING.md) |
| `shops_owner_id_unique`, `workers_user_id_unique` | 0005 | unique index | One shop per owner / one worker per user |
| `*_set_updated_at` | schema.sql | trigger | `updated_at` maintenance on all tables |

> `set_updated_at` and the per-table RLS policies come from `supabase/schema.sql`
> (already applied). The three write mutations (apply/accept/reject) are atomic
> RPCs that lock the shift row; `createShift` is still a plain RLS-scoped insert
> (publishing has no concurrency race).

## Auth behavior

- Email + password via Supabase Auth. `role` is stored in `user_metadata` (at
  sign-up) and in `profiles.role`.
- Login routes by role: `shop_owner` → `/store`, `worker` → `/shifts`; honors a
  `?redirect=` param; routes to `/onboarding/*` if the role's row is missing.
- Middleware protects `/store/**`, `/worker/**`, `/onboarding/{shop,worker}`
  (role-gated), and bounces signed-in users away from `/auth/login|register`.
  Role comes from `user_metadata` (no DB round-trip). Bypassed in local mode.

## Email Confirmation behavior

- **Currently disabled** so the automated e2e can run the full loop.
- With it **enabled**: `signUp` returns no session; the `0002` trigger is the
  only row creator (client-side onboarding needs a session, so it doesn't run).
  The app shows a "check your email" message; after confirming + logging in the
  user has their rows. e2e **skips with a clear message** (it never touches an
  inbox). See [`EMAIL_CONFIRMATION_QA.md`](./EMAIL_CONFIRMATION_QA.md).

## localStorage fallback

`NEXT_PUBLIC_DATA_BACKEND=local` switches `getRepository()` to
`LocalStorageRepository` (seeded mock data, no Supabase). Middleware and
onboarding are effectively bypassed (seed session always has shop+worker). Used
for UI development without a backend.

## Known MVP limitations

- **One shop per owner** (DB-enforced by 0005). Multi-store is future work (drop
  the unique index + add a shop selector).
- **`shifts.title` holds the location** (no dedicated `location` column).
- **`shop.phone` comes from the owner's `profiles.phone`** (shops has no phone
  column); only the owner can read it (RLS), which is fine — workers don't need it.
- **`getData()` fetches a full snapshot** (no pagination).
- **No UI for `completed`/`cancelled` shifts** (the RPCs already guard those states).
- **DB `cancelled` application status** is folded to `rejected` in the UI.
- **Middleware doesn't query the DB**, so a signed-in user with a missing row who
  navigates directly to `/store` sees an empty state with an onboarding link
  (rather than an automatic redirect); the login flow does redirect.
- **e2e creates throwaway test users** that must be deleted manually (see cleanup).
- **Default Supabase email** is rate-limited; configure custom SMTP + Site URL
  before enabling confirmation for real traffic.

# BubanGo — Release / Handoff Checklist

Run through this before committing/tagging an MVP checkpoint or handing the repo
off. Nothing here uses a service_role key.

## 1. Environment (`.env.local`)

- [ ] `.env.local` exists and contains **only** these public keys:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `NEXT_PUBLIC_DATA_BACKEND` (`supabase` for the real backend; `local` for dev fallback)
- [ ] **No service_role key** anywhere in the repo or `.env.local`. The app only
      ever uses the anon key; RLS is the authorization layer.
- [ ] `NEXT_PUBLIC_SUPABASE_URL` is the **project root**
      (`https://<ref>.supabase.co`), **not** the `/rest/v1` API endpoint. (The app
      normalizes a `/rest/v1` suffix defensively, but keep the value clean.)
- [ ] `.env.local` is gitignored and **not** committed (`git check-ignore .env.local`).

## 2. Database migrations (Supabase SQL Editor)

Confirm these have been applied, in order (do **not** rerun `supabase/schema.sql`):

- [ ] `supabase/schema.sql` (tables, `updated_at` triggers, RLS policies)
- [ ] `0001_applicant_count_trigger.sql`
- [ ] `0002_handle_new_user.sql`
- [ ] `0003_accept_application_rpc.sql`
- [ ] `0004_apply_to_shift_rpc.sql`
- [ ] `0005_unique_shop_worker_owner.sql`
- [ ] `0006_reject_application_rpc.sql`

Quick verification: `node scripts/check-supabase.mjs` (all 5 tables present).

## 3. RLS

- [ ] Row Level Security is **enabled** on `profiles`, `shops`, `workers`,
      `shifts`, `applications` (Dashboard → Authentication → Policies, or Table
      Editor → each table → RLS toggle). All policies are from `schema.sql`.
- [ ] Spot-check: a worker can't update shifts, can't see others' applications;
      a shop owner sees only their own shifts' applications. (e2e asserts these.)

## 4. Email Confirmation decision

- [ ] Decide and record the **Confirm email** setting (Authentication → Sign In /
      Providers → Email):
  - **OFF** — automated e2e runs the full loop; client onboarding works.
  - **ON** — production-like; `0002` trigger handles onboarding; QA manually per
    [`EMAIL_CONFIRMATION_QA.md`](./EMAIL_CONFIRMATION_QA.md). e2e will skip.
- [ ] If turning ON for real traffic: configure custom SMTP + Site URL / redirect URLs.

## 5. Clean up test data

- [ ] Delete test users in **Authentication → Users** (search `bubango.test` and
      `bubango.dupcheck`). Deleting an auth user cascade-deletes its
      profile/shop/worker/shift/application rows. **Never delete real users.**
      See [`TESTING.md`](./TESTING.md) §Cleanup.
- [ ] (Optional) `node scripts/check-duplicates.mjs` → expect "無重複".

## 6. Build & tests

- [ ] `npm run build` passes.
- [ ] `node --check` passes for every script in `scripts/`.
- [ ] e2e behavior recorded:
  - Confirmation **OFF**: `node scripts/e2e-flow.mjs` → all pass;
    `node scripts/e2e-flow.mjs --unique` → all pass (incl. unique-constraint checks).
  - Confirmation **ON**: e2e prints a SKIP banner (not a failure).

## 7. Git

- [ ] Working tree reviewed (`git status`).
- [ ] Commit the checkpoint (see suggested message in the handoff notes).
- [ ] (Optional) Tag the checkpoint, e.g. `git tag -a v0.1.0-mvp -m "..."`.
- [ ] Confirm no secrets are tracked (`git ls-files | grep -iE '\.env|secret|service_role'`
      should show only `.env.example`).

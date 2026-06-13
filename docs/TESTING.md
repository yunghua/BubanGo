# BubanGo — Testing Guide

All checks use the **anon key only** (from `.env.local`) and never a service_role
key. The scripts print no secrets.

## Scripts & commands

| Command | What it validates | Side effects |
|---------|-------------------|--------------|
| `npm run build` | TypeScript + ESLint + Next build of all routes & middleware | none |
| `node scripts/check-supabase.mjs` | The 5 tables exist (schema applied); Supabase connectivity | none (read-only HEAD selects) |
| `node scripts/check-duplicates.mjs` | No duplicate `shops.owner_id` / `workers.user_id` (so 0005 applies cleanly) | creates **1** throwaway `bubango.dupcheck.*` user (to get a read session) |
| `node scripts/e2e-flow.mjs` | Full closed loop + apply/accept/reject RPCs, RLS, triggers, onboarding idempotency | creates **3** throwaway `bubango.test.*` users |
| `node scripts/e2e-flow.mjs --unique` | Same, plus the 0005 unique constraints reject a 2nd shop/worker (`23505`) | creates 3 throwaway users |
| `node scripts/release-check.mjs` | Env keys present + URL shape + tables exist; prints the rest of the checklist | none (spawns check-supabase) |
| `node --check scripts/<file>.mjs` | Script syntax only | none |

Throwaway users are cleaned up manually — see **Cleanup** below.

### Expected e2e result (Email Confirmation OFF)

```
結果：33 passed, 0 failed            # node scripts/e2e-flow.mjs (+5 reject = 36; numbers grow as tests are added)
結果：38 passed, 0 failed            # node scripts/e2e-flow.mjs --unique
```

The script prints each step; the important guarantees are: apply/accept/reject
are atomic, concurrent accept never over-fills, reject reopens a matched shift,
RLS blocks non-owners, and onboarding never duplicates rows.

### When Email Confirmation is ON

`signUp` returns no session, so the automated loop can't run (we never touch an
inbox by design). `e2e-flow.mjs` **skips with a clear banner and exits 0** (it is
**not** a failure). To get an automated green run, temporarily turn confirmation
OFF, run it, then turn it back ON. For production-like QA with confirmation ON,
use the manual flow below / [`EMAIL_CONFIRMATION_QA.md`](./EMAIL_CONFIRMATION_QA.md).

## Manual test — shop owner flow

1. `/` → "我是店家" → email / password / 店名 / 電話 / 地址 → 建立帳號.
   - Confirmation OFF: lands on `/store`. ON: shows "確認信已寄出", then confirm
     (Dashboard → Authentication → Users → **Confirm email**, no inbox needed) and log in.
2. `/store` shows the shop; **發布缺班** → fill date/time/wage/people → publish.
3. After a worker applies, open the shift → see the applicant → **接受** → status 已媒合.
4. **婉拒** a pending or accepted applicant; rejecting the accepted one reopens the shift.

## Manual test — worker flow

1. `/` → "我是打工者" → email / password / 姓名 / 手機 → 建立帳號 → (confirm if ON) → log in → `/shifts`.
2. Browse open shifts → open one → **申請這個缺班**.
3. `/worker/applications` shows 審核中; after the owner accepts, it shows 已錄取 and
   the shift leaves the open list.

## Manual test — onboarding fallback

Simulates a missing row (e.g. trigger didn't run). In the **SQL Editor** (admin
context — not a service_role key in the app):

```sql
-- find the user, then remove their row to simulate the failure
delete from public.shops   where owner_id = '<uid>';   -- shop owner case
delete from public.workers where user_id  = '<uid>';   -- worker case
```

1. Log in as that user → redirected to `/onboarding/shop` (or `/onboarding/worker`).
2. Fill the form → submit → row created → redirected to `/store` (or `/shifts`).
3. Verify exactly one row: `select count(*) from public.shops where owner_id='<uid>';` → `1`.
4. Re-open `/onboarding/shop` while a shop exists → it redirects you away to `/store`.

## Cleanup

The scripts never delete auth users (no service_role). Remove test data manually:

1. **Authentication → Users**.
2. Search **`bubango.test`** and **`bubango.dupcheck`**.
3. Delete those users. Each deletion **cascades** to their `profiles`, `shops`,
   `workers`, `shifts`, and `applications` rows (FKs are `on delete cascade`).
4. ⚠️ **Do not delete real users.** Only the `bubango.test*` / `bubango.dupcheck*`
   accounts are throwaway test data.

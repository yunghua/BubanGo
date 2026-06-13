# BubanGo — Email Confirmation QA Guide

How BubanGo onboarding behaves with Supabase **Email Confirmation** off vs on, how
to QA the production-like (confirmation **on**) flow by hand, and what to check
before flipping the switch.

Related: [`SUPABASE_SCHEMA.md`](./SUPABASE_SCHEMA.md), [`DATA_LAYER.md`](./DATA_LAYER.md),
trigger [`supabase/migrations/0002_handle_new_user.sql`](../supabase/migrations/0002_handle_new_user.sql).

> Toggle location in the Dashboard: **Authentication → Sign In / Providers → Email → "Confirm email"**.
> This guide never asks you to change it from code, and nothing here uses the service_role key.

---

## 1. The two modes

| | **Dev mode** (Confirm email **OFF**) | **Production-like mode** (Confirm email **ON**) |
|---|---|---|
| `signUp()` returns a session? | ✅ immediately | ❌ not until the user confirms |
| Who creates `profiles` / `shops` / `workers`? | `0002` trigger **and** client `ensure*` (idempotent) | **`0002` trigger only** (no client session at sign-up) |
| Can the user use the app right after sign-up? | ✅ yes | ❌ must confirm email, then log in |
| Automated `scripts/e2e-flow.mjs`? | ✅ runs full loop | ⏭️ **skips** (can't click the email) — use manual QA below |
| `0002` trigger required? | Recommended (client fallback also works) | **Mandatory** |

### Why the difference

The app sends sign-up metadata (`role`, `display_name`, `phone`, plus `address`
for shops) on `supabase.auth.signUp(...)`. The `0002_handle_new_user` trigger fires
`AFTER INSERT ON auth.users` — which happens at **sign-up time, before
confirmation** — and creates the `profiles` row plus the role-specific `shops` or
`workers` row from that metadata.

- **Confirmation OFF:** `signUp` also returns a client session, so
  `auth-service.ts` additionally runs `ensureProfile` / `ensureShop` /
  `ensureWorker`. These are idempotent (profile = upsert ignore-duplicates;
  shop/worker = check-then-insert), so they **no-op** because the trigger already
  created the rows. Net result: exactly one set of rows.
- **Confirmation ON:** `signUp` returns **no** session, so the client `ensure*`
  path does **not** run. `registerShopOwner` / `registerWorker` return
  `{ status: "confirm_email" }`, and `RegisterForm` shows
  *"註冊成功！我們已寄出確認信，請至信箱完成驗證後再回來登入。"* The rows are created
  **only** by the trigger.

---

## 2. Expected `0002` trigger behavior

`public.handle_new_user()` (SECURITY DEFINER, `search_path = public`), trigger
`on_auth_user_created AFTER INSERT ON auth.users`:

1. Always inserts a `public.profiles` row: `id = new.id`, `display_name`,
   `phone`, `role` (`shop_owner` | `worker`, default `worker`) from
   `raw_user_meta_data`. `ON CONFLICT (id) DO NOTHING`.
2. If `role = 'shop_owner'` → inserts a `public.shops` row: `owner_id = new.id`,
   `name = display_name`, `address` from metadata (coalesced to `''` if absent),
   `description`.
3. Else → inserts a `public.workers` row: `user_id = new.id`, `name`, `phone`,
   `experience`.

**When the user has signed up but NOT confirmed:** the trigger has *already run*
(it fires on the `auth.users` INSERT at sign-up). So `profiles` + `shops`/`workers`
**exist immediately**, even though the user cannot log in yet. Confirmation gates
*login*, not row creation.

**Fallback if the trigger did NOT create shop/worker:**

- **Confirmation OFF:** the client `ensureShop` / `ensureWorker` in
  `auth-service.ts` create them after sign-up (they have a session). So
  dev mode still works even if the trigger is missing.
- **Confirmation ON:** there is **no client session at sign-up**, so there is **no
  client fallback**. If `0002` is not installed, no `shops`/`workers` row is
  created. After the user confirms and logs in, `getCurrentSession()` returns an
  empty `currentShopId` / `currentWorkerId`, and the dashboard shows
  *"找不到店家資料"* / the worker profile shows *"找不到打工者資料"*. There is
  currently **no post-hoc onboarding screen** to recreate the row (registration is
  the only creation path). ➜ **Therefore `0002` is mandatory before enabling
  confirmation.** (It is already installed in this project.)

---

## 3. Dev mode QA (Confirm email OFF) — automated

```bash
node scripts/check-supabase.mjs   # tables exist
node scripts/e2e-flow.mjs         # full closed loop incl. apply/accept RPC race tests
npm run build
```

Expected: `scripts/e2e-flow.mjs` → **all checks pass** (e.g. `29 passed, 0 failed`).
Each run creates throwaway `bubango.test.*@gmail.com` users — delete them in
**Authentication → Users** afterwards (cascades to profile/shop/worker/shift/application).

---

## 4. Production-like mode QA (Confirm email ON) — manual

> You need to confirm emails. Two options, **no real inbox required**:
> - **(A) Dashboard confirm (recommended for QA):** after sign-up, go to
>   **Authentication → Users**, open the new user, and use **"Confirm email"** to
>   mark them confirmed — no inbox needed.
> - **(B) Real inbox:** sign up with an address you control and click the link in
>   the email. (Requires Site URL / redirect URLs to point at your running app —
>   see §6.)

### 4.0 Enable confirmation
Dashboard → **Authentication → Sign In / Providers → Email → turn ON "Confirm email"**. (Manual step — do not script it.)

### Shop owner

| # | Action | Expected |
|---|--------|----------|
| 1 | Open the app `/` → "我是店家" → fill email / password / 店名 / 電話 / 地址 → 建立帳號 | Form shows *"註冊成功！我們已寄出確認信…"*; **no** redirect to `/store` |
| 2 | Confirm the email — option (A) Dashboard "Confirm email", or (B) click the link | User's `email_confirmed_at` is set |
| 3 | (verify rows — see §5) | `profiles` row with `role = shop_owner`; `shops` row with the name + address you typed |
| 4 | Go to `/auth/login`, log in | Redirected to `/store`; dashboard shows the shop name + address |

### Worker

| # | Action | Expected |
|---|--------|----------|
| 5 | `/` → "我是打工者" → fill email / password / 姓名 / 手機 → 建立帳號 | *"…已寄出確認信…"*; no redirect |
| 6 | Confirm email (A or B) | confirmed |
| 7 | (verify rows — see §5) | `profiles` row with `role = worker`; `workers` row with the name |
| 8 | `/auth/login`, log in | Redirected to `/shifts` |

### Closed loop

| # | Action | Expected |
|---|--------|----------|
| 9  | As the shop owner: `/store` → 發布缺班 → fill + submit | Shift appears under 招募中 |
| 10 | As the worker: `/shifts` → open the shift → 申請這個缺班 | "申請成功"; appears in `/worker/applications` (審核中); `apply_to_shift` RPC ran |
| 11 | As the shop owner: open the shift → 接受 the applicant | Status → 已媒合; `accept_application` RPC ran |
| 12 | As the worker: `/worker/applications` | Shows 已錄取; the matched shift is gone from `/shifts` open list |

> Tip: use two browsers / a normal + an incognito window so the shop owner and
> worker sessions don't clobber each other.

---

## 5. Verifying rows without an inbox (SQL Editor)

Run in the **Supabase SQL Editor** (admin context — this is your own dashboard,
not the app, and does not involve a service_role key in the codebase):

```sql
-- newest auth users + confirmation state
select id, email, email_confirmed_at, created_at
from auth.users order by created_at desc limit 5;

-- rows the 0002 trigger should have created (substitute the uid from above)
select * from public.profiles where id = '<uid>';
select * from public.shops   where owner_id = '<uid>';   -- shop_owner
select * from public.workers where user_id  = '<uid>';   -- worker
```

A profile with the right `role`, plus a matching `shops`/`workers` row, confirms
the trigger fired correctly. You can also verify in the app UI: `/store` (shop
exists) and `/worker/profile` (worker exists).

---

## 6. Remaining risks before turning Email Confirmation back on

1. **`0002` trigger must stay installed** — it is the *only* row creator in
   confirmation-on mode. (Currently installed. If you ever reset the DB, re-run it.)
2. **Email delivery / SMTP** — Supabase's built-in email sender is rate-limited
   (a few messages/hour) and may land in spam. Fine for QA; configure **custom
   SMTP** before real traffic. Use the Dashboard "Confirm email" action to QA
   without relying on delivery.
3. **Site URL / redirect URLs** — the confirmation link redirects to the
   configured **Authentication → URL Configuration → Site URL**. Set it (and any
   additional redirect URLs) to your running app, or the link will 404 / bounce to
   localhost. Not needed for the Dashboard-confirm QA path.
4. **No post-hoc onboarding UI** — if a row is ever missing (e.g. trigger removed),
   the user can confirm + log in but lands on an empty *"找不到店家資料"* state with
   no way to recreate the shop/worker from the UI. Keep the trigger installed; a
   future enhancement could add a "complete your profile" screen.
5. **`address` may be empty for shops** — the shop form collects address, so it is
   normally present in metadata; but the trigger coalesces a missing address to
   `''`. Owners can fix it in `/store/settings`.
6. **Automated e2e can't run** with confirmation on (no inbox automation by
   design). `scripts/e2e-flow.mjs` now **skips with a clear message** instead of
   reporting a failure (see §3 / the script banner). To get an automated green run,
   temporarily flip confirmation **off**, run it, then flip it back on.
7. **Clean up test users** before flipping — delete leftover
   `bubango.test.*@gmail.com` users so unconfirmed test accounts don't cause
   confusion.

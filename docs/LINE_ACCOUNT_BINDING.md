# LINE Account Binding

Lets a signed-in BubanGo user link their account to their LINE account so we can
send them notifications over LINE — currently a push when a shop owner accepts
their application (see "LINE push — accept notification" below). This does **not**
replace Supabase email/password auth — it's an optional add-on.

> **How binding works now (v0.1.7+):** binding derives the LINE userId from the
> signed-in user's **Supabase Auth LINE identity** (the `custom:line` Custom OAuth
> provider — see [`LINE_LOGIN_SETUP.md`](./LINE_LOGIN_SETUP.md)). No LIFF SDK runs
> and no ID token is sent from the browser. The old LIFF-token flow (`liff.ts` +
> the `POST /api/line/link` route) has been **removed**.

> **Why this matters for push:** `line_accounts` is the RLS-protected place that
> stores the verified LINE userId the **Messaging API** push uses (see "LINE push
> — accept notification" below). Today it records the binding for users who signed
> in with LINE; email/password users must sign in with LINE before they can bind
> (see below).

---

## Flow

```
 Signed-in user                         BubanGo server                  Supabase
 ──────────────                         ──────────────                  ────────
 tap 「綁定 LINE 接收通知」
        │
        ▼
 POST /api/line/link-from-auth ───────▶ getUser()  (revalidates JWT)
   (no body)                             │  401 not_authenticated if none
                                         ▼
                                  read LINE identity from user.identities
                                  (provider custom:line) → verified `sub`
                                         │  422 line_identity_missing if absent
                                         ▼  (e.g. email-only users)
                                  upsert line_accounts (onConflict user_id) ─▶ RLS
                                         │  409 line_account_already_linked (23505)
                                         ▼
                                   { ok: true, account }
```

The browser sends **no LINE credentials**. The LINE userId comes from the user's
own Supabase session — Supabase already verified the LINE OIDC token during the
Custom-OAuth code exchange, so the trusted `sub` lives in their identity. The raw
LINE userId is never taken from the browser or from user-editable metadata.

---

## Security model

- **Auth required.** Both routes call `supabase.auth.getUser()` (revalidates the
  JWT). No session → `not_authenticated`.
- **LINE userId from the auth identity, not the browser.** `link-from-auth` reads
  the LINE `sub` only from the user's `custom:line` identity (`identity_data` /
  identity id), which Supabase Auth manages and the user cannot mutate. It does
  **not** fall back to `user_metadata` (an email signup's `sub` there is its own
  Supabase UUID, which would bind a bogus value). A missing identity →
  `line_identity_missing`, so **email/password users see**
  「請先使用 LINE 登入後再綁定通知。」 until they sign in with LINE.
- **No Channel secret, no LIFF, no ID-token round-trip.** Trust comes from the
  Supabase session; there is no longer a call to LINE's token-`verify` endpoint.
- **No service_role key.** Writes go through the user's RLS-scoped anon client; the
  `line_accounts` policies only permit `auth.uid() = user_id`.
- **RLS unchanged elsewhere.** No existing table, policy, or RPC is modified.
- **One-to-one.** `unique(user_id)` (one LINE per BubanGo user) and
  `unique(line_user_id)` (one BubanGo user per LINE account). A second user trying
  to bind an already-linked LINE account gets `line_account_already_linked`.

---

## Database — `line_accounts`

Created by [`supabase/migrations/0007_line_accounts.sql`](../supabase/migrations/0007_line_accounts.sql).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid | → `profiles(id)` on delete cascade; **unique** |
| `line_user_id` | text | verified LINE userId (`sub`); **unique** |
| `display_name` | text | from the LINE identity (cosmetic) |
| `picture_url` | text | from the LINE identity (cosmetic) |
| `linked_at` | timestamptz | default `now()` |
| `updated_at` | timestamptz | maintained by `set_updated_at` trigger |

**RLS** (enabled): `select` / `insert` / `update` / `delete` each gated by
`auth.uid() = user_id`. A user can only ever read or change their own binding.

---

## API routes

### `POST /api/line/link-from-auth`
No body. Binds using the signed-in user's `custom:line` identity. On success:
`{ "ok": true, "account": { "displayName", "pictureUrl", "linkedAt" } }`.

### `POST /api/line/unlink`
No body. Deletes the caller's own `line_accounts` row. `{ "ok": true }`.

### Error codes (JSON `{ "error": <code> }`)

| Code | HTTP | Meaning |
|------|------|---------|
| `not_authenticated` | 401 | No Supabase session |
| `line_identity_missing` | 422 | Signed in, but not via LINE — no `custom:line` identity (e.g. an email/password user) |
| `line_account_already_linked` | 409 | That LINE userId is bound to a different user |
| `link_failed` / `unlink_failed` | 500 | Unexpected DB error |

(`network_error` is surfaced client-side when the request itself fails.)

---

## Client modules

- `src/lib/line/line-service.ts` — `getMyLineAccount()` (own row via RLS),
  `linkLineAccountFromAuth()`, `unlinkLineAccount()`, `isLocalBackend()`.
- `src/components/line/LineBindingCard.tsx` — the card shown on `/worker/profile`
  and `/store/settings`. Uses **no** LIFF SDK; on mount it only reads the existing
  binding, and the bind button calls `link-from-auth`.

## UI states (the binding card)

| State | When | Shows |
|-------|------|-------|
| **loading** | checking on mount | spinner +「檢查綁定狀態…」 |
| **local** | `NEXT_PUBLIC_DATA_BACKEND=local` | note: bind needs a real login |
| **unlinked** | no binding yet | active 「綁定 LINE 接收通知」 button |
| **linked** | a binding exists | 「已綁定 LINE · 名稱」 + 「解除綁定」 |
| **error** | a link/unlink call failed | inline message (not-LINE-login, already-linked, network, …) |

Binding is never required to use the app.

---

## LINE push — accept notification (v0.1.8)

When a shop owner accepts a worker's application, the server sends that worker a
plain-text LINE push 「你已錄取補班！」 with the shop name, shift, and time — **if**
the worker has a linked LINE account and has added the Messaging API Official
Account as a friend. This is the only push implemented so far.

### Where it runs

`POST /api/applications/[applicationId]/accept` (Node runtime, server-only):

1. `auth.getUser()` — 401 if not signed in.
2. `accept_application` RPC (unchanged; row-locked, ownership + capacity guards).
3. If the accept filled the shift, auto-decline the remaining pending applicants
   (moved here from the browser repository).
4. `get_line_push_target(p_application_id)` — SECURITY DEFINER RPC (migration
   0010) returning the accepted worker's `line_user_id`, or null. It verifies the
   caller owns the shift and the application is `accepted`, so an owner can only
   ever resolve the LINE userId of a worker they actually accepted.
5. If linked, [`src/lib/line/line-messaging.ts`](../src/lib/line/line-messaging.ts)
   sends the push via the Messaging API using `LINE_CHANNEL_ACCESS_TOKEN`.

The browser repository's `acceptApplication` simply calls this route; the UI is
unchanged.

### Security / failure behaviour

- **Accept always wins.** The push (and the auto-decline) are best-effort: if the
  push is skipped or fails, the accept still succeeds.
- **`LINE_CHANNEL_ACCESS_TOKEN` is server-only** — no `NEXT_PUBLIC_`, read only in
  `line-messaging.ts`, never logged, never sent to the browser. It is the
  **Messaging API** channel token (that channel shares the LINE Login provider, so
  the stored `line_user_id` is addressable). Set it in Vercel env (Production +
  Preview, marked Sensitive). See [`.env.example`](../.env.example).
- **No service_role, no RLS loosening.** `line_accounts` stays own-row only; the
  DEFINER RPC is the controlled read path. The response never includes
  `line_user_id` — only a coarse status (`sent` / `skipped_no_line` /
  `skipped_unconfigured` / `failed`).
- **Not friended → 403.** LINE only delivers to users who have added the OA as a
  friend, so a worker who signed in with LINE but never added the OA does not
  receive the push (logged as `failed`; the accept is unaffected).

### Still future work

A Rich Menu, follow/unfollow webhooks, stored messaging opt-in/opt-out, new-shift
broadcasts, reminders, and reject / other notifications are **not** built. Adding
them would likely introduce a `messaging_opt_in` / follow-state column on
`line_accounts` plus a webhook route, and should respect LINE's messaging quota
with retry/back-off.

---

## What's implemented now

- Binding from the Supabase Auth LINE identity → `line_accounts` upsert (link) +
  delete (unlink), all via the RLS-scoped anon client.
- `line_accounts` table with RLS (own-row only) and one-to-one uniqueness.
- Binding card on `/worker/profile` and `/store/settings`.
- **LINE push on accept** (v0.1.8): a plain-text 「已錄取」 notice to the accepted
  worker, server-side and best-effort (see above).
- Normal browser usage and the localStorage fallback are unaffected.

## What's **not** implemented yet

- ❌ Any push other than the accept notice (new-shift broadcast, reminders,
  reject / store notifications, bulk push).
- ❌ Rich Menu creation/automation.
- ❌ Follow/unfollow webhooks, messaging opt-in/opt-out storage.
- ❌ Flex messages (the accept notice is plain text).

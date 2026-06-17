# LINE Account Binding

Lets a signed-in BubanGo user link their account to their LINE account, so we can
(in a later task) send shift/match notifications over LINE. This does **not**
replace Supabase email/password auth — it's an optional add-on.

> **How binding works now (v0.1.7+):** binding derives the LINE userId from the
> signed-in user's **Supabase Auth LINE identity** (the `custom:line` Custom OAuth
> provider — see [`LINE_LOGIN_SETUP.md`](./LINE_LOGIN_SETUP.md)). No LIFF SDK runs
> and no ID token is sent from the browser. The old LIFF-token flow (`liff.ts` +
> the `POST /api/line/link` route) has been **removed**.

> **Still needed after LINE Login?** Yes — for the future **push** feature.
> `line_accounts` is the RLS-protected place to store the verified LINE userId for
> the **Messaging API** push later. Today it records the binding for users who
> signed in with LINE; email/password users must sign in with LINE before they can
> bind (see below).

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

## Rich Menu / push — future work (not implemented)

LINE push (Messaging API), a Rich Menu, and follow/unfollow webhooks are **not**
built yet. The plan when that work starts:

1. Create a **Messaging API channel** (separate from the LINE Login channel) and
   store its `LINE_CHANNEL_ACCESS_TOKEN` **server-side only** (never the repo).
2. Add a `messaging_opt_in` (and likely follow-state) column to `line_accounts`,
   plus a webhook route for follow/unfollow events.
3. On accept/reject/new-match, send a push to the user's `line_user_id` from the
   server (service-side token, still no service_role Supabase key).
4. Respect opt-in/opt-out and LINE's messaging quota; add retry/back-off.

---

## What's implemented now

- Binding from the Supabase Auth LINE identity → `line_accounts` upsert (link) +
  delete (unlink), all via the RLS-scoped anon client.
- `line_accounts` table with RLS (own-row only) and one-to-one uniqueness.
- Binding card on `/worker/profile` and `/store/settings`.
- Normal browser usage and the localStorage fallback are unaffected.

## What's **not** implemented yet

- ❌ LINE push / Messaging API.
- ❌ Rich Menu creation/automation.
- ❌ Follow/unfollow webhooks, messaging consent storage.

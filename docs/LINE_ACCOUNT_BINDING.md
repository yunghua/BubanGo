# LINE Account Binding

Lets a signed-in BubanGo user link their **existing** Supabase account to their
LINE account, so we can (in a later task) send shift/match notifications over
LINE. This does **not** replace Supabase email/password auth — it's an optional
add-on. Setup of the LINE channel/LIFF app is in [`LIFF_SETUP.md`](./LIFF_SETUP.md).

---

## Flow

```
 In LINE (LIFF)                         BubanGo server                 Supabase
 ─────────────                          ──────────────                 ────────
 liff.getIDToken()
        │  idToken
        ▼
 POST /api/line/link  ───────────────▶  getUser()  (Supabase session)
                                         │  401 not_authenticated if none
                                         ▼
                                  POST api.line.me/oauth2/v2.1/verify
                                   { id_token, client_id=LINE_CHANNEL_ID }
                                         │  400 invalid_line_token if bad
                                         ▼  payload.sub = LINE userId
                                  upsert line_accounts (onConflict user_id) ─▶ RLS
                                         │  409 line_account_already_linked (23505)
                                         ▼
                                   { ok: true, account }
```

The browser sends an **ID token only**. The server verifies it with LINE and
reads the LINE userId from the verified payload — `liff.getProfile().userId` is
never trusted or stored.

---

## Security model

- **Auth required.** Both routes call `supabase.auth.getUser()` (revalidates the
  JWT). No session → `not_authenticated`.
- **Server-side token verification.** We POST the ID token to
  `https://api.line.me/oauth2/v2.1/verify` with `client_id = LINE_CHANNEL_ID`.
  LINE checks the signature, expiry and audience. We additionally re-assert
  `payload.aud === LINE_CHANNEL_ID` and require `payload.sub`.
- **No Channel secret.** The verify endpoint needs only the Channel ID. The
  secret is never required, requested, printed, or committed.
- **No service_role key.** Writes go through the user's RLS-scoped anon client;
  the `line_accounts` policies only permit `auth.uid() = user_id`.
- **RLS unchanged elsewhere.** This adds a new table + its own policies; no
  existing table, policy, or RPC is modified.
- **One-to-one.** `unique(user_id)` (one LINE per BubanGo user) and
  `unique(line_user_id)` (one BubanGo user per LINE account). A second user
  trying to bind an already-linked LINE account gets `line_account_already_linked`.

---

## Database — `line_accounts`

Created by [`supabase/migrations/0007_line_accounts.sql`](../supabase/migrations/0007_line_accounts.sql)
(idempotent — safe to re-run).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid | → `profiles(id)` on delete cascade; **unique** |
| `line_user_id` | text | verified LINE userId (`sub`); **unique** |
| `display_name` | text | from the verified token (needs `profile` scope) |
| `picture_url` | text | from the verified token (needs `profile` scope) |
| `linked_at` | timestamptz | default `now()` |
| `updated_at` | timestamptz | maintained by `set_updated_at` trigger |

**RLS** (enabled): `select` / `insert` / `update` / `delete` each gated by
`auth.uid() = user_id`. So a user can only ever read or change their own binding.

> **Manual step:** run this migration on your Supabase project (SQL Editor →
> paste the file, or `supabase db push`). It only **adds** a table + policies; it
> never touches existing data.

---

## API routes

### `POST /api/line/link`
Body: `{ "idToken": "<LINE ID token>" }`. On success:
`{ "ok": true, "account": { "displayName", "pictureUrl", "linkedAt" } }`.

### `POST /api/line/unlink`
No body. Deletes the caller's own `line_accounts` row. `{ "ok": true }`.

### Error codes (JSON `{ "error": <code> }`)

| Code | HTTP | Meaning |
|------|------|---------|
| `not_authenticated` | 401 | No Supabase session |
| `missing_id_token` | 400 | No `idToken` in the request body |
| `invalid_line_token` | 400 | LINE verify failed / wrong audience / no subject |
| `line_account_already_linked` | 409 | That LINE userId is bound to a different user |
| `line_config_missing` | 500 | `LINE_CHANNEL_ID` not set on the server |
| `link_failed` / `unlink_failed` | 500 | Unexpected DB error |

---

## Client modules

- `src/lib/line/liff.ts` — initializes LIFF **once**, client-only, dynamic
  import. `isLiffConfigured()`, `initLiff()` (returns `unconfigured | ready |
  error`, never throws), `getLineIdToken()`.
- `src/lib/line/line-service.ts` — `getMyLineAccount()` (own row via RLS),
  `linkLineAccount(idToken)`, `unlinkLineAccount()`, `isLocalBackend()`.
- `src/components/line/LineBindingCard.tsx` — the card shown on
  `/worker/profile` and `/store/settings`.

## UI states (the binding card)

| State | When | Shows |
|-------|------|-------|
| **loading** | checking on mount | spinner +「檢查綁定狀態…」 |
| **local** | `NEXT_PUBLIC_DATA_BACKEND=local` | note: bind needs a real login |
| **not in LINE** | plain browser / LIFF unset / `!isInClient()` | 「請在 LINE App 內開啟」 + disabled 「綁定 LINE 接收通知」 |
| **ready to link** | opened in LINE, not yet linked | active 「綁定 LINE 接收通知」 |
| **linked** | a binding exists | 「已綁定 LINE · 名稱」 + 「解除綁定」 |
| **error** | a link/unlink call failed | inline message (already-linked, network, …) |

Binding is never required to use the app.

---

## Rich Menu — suggested "mixed" layout (manual, not automated)

A LINE Rich Menu is **not** created by this task (no automation yet). When you
design one in the LINE Developers console (or via the Messaging API later), a
mixed 4-tile layout works well for both roles:

```
┌─────────────────────┬─────────────────────┐
│      我要找人        │      我要補班        │   ← top row (large)
│   (店家：找人手)     │   (打工者：找缺班)   │
├─────────────────────┼─────────────────────┤
│      我的申請        │      客服 / 說明      │   ← bottom row (small)
└─────────────────────┴─────────────────────┘
```

| Tile | Audience | Suggested action / target |
|------|----------|---------------------------|
| 我要找人 | shop owner | open LIFF → `/store/shifts/new` (發布缺班) |
| 我要補班 | worker | open LIFF → `/shifts` |
| 我的申請 | worker | open LIFF → `/worker/applications` |
| 客服 / 說明 | all | help page or LINE chat / FAQ |

Tiles open the LIFF app (`https://liff.line.me/<LIFF_ID>`), which lands on the
endpoint URL; deep-linking to a specific path can use the LIFF URL `?path=`/
query handling or per-path LIFF apps. Rich Menu creation/automation and a
Messaging API channel are future work.

---

## What's implemented now

- LIFF wrapper that degrades gracefully without `NEXT_PUBLIC_LIFF_ID`.
- Server-verified LINE ID token → `line_accounts` upsert (link) + delete (unlink).
- `line_accounts` table with RLS (own-row only) and one-to-one uniqueness.
- Binding card on `/worker/profile` and `/store/settings` with all states above.
- Normal browser usage and the localStorage fallback are unaffected.

## What's **not** implemented yet

- ❌ LINE push / Messaging API (no `LINE_CHANNEL_ACCESS_TOKEN`, no send logic).
- ❌ Rich Menu creation/automation.
- ❌ LINE MINI App.
- ❌ Login *via* LINE (we bind to an existing Supabase account; we don't replace auth).
- ❌ Follow/unfollow webhooks, messaging consent storage.

## Future push notification plan (next task, not now)

1. Create a **Messaging API channel** (separate from the LINE Login channel) and
   store its `LINE_CHANNEL_ACCESS_TOKEN` **server-side only** (Vercel env /
   `.env.local`, never the repo).
2. Add a `messaging_opt_in` (and likely follow-state) column to `line_accounts`,
   plus a webhook route for follow/unfollow events.
3. On accept/reject/new-match, send a push to the user's `line_user_id` via the
   Messaging API **from the server** (service-side token, still no service_role
   Supabase key).
4. Respect opt-in/opt-out and LINE's messaging quota; add retry/back-off.
5. Optionally wire the Rich Menu so notifications deep-link back into the LIFF app.

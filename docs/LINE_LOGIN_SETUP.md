# LINE Login Setup (primary login)

BubanGo uses **LINE Login as the primary user-facing login**, implemented with a
**Supabase Auth Custom OAuth/OIDC provider** (identifier `custom:line`).
Email/password stays as a fallback/dev/admin path. Custom auth is never built and
passwords are never stored by the app.

> **Nothing here lives in the repo.** The LINE Channel **secret** is entered
> **only** in the Supabase Dashboard provider settings. Do not paste it into
> chat, code, or `.env*`.

This is a **manual** configuration guide. Until it's done, the app still builds
and runs, and email/password login works; the 「使用 LINE 登入」 button will return
a friendly "LINE 登入尚未啟用" error.

---

## How it works

```
/auth/login ──「使用 LINE 登入」──▶ supabase.auth.signInWithOAuth({ provider:"custom:line",
                                        scopes:"openid profile",
                                        redirectTo: <origin>/auth/callback })
        │
        ▼
  access.line.me (user authorizes)  ──▶  Supabase  /auth/v1/callback
        │  (Supabase exchanges code with LINE using the Channel secret)
        ▼
  <origin>/auth/callback?code=...  ──▶  exchangeCodeForSession → read profiles.role
        ├─ no profile/role → /onboarding   (first-time LINE user picks 身分)
        ├─ shop_owner      → /store
        └─ worker          → /shifts
```

Email is requested **nowhere** — only `openid profile`. LINE's email permission
is **not** required.

---

## 1. LINE Developers Console (manual)

Use a **LINE Login channel** under your Provider (create one if you don't have it
yet).

1. Open the [LINE Developers Console](https://developers.line.biz/console/) →
   your Provider → the **LINE Login channel**.
2. **Basic settings:** confirm the channel has **OpenID Connect** enabled
   (LINE Login channels support OIDC by default). Note the **Channel ID** and
   **Channel secret** — you'll paste the secret into Supabase (next section),
   not here.
3. **LINE Login tab → Callback URL:** add the **Supabase** callback URL
   (from section 2):
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
   (This is the URL LINE redirects back to after authorization — it is
   Supabase's URL, not the app's.)
4. **Scopes / OpenID:** ensure `openid` and `profile` are available. Do **not**
   enable/require the **email** permission.

## 2. Supabase Dashboard (manual)

1. Open your project → **Authentication → Providers** (or **Sign In / Providers**).
2. Add a **Custom OAuth / OIDC provider** with the slug **`line`** so its
   identifier becomes **`custom:line`** (this must match the code).
3. Configure it against LINE's OIDC endpoints:
   - **Issuer / discovery:** `https://access.line.me`
     (discovery doc: `https://access.line.me/.well-known/openid-configuration`)
   - **Client ID:** the LINE **Channel ID** (from section 1).
   - **Client secret:** the LINE **Channel secret** — **paste it here, in
     Supabase, only.** 🔒
   - **Scopes:** `openid profile` (no `email`).
4. Copy the **Callback URL** Supabase shows
   (`https://<project-ref>.supabase.co/auth/v1/callback`) and make sure it's in
   the LINE channel's Callback URL list (section 1, step 3).
5. **Authentication → URL Configuration → Redirect URLs:** add the app's
   callback origin(s) so Supabase will redirect back to the app after login:
   ```
   http://localhost:3000/auth/callback
   https://<your-production-domain>/auth/callback
   ```
   (Also set the **Site URL** to your production origin.)
6. **Email optional:** because we never request LINE's email scope, LINE users
   arrive **without** an email. Ensure the provider/sign-up settings allow users
   without an email (do not require email confirmation for this provider). Phone
   is collected later in onboarding as a contact field, not a credential.

## 3. Environment variables

LINE Login needs **no new app environment variables** — the provider (and the
Channel secret) live entirely in the Supabase Dashboard. The app only relies on
the existing:

| Variable | Already set? | Used by |
|----------|--------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | callback exchange + all auth |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | client/server Supabase (RLS) |

There are **no other app env vars.** The old `NEXT_PUBLIC_LIFF_ID` /
`LINE_CHANNEL_ID` vars were removed in v0.1.7: the LIFF-token binding flow (and the
LIFF SDK) is gone. LINE **notification binding** now derives the LINE identity from
the signed-in user's Supabase Auth session and uses the
`POST /api/line/link-from-auth` and `POST /api/line/unlink` routes — see
[`LINE_ACCOUNT_BINDING.md`](./LINE_ACCOUNT_BINDING.md).

> The Channel **secret** is **only** in Supabase Dashboard → provider settings.
> Never in `.env.local`, the repo, or chat.

## 4. Database migration (manual)

Run [`supabase/migrations/0008_line_login_primary.sql`](../supabase/migrations/0008_line_login_primary.sql)
(SQL Editor or `supabase db push`). It rewrites `handle_new_user()` so a sign-up
**without** a role in metadata (every LINE user) is **not** auto-provisioned —
onboarding creates their profile + role row instead. Email/password sign-ups are
unaffected. It never touches existing rows, RLS, or RPCs, and is idempotent.

---

## First-time LINE user → onboarding

A new LINE user has no `profiles` row (the trigger skips them), so
`/auth/callback` sends them to `/onboarding`, which asks:

- **身分:** 「我要找人」(店家) or 「我要補班」(打工者)
- **display name** (店名 / 名字)
- **Taiwan phone** (required contact field — never a login credential)
- **店家地址** (shops only)

Submitting creates the profile (with role) + the shop/worker row (under RLS),
and mirrors the role into auth metadata so middleware routes them thereafter.
Returning LINE users go straight to `/store` or `/shifts`.

## Email / password fallback

Still fully available: `/auth/login` → 「使用 Email 登入」, and `/auth/register`
(with the 店家/打工者 toggle). These users get a role at sign-up as before. LINE
Login does not replace or remove this path.

## Rich Menu (manual, future)

Not automated — a Rich Menu is future work. See the notes in
[`LINE_ACCOUNT_BINDING.md`](./LINE_ACCOUNT_BINDING.md).

## LINE push notifications (future work)

Out of scope here. LINE *Login* (this doc) identifies users; LINE *push* needs a
separate **Messaging API channel** + the `line_accounts` binding (kept for
exactly this). See the future plan in
[`LINE_ACCOUNT_BINDING.md`](./LINE_ACCOUNT_BINDING.md).

---

## Risks / notes

- **Custom provider availability:** the exact Dashboard UI for custom OIDC
  providers varies by Supabase version. If your project lacks a custom-provider
  option, you may need to enable it via project config / the Management API. The
  app code (`custom:line`) is correct regardless; only the dashboard step changes.
- **Email-less users:** some older Supabase setups assume every user has an
  email. We intentionally don't request LINE email. If sign-up rejects null
  emails, allow anonymous/email-optional users for this provider.
- **Redirect allowlist:** if the app's `/auth/callback` origin isn't in
  Supabase's Redirect URLs, login completes at Supabase but won't return to the
  app — add every origin (localhost + production).

# LINE binding — no LIFF setup required

> **The LIFF-token binding flow was removed in v0.1.7.** BubanGo no longer uses
> the LIFF SDK, `liff.ts`, or the `POST /api/line/link` route, and no LIFF app /
> `NEXT_PUBLIC_LIFF_ID` is needed for notification binding. This file is kept only
> as a pointer — there is no manual LIFF setup to perform.

## Current reality

- **LINE Login is the primary auth flow** — a Supabase Custom OAuth provider
  (`custom:line`). See [`LINE_LOGIN_SETUP.md`](./LINE_LOGIN_SETUP.md) for the
  channel setup.
- **Notification binding uses the Supabase Auth LINE identity** — the server reads
  the verified LINE `sub` from the signed-in user's identity. No ID token is sent
  from the browser and no LIFF SDK runs.
- **Active binding endpoint:** `POST /api/line/link-from-auth` (no body).
- **Unbind endpoint:** `POST /api/line/unlink` (still active).
- **No LIFF SDK** is used in the active binding flow.
- The old LIFF-token flow — `liff.ts` and the `POST /api/line/link` route — has
  been **removed**.
- **Email/password users** (who did not sign in with LINE) see, when they try to
  bind: 請先使用 LINE 登入後再綁定通知。

See [`LINE_ACCOUNT_BINDING.md`](./LINE_ACCOUNT_BINDING.md) for the full binding
flow, the `line_accounts` table, API routes, UI states, and the future push plan.

> **Env vars:** `NEXT_PUBLIC_LIFF_ID` and `LINE_CHANNEL_ID` are no longer read by
> any code. They may still be listed in `.env.example` / your environment; they are
> inert for the current binding flow and only relevant if a future feature
> reintroduces them.

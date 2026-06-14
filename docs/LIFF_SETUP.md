# LIFF Setup — opening BubanGo inside LINE

This guide covers the **manual** LINE Developers configuration needed to run
BubanGo as a LIFF app (LINE Front-end Framework) and to verify LINE ID tokens
server-side for [account binding](./LINE_ACCOUNT_BINDING.md).

> **The app works without any of this.** When `NEXT_PUBLIC_LIFF_ID` is unset,
> BubanGo runs as a normal web app and the LINE binding card just shows an
> "open in LINE" state. Do this setup only when you want LINE binding to work.

---

## What you need to do manually (checklist)

These steps happen in the [LINE Developers Console](https://developers.line.biz/console/)
— Claude cannot do them for you, and **no secret should ever be pasted into chat
or committed.**

1. **Sign in** to the LINE Developers Console with your LINE account.
2. **Create a Provider** (or reuse one) — e.g. "BubanGo".
3. **Create a LINE Login channel** under that provider
   (Create a new channel → **LINE Login**). This is the channel that powers LIFF
   and issues the ID tokens we verify. *(Do not create a Messaging API channel
   yet — that's for push notifications, a later task.)*
   - Region/category: as appropriate for your org.
4. Open the channel → **Basic settings** tab → note the **Channel ID** (a
   numeric value). This becomes `LINE_CHANNEL_ID` (server env).
   - You do **not** need the Channel secret for this feature. Leave it alone.
5. Go to the **LIFF** tab → **Add** a LIFF app:
   - **LIFF app name:** e.g. "BubanGo".
   - **Size:** `Full` (recommended) or `Tall`.
   - **Endpoint URL:** your deployed HTTPS URL, e.g.
     `https://your-bubango-domain.com/` (must be HTTPS). You can point it at the
     site root; the binding card lives on `/worker/profile` and `/store/settings`.
   - **Scopes:** enable **`openid`** (required — without it there is no ID token)
     and **`profile`** (recommended — lets the verified token include the LINE
     display name / picture so the card can show "已綁定 LINE · 名稱").
   - **Bot link feature:** **Off** (no messaging in this task).
6. After creating it, copy the **LIFF ID** (looks like `1234567890-abcDEfgh`).
   This becomes `NEXT_PUBLIC_LIFF_ID`.
7. **Set the environment variables** (next section). Add them to `.env.local`
   locally and to your Vercel project's Environment Variables for production.
   **Never commit `.env.local`.**

That's it. There is **no Channel secret** and **no service_role key** involved.

---

## Environment variables

Add to `.env.local` (and Vercel). See [`.env.example`](../.env.example).

| Variable | Where | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_LIFF_ID` | client (public) | Initializes the LIFF SDK in the browser. Format `1234567890-abcDEfgh`. |
| `LINE_CHANNEL_ID` | server only | Numeric Channel ID of the **same** LINE Login channel. Used to verify the audience of LINE ID tokens. |

`NEXT_PUBLIC_LIFF_ID` and `LINE_CHANNEL_ID` must belong to the **same** LINE
Login channel — the ID token's audience (`aud`) is that channel's ID, and the
server rejects the token if it doesn't match `LINE_CHANNEL_ID`.

> 🔒 **Do NOT add `LINE_CHANNEL_SECRET`.** Server verification uses LINE's
> `https://api.line.me/oauth2/v2.1/verify` endpoint, which only needs the Channel
> ID. If a future feature (e.g. the Messaging API) needs the secret, add it to
> `.env.local` / Vercel **manually** — never to the repo, and never printed.

---

## Local development

- **Plain browser:** leave `NEXT_PUBLIC_LIFF_ID` blank and develop normally.
  Everything except the in-LINE binding works; the binding card shows the
  "open in LINE" state.
- **Testing inside LINE locally:** LIFF endpoints must be **HTTPS**. Use a tunnel
  (e.g. `cloudflared` / `ngrok`) and temporarily set the LIFF app's Endpoint URL
  to the tunnel URL (or keep a separate "dev" LIFF app so you don't disturb the
  production endpoint). Then open the LIFF URL `https://liff.line.me/<LIFF_ID>`
  from a LINE chat on your phone.

---

## How it fits together

```
LINE app  ──opens──▶  LIFF (NEXT_PUBLIC_LIFF_ID)  ──▶  BubanGo (Next.js)
                                                         │ liff.getIDToken()
                                                         ▼
                                   POST /api/line/link  { idToken }
                                                         │ verify with LINE
                                                         ▼  (LINE_CHANNEL_ID = aud)
                                   line_accounts (Supabase, RLS, anon key)
```

See [`LINE_ACCOUNT_BINDING.md`](./LINE_ACCOUNT_BINDING.md) for the binding flow,
database table, API routes, UI states, the Rich Menu layout, and the future push
plan.

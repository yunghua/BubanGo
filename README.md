# BubanGo

補班，就現在 — a mobile-first MVP that lets 飲料店 / 小吃店 post short shifts and
lets workers find and apply to nearby temporary work.

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind · Supabase
(Auth + Postgres + RLS).

## Current MVP status

The full closed loop works on Supabase: shop registers → publishes a shift →
worker registers → applies → shop accepts/rejects → shift matches/reopens. Built
on Supabase Auth, Row Level Security, route-protection middleware, an onboarding
fallback, and three atomic write RPCs (apply / accept / reject).

See **[`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md)** for the full status,
architecture, tables, RPCs/triggers, and known limitations.

## Setup

1. Install deps: `npm install`
2. Create `.env.local` from the template: copy `.env.example` and fill in your
   Supabase **project URL** and **anon (public)** key:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   NEXT_PUBLIC_DATA_BACKEND=supabase   # or "local" for the offline dev fallback
   ```
   > ⚠️ **Never commit `.env.local`** (it is gitignored) and **never use the
   > service_role key** — the app only needs the anon key; RLS protects the data.
   > Use the project **root** URL, not the `/rest/v1` endpoint.
3. Apply the database SQL in the Supabase SQL Editor, in order:
   `supabase/schema.sql` → `supabase/migrations/0001…0006`. See
   [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md) §2.

## Development commands

```bash
npm run dev      # start the dev server (http://localhost:3000)
npm run build    # production build (also type-checks + lints)
npm run lint     # ESLint
npm start        # serve the production build
```

### Checks & tests (anon key only — no service_role, no secrets printed)

```bash
node scripts/release-check.mjs       # safe pre-tag readiness check
node scripts/check-supabase.mjs      # the 5 tables exist
node scripts/check-duplicates.mjs    # no duplicate shop/worker rows
node scripts/e2e-flow.mjs            # full closed-loop e2e (Email Confirmation OFF)
node scripts/e2e-flow.mjs --unique   # + unique-constraint checks
```

The e2e scripts create throwaway `bubango.test*` / `bubango.dupcheck*` users —
delete them in Supabase → Authentication → Users (cascades). See
[`docs/TESTING.md`](docs/TESTING.md).

## Docs

- [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) — MVP status & architecture
- [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md) — pre-commit/tag checklist
- [`docs/TESTING.md`](docs/TESTING.md) — how to run checks + manual QA
- [`docs/EMAIL_CONFIRMATION_QA.md`](docs/EMAIL_CONFIRMATION_QA.md) — confirmation on/off QA
- [`docs/SUPABASE_SCHEMA.md`](docs/SUPABASE_SCHEMA.md) · [`docs/DATA_LAYER.md`](docs/DATA_LAYER.md) · [`docs/MVP_SPEC.md`](docs/MVP_SPEC.md)

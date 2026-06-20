# Deploying Forkcast to Vercel

The app is on **Neon Postgres** (schema applied, recipes seeded) with Stripe **test** keys.
Everything below is what's left to get it live. Integrations degrade gracefully — you can
ship with the "required" set and add the rest later (each lights up when its key appears).

## 1. Push the code to a Git repo
Vercel deploys from Git. Create a GitHub repo and push this project (the repo isn't
initialized yet). `.env` is gitignored — secrets are set in Vercel, not committed.

## 2. Import the project in Vercel
- vercel.com → Add New → Project → import the repo.
- Framework preset: **Next.js** (auto-detected). Build command and output are default.
- `prisma generate` runs automatically via the `postinstall` script.

## 3. Set environment variables (Vercel → Settings → Environment Variables)

### Required for a working deploy
| Var | Value |
|---|---|
| `DATABASE_URL` | Neon **pooled** string (the `-pooler` host) — already in local `.env` |
| `DIRECT_URL` | Neon **direct** string (pooler host minus `-pooler`) — already in local `.env` |
| `AUTH_SECRET` | the 64-hex secret in local `.env` |
| `AUTH_URL` | your deploy URL, e.g. `https://forkcast.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | same deploy URL |
| `STRIPE_SECRET_KEY` | `sk_test_…` (in local `.env`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` (in local `.env`) |
| `STRIPE_PRICE_PRO_MONTHLY` | `price_1TkFhX4lf6EcgwpsyRSFol3a` |

> `AUTH_URL` / `NEXT_PUBLIC_APP_URL` need the real URL, which Vercel only gives you after
> the first deploy. Deploy once, copy the URL, set these two, then redeploy.

### Add after the first deploy
| Var | How |
|---|---|
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → add endpoint `https://<your-url>/api/stripe/webhook` (events: `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_failed`) → copy the `whsec_…` |
| `CRON_SECRET` | generate (`openssl rand -hex 32`); set the same value here — Vercel sends it as the Bearer token to the weekly cron. Until set, the cron endpoint is unauthenticated. |

### Optional (features stay off until present)
| Var | Unlocks |
|---|---|
| `RESEND_API_KEY` + `EMAIL_FROM` | real login + transactional + weekly emails |
| `GOOGLE_MAPS_API_KEY` | address geocoding for cheapest-store |
| `KROGER_CLIENT_ID` / `KROGER_CLIENT_SECRET` | real grocery prices (else modeled estimates) |
| `NEXT_PUBLIC_POSTHOG_KEY` / `_HOST` | product analytics |
| `SENTRY_DSN` | error tracking |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | distributed rate limiting (else in-memory) |

## 4. Deploy
First deploy → copy the `*.vercel.app` URL → set `AUTH_URL` + `NEXT_PUBLIC_APP_URL` →
create the Stripe webhook with that URL → set `STRIPE_WEBHOOK_SECRET` → redeploy.

## 5. Smoke-test live
- Sign in (dev login is disabled in prod unless `AUTH_DEV_LOGIN=1`; use Google/Resend, so set one up — or set `AUTH_DEV_LOGIN=1` temporarily).
- Generate a plan, open the grocery list + prep.
- Upgrade with Stripe **test card** `4242 4242 4242 4242` → confirm the webhook flips you to Pro and Swap / history unlock.

## Cron schedule
`vercel.json` runs `/api/cron/weekly` Sundays 16:00 UTC. Adjust the cron expression there.

## Notes
- DB schema changes: edit `prisma/schema.prisma`, then `npx prisma db push` (we use db-push,
  not migrations; old SQLite migrations are archived in `prisma/migrations.sqlite.bak`).
- Going to **live** Stripe later: swap `sk_test_`/`pk_test_` for `sk_live_`/`pk_live_`, create
  the product/price in live mode, and add a **live-mode** webhook (its own `whsec_`).

# Brief — stripe-live-products

## One-line goal

Mint Stripe **live-mode** products and recurring prices matching the
existing test-mode set, set the four `STRIPE_*` env vars on the Vercel
production target only, and verify the routes still respond. **No
customer is charged.** This is structural plumbing for the next slice
(re-enable Pro/Team UI) — not a launch.

## Repo

`agentlint/agentlint.sh` (web repo) — `~/Code/agentlint-sh`.

## Definition of done

A reviewer can verify:

1. Two Stripe **live-mode** products exist: `agentlint Pro` and
   `agentlint Team`.
2. Two recurring prices exist: Pro $19/mo, Team $99/mo, billing
   monthly, currency USD, in live mode.
3. Live-mode webhook endpoint registered at
   `https://agentlint.sh/api/stripe/webhook`. Secret regenerated.
4. Four Vercel env vars updated on **production target only**:
   `STRIPE_SECRET_KEY` (live), `STRIPE_WEBHOOK_SECRET` (live),
   `STRIPE_PRICE_PRO` (live), `STRIPE_PRICE_TEAM` (live). The test-mode
   values **remain** in the `preview` and `development` targets so
   E2E + agent flows keep working.
5. Production deploy succeeds; `/api/stripe/checkout` still returns
   401 unauthenticated (route alive, gate intact). The pricing page
   itself stays disabled per ADR-0012 — that's the next slice.
6. ADR-00XX appended documenting the env split and how to roll back
   (paste the test-mode keys back on the production target).

## In scope

- `stripe` CLI or `curl` against the Stripe REST API to create the
  products + prices in live mode.
- `vercel env add` (or `vercel env pull && vercel env push`) for the
  four env vars, **production target only**.
- One verification smoke: `curl -s -o /dev/null -w "%{http_code}"
  https://agentlint.sh/api/stripe/checkout -X POST` should be 401.

## Out of scope

- Charging a real customer. The UI remains disabled by ADR-0012; this
  slice does not flip that flag.
- Reaching out to anyone about the launch. Charter §3.2.

## Charter check

- §3.2: "Spending money: domains, SaaS subscriptions, ads, infra beyond
  a free tier." This slice spends $0. Stripe live mode is free to set
  up; charges happen later and are gated by the maintainer's explicit
  re-enable.
- §3.2: "Changing pricing, the license, or anything in the public
  commercial positioning of the project." This slice does **not**
  change public pricing — the UI is still off. It pre-stages the
  config so the next slice can flip the UI in one commit.

## Open decisions you may resolve

- Recreate webhook secret or reuse test-mode secret? **RESOLVED:**
  always regenerate. Mixing test and live is a foot-gun.
- Annual prices in this slice? **RESOLVED:** no, monthly only.
  Annual is P2.

## Notes for the agent

- The Stripe API key for product creation is the **live restricted key**
  with `Products: write` + `Prices: write` + `Webhook Endpoints: write`.
  If only the unrestricted live key is available, use it for the API
  calls and rotate immediately after — log the rotation step explicitly
  in the closing summary.
- The user has full live-mode access via Stripe dashboard; the agent
  can use API or call `stripe` CLI. Don't ask for confirmation per
  product — just ship.
- Vercel env writes go to **production target only**. Double-check the
  `--target production` flag on every `vercel env add` call.

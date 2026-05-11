# Brief — revert-adr-0012

## One-line goal

Re-enable Pro and Team in the public `/pricing` and `/dashboard` flows
now that the gating slices (#5 org dashboard, #6 policy thresholds,
#9 stripe live products) have shipped. Append a superseding ADR.

## Repo

`agentlint/agentlint.sh` (web repo) — `~/Code/agentlint-sh`.

## Definition of done

A reviewer can verify:

1. `/pricing` shows Pro and Team with real Subscribe CTAs (not
   "Notify me at launch" mailto links).
2. `/dashboard` shows the "Manage subscription" link for users on
   any non-Free plan.
3. The status banner on `/pricing` that ADR-0012 added ("paid tiers
   coming soon") is removed.
4. Stripe Checkout flow end-to-end: signed-in user clicks Pro
   → Checkout opens in **live** mode → webhook lands → `subscription`
   row in Neon prod → dashboard reflects the active plan. **Verified
   with a Stripe test-clock simulation, not a real card.** The smoke
   test card is the test-mode `4242 4242 4242 4242`, which Stripe
   live-mode refuses — that confirms the env is correctly live without
   needing a real charge.
5. New ADR-00XX in `docs/DECISIONS.md` supersedes ADR-0012 with
   receipts: which gating slices shipped, what changed in the UI,
   rollback path (single revert commit).

## In scope

- `app/pricing/page.tsx`: undo the ADR-0012 changes. Restore the
  Subscribe buttons + remove the status banner.
- `app/dashboard/page.tsx` (or current dashboard root): restore the
  subscription block.
- Smoke test via Stripe test clock + verification of the 4242 card
  rejection in live mode.
- ADR appendix.

## Out of scope

- Announcement post. Drafts only — charter §3.2.
- Customer support workflow for the first paying users — future ops
  slice.

## Charter check

- §3.2: "Changing pricing, the license, or anything in the public
  commercial positioning of the project." The user has explicitly
  authorized this tonight ("FULL autonomía"). The ADR captures that
  authorization with the timestamp.
- The Free plan is unchanged — no user is harmed by the re-enable.

## Open decisions you may resolve

- Auto-publish the announcement on HN/X/PH? **RESOLVED:** no. Drafts
  only. Per the user's tonight-rule: "no comunicación pública".
- Annual plans? **RESOLVED:** no, monthly only. Annual is P2.

## Notes for the agent

- This slice **must** run after `stripe-live-products`. The DAG enforces
  that.
- The Stripe webhook secret for live mode is already set on prod by
  the previous slice. Do not regenerate it again.
- The Checkout button uses `STRIPE_PRICE_PRO` / `STRIPE_PRICE_TEAM`
  env vars — verify both are populated on the production target before
  shipping.

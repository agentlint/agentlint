# Brief — org-dashboard-team

## One-line goal

Org-level dashboard that lists every project in the org with the latest
score, gated by Team subscription. Slice 8 from `PROJECT_STATE.md`.

## Repo

`agentlint/agentlint.sh` (web repo) — `~/Code/agentlint-sh`.

## Definition of done

A reviewer can verify:

1. `/dashboard/orgs/[slug]` already shows a project list (per ADR-0028).
   This slice **adds** a new `/dashboard/orgs/[slug]/projects-overview`
   route (or upgrades the existing one — agent picks one) that renders:
   - One row per project with: name, default branch, latest score,
     7d delta chip, top failing rule, scan source (local / ci / server),
     scan age.
   - Sort: by score asc (worst first) by default; `?sort=score&dir=desc`
     supported.
   - Filter by source via query string.
2. Page is gated: free + pro plans see a "Team feature" upsell card
   instead of the rows. Team plan members see the rows. Org owners
   always see the rows (so onboarding works during the trial).
3. New `lib/billing/plan-gate.ts` server helper returns
   `{ plan: "free" | "pro" | "team", canSeeOrgOverview: boolean }`.
4. 12+ tests across page, gate, and route.

## In scope

- New page route + the project-aggregation query (one query, no N+1).
- `lib/billing/plan-gate.ts` reading `subscription` table joined to org.
- Upsell card component for free/pro.
- Optional: CSV export link (`?format=csv`) for Team users. Stretch goal.

## Out of scope

- Editing per-project settings from this overview — that's still the
  per-project page.
- Webhook subscriptions / alerts on score drops. Future slice.

## Charter check

- §4 "Public scoring API sacred": this surfaces scores, doesn't compute
  them, so untouched.
- No CLI change.

## Open decisions you may resolve

- What's "latest score"? **RESOLVED:** the most recent run on the
  project's default branch from any source.
- Empty projects (zero runs) — show or hide? **RESOLVED:** show with
  an em-dash and "No scans yet" copy + a link to the per-project page
  where the user can run a scan.
- 7d delta calc when fewer than 2 runs exist in the window?
  **RESOLVED:** show em-dash, no chip.

## Notes for the agent

- The plan-gate helper is the load-bearing primitive — also used by
  the next slice (`policy-thresholds-team`). Write it carefully.
- Owners always pass the gate so org onboarding (no subscription yet)
  isn't broken.

# Brief — run-public-toggle

## One-line goal

Dashboard UI + API to flip an existing run public/private after the fact.
Currently the only way to publish a run is the CLI `--public` flag at push
time (slice 6 carry-over).

## Repo

`agentlint/agentlint.sh` (web repo) — `~/Code/agentlint-sh`.

## Definition of done

A reviewer can verify:

1. `POST /api/runs/:id/public` and `DELETE /api/runs/:id/public` exist.
   Session-cookie auth gated by org-admin role on the run's project's org.
   Both return `{ runId, public }` on success.
2. Run detail page (`/dashboard/orgs/[slug]/projects/[projectId]/runs/[runId]`)
   has a toggle: "Make public — your badge will show this score" /
   "Make private". Toggle calls the route; page refreshes.
3. The badge endpoint (`/badge/:owner/:name.svg`) continues to surface
   the latest **public** run — no change there, just confirm.
4. 8+ tests: route happy-path POST + DELETE, 401 unauthenticated,
   403 non-admin, 404 on missing run, idempotent re-toggle, page render
   for both states.

## In scope

- `app/api/runs/[id]/public/route.ts` with `POST` + `DELETE` handlers.
- `components/run-public-toggle.tsx` client component.
- Existing run detail page reads `run.public` and renders the toggle.
- Rate limit: 10/min per session (low-cardinality action).

## Out of scope

- Bulk toggle ("make all runs in this project public"). UI is per-run.
- Server-side cache invalidation for the badge — the badge endpoint
  already SWRs at 1h; that's acceptable lag.

## Charter check

- No CLI change.
- No scoring change.
- Local-first invariant: this is a dashboard-only action; CLI is untouched.

## Open decisions you may resolve

- Should `DELETE` flip back to private or error if already private?
  **RESOLVED:** idempotent. Re-DELETE on a private run returns 200 with
  the current state. Same for re-POST on a public run.
- Audit log? **RESOLVED:** out of scope for tonight. The run row's
  `updatedAt` is enough for now.

## Notes for the agent

- The run already has a `public boolean` column from slice 6. No schema
  change needed.
- Keep the toggle copy short and explicit — users should understand the
  badge implication.

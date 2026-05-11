# Brief — failed-scans-log

## One-line goal

Replace the `report_json = { version: "server-failed", error }` shoehorn
(ADR-0030) with a first-class `scan_failure` table + a "Why did this fail?"
panel on the run detail page.

## Repo

`agentlint/agentlint.sh` (web repo) — `~/Code/agentlint-sh`.

## Definition of done

A reviewer can verify:

1. New `scan_failure` table on Neon **dev** branch (drizzle-kit push).
2. `lib/server-scan/runner.ts` writes a row to `scan_failure` (FK to
   `run.id`) on every caught exception, with fields `reason` (enum:
   `clone_failed`, `tar_extract_failed`, `scan_threw`, `timeout`,
   `size_cap_exceeded`, `unknown`), `details` (text), `created_at`.
3. Run detail page renders a red "Scan failed" panel reading from
   `scan_failure` instead of `run.report_json`. Server-failed runs still
   appear in the runs list with a red `SourcePill`-style chip.
4. New admin route `GET /dashboard/admin/scan-failures` (org-owner only)
   lists recent failures with reason + project + commit_sha + a "retry
   scan" button that POSTs to the existing `/api/projects/:id/scan-now`.
5. 10+ new tests across runner, route, and component.

## In scope

- `db/schema.ts`: new `scan_failure` table.
- `db/migrations/*_scan_failure.sql`: forward migration. `drizzle-kit push`
  applied to **dev** Neon branch by the agent; **prod** deferred to
  maintainer (same posture as slice 4, slice 7).
- `lib/server-scan/runner.ts`: write to `scan_failure` on catch; keep the
  `report_json` write for backwards-compatibility but mark it deprecated
  in a code comment.
- `app/dashboard/orgs/[slug]/projects/[projectId]/runs/[runId]/page.tsx`:
  read `scan_failure` joined to the run; render the panel.
- New `app/dashboard/admin/scan-failures/page.tsx` (server component) +
  `RetryScanButton` client component.
- New `app/api/admin/scan-failures/route.ts` `GET` route for the JSON
  feed, gated by org-owner role on the requester's primary org.

## Out of scope

- Migrating historical `report_json.version === "server-failed"` rows into
  `scan_failure`. The shoehorn stays for backfill; new failures land in
  the new table.
- Email/Slack alerts on failure — that's a future ops slice.

## Charter check

- No CLI surface change.
- Public scoring API untouched (the failed runs don't contribute to a score).
- Rules-never-throw contract is about CLI rules; the server worker is
  exempt and that's fine.

## Open decisions you may resolve

- Index on `(project_id, created_at desc)` for the admin list?
  **RESOLVED:** yes, plus a composite `(reason, created_at desc)` for
  drilldowns.
- One table or two (failures vs. retries)? **RESOLVED:** one; add a
  `retry_count` column with default 0.

## Notes for the agent

- The `RetryScanButton` does **not** need its own API — just POSTs to the
  existing `/api/projects/:id/scan-now` with the project id from the row.
- The admin route checks `org.role === 'owner'` and 404s otherwise (no
  enumeration via 401 vs 404 leakage).

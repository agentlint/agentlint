# PRD — dashboard UX overhaul

**Status:** approved by the autonomous pipeline (2026-05-10).
**Repo split:** web (`agentlint-sh`) only. **No CLI work.**
**Slug:** `dashboard-ux-overhaul`.

## Problem

The dashboard ships the right data but the navigation, signed-in state,
and per-run drill-down are all broken or missing:

1. **No global navigation.** Once you land on a project page there is no
   header that lets you jump back to org, dashboard home, account, or
   another project. Browser back-button only.
2. **Signed-in state on landing/login is broken.** The marketing header
   always renders "Sign in" — even when the user has an active session.
   Clicking "Sign in" while already signed in sends them to the login
   page (annoying loop) instead of `/dashboard`.
3. **No "Run scan now" anywhere.** A user wants to verify a fix before
   their next push lands; today they can't.
4. **No first-run scan when a project is created.** The dashboard sits
   empty until someone pushes a commit. Users assume something is broken.
5. **Runs list is a flat dump.** No filter by branch / source. No sort
   beyond the implicit `createdAt desc`.
6. **Clicking a run does nothing.** The full per-rule report
   (`run.report_json`) is stored in DB but invisible from the dashboard.
7. **No per-project charts.** The 4 org-level cards (from
   `dashboard-ux-cli-autoconnect`) live on the org page, but the
   project page has no history visualization.

This slice fixes all seven in one PR. None of them require a schema
change — the data is already there.

## Non-goals

- **Real-time updates.** Manual refresh is enough.
- **Run comparison view** ("show me run X vs run Y").
- **Custom rule display.** The report renders the rules and their
  results, not user-configured views.
- **Org-level dashboard rollups.** Tracked as item 8 in
  `PROJECT_STATE.md`.
- **Saved filters.** Filters live in the query string; bookmark to save.
- **WebSockets / push notifications.** Polling is out of scope.
- **Charts library deps.** All charts are server-rendered SVG, hand-rolled
  the same way the existing sparkline was (per
  `lib/dashboard/trend.ts`).

## Success metric

A new signed-in user, on a freshly-created project, can within 30
seconds:

1. Click a "Run scan now" button on the project page → see a new row
   appear within 5s with `source = "server"`.
2. Click that row → land on a run detail page that lists every rule,
   color-coded by pass/fail/warning/skipped.
3. Apply a filter `?branch=main&source=server` and see only those rows.
4. Switch from project page to org dashboard via the global nav in one
   click — no browser back.

And: a returning signed-in user who lands on `https://agentlint.sh`
sees an "Open dashboard" CTA in the header, not "Sign in."

Measured manually on prod after the slice ships: walk through the four
clicks above with a stopwatch and capture screenshots in the
close-out summary.

## Schema diff

**No schema changes.** All required data lives in existing tables:

- `run.report_json` JSONB — full rule-by-rule data
- `run.branch`, `run.source`, `run.commit_sha` — already populated
- `project.prod_branch`, `project.repo_owner`, `project.repo_name`,
  `project.installation_id` — already populated

## API surface

### `POST /api/projects/:id/scan-now` (NEW)

**Auth:** session (org admin OR org member who owns the project).

**Request body:** `{}` (project context derives everything).

**Response 202**

```json
{
  "runId": "01HXX…",
  "status": "queued"
}
```

**Errors**

| Status | Body | Meaning |
|---|---|---|
| `401` | `{ "error": "unauthorized" }` | No session. |
| `403` | `{ "error": "not_org_member" }` | Session user not a member of the project's org. |
| `404` | `{ "error": "project_not_found" }` | Project doesn't exist or auth context can't see it. |
| `409` | `{ "error": "app_not_installed", "install_url": "…" }` | No `installation` row for the project's org. Can't clone. |
| `429` | `{ "error": "rate_limited" }` | More than 5 manual triggers per minute on this project. |

**Behavior:** server schedules the same `runServerScan` worker that
the push webhook uses, against the project's `prodBranch` HEAD (we
fetch the SHA via the GitHub Refs API). Returns 202 immediately;
the worker fires via `after()` and the row lands later.

### Project create — auto-scan extension

`POST /api/projects/route.ts` (existing) — after the new project row
is committed, if `installationId` is non-null, schedule a server-scan
of the project's `prodBranch`. Fire-and-forget. The dashboard's
project page will eventually render the first row without the user
needing to push.

### `GET /api/projects/:id/runs?branch=&source=&from=&to=&sort=&limit=&offset=` (NEW)

**Auth:** session (org member).

**Query params (all optional, all zod-validated):**

| Param | Type | Default | Notes |
|---|---|---|---|
| `branch` | string | — | exact match on `run.branch` |
| `source` | `"local" \| "ci" \| "server"` | — | exact match |
| `from` | ISO date | — | `run.created_at >= from` |
| `to` | ISO date | — | `run.created_at <= to` |
| `sort` | `"createdAt:desc" \| "createdAt:asc" \| "score:desc" \| "score:asc"` | `"createdAt:desc"` | |
| `limit` | int 1..200 | 50 | |
| `offset` | int 0..10000 | 0 | |

**Response 200**

```json
{
  "rows":   [ { "id":"…", "branch":"main", "source":"server", "score":92, "passes":21, "fails":3, "warnings":0, "skipped":6, "commitSha":"…", "createdAt":"…" }, … ],
  "total":  127,
  "limit":  50,
  "offset": 0
}
```

Rate limit 60/min/session.

## CLI surface

**No CLI change.** UX overhaul lives entirely on the web side.

## UI surface

### New global nav (`components/dashboard-nav.tsx`)

Sticky header on every `/dashboard/*` page. Renders:

- Left: agentlint logo → `/dashboard`
- Breadcrumbs: `org-slug / project-name` (derived from URL params via
  `useParams` in a server component) — each breadcrumb link goes to
  that level
- Right: org switcher (dropdown of user's orgs, if >1) + account menu
  (avatar → email, "Sign out")

Wire-in via `app/dashboard/layout.tsx` (existing — extend) so every
nested page inherits the nav.

### Signed-in detection (`components/site-header.tsx`)

Convert to a server component that reads the session via
`auth.api.getSession({ headers: await headers() })`. If session →
render "Open dashboard" CTA (links to `/dashboard`). Otherwise render
"Sign in" (links to `/login`).

### Login page (`app/login/page.tsx`)

Server component. If session exists → `redirect("/dashboard")`. No
login-loop for already-signed-in users.

### Project page — extended

`app/dashboard/orgs/[slug]/projects/[projectId]/page.tsx`:

1. **"Run scan now" button** — top right of the page header. POSTs to
   `/api/projects/:id/scan-now`. On 202 → toast "Scan queued — refresh
   in a few seconds." On 409 → toast with install-App CTA. On 429 →
   toast "Slow down — retry in a minute."

2. **Score-over-time chart** — `score-chart.tsx`. Server-rendered SVG
   line chart of the last 30 days of runs (default branch, source =
   any), 220x60. Same scaling logic as `lib/dashboard/trend.ts`
   sparkline but with date axis labels at the start and end.

3. **Top-failing-rules chart** — `top-failing-rules.tsx`. Server-
   rendered SVG horizontal bar chart of the 5 most-failing rule IDs
   over the last 30 days. Each bar shows the rule ID + fail count.

4. **Runs filter form** — `runs-filters.tsx`. Renders chips for
   `branch` (text input), `source` (select), `from/to` (date inputs),
   `sort` (select). Form submits via GET to the same project page;
   query params drive the list-fetch in the server component.

### New run detail page

`/dashboard/orgs/[slug]/projects/[projectId]/runs/[runId]/page.tsx`:

- Server component. Loads the `run` row + parses `report_json`.
- Header: score badge, commit SHA (linked to GitHub), branch, source
  pill, timestamp.
- Per-category section (Discoverability, Buildability, Convention
  clarity, Documentation surface, Safety & guardrails): bar with score
  / max, then a sortable table of rules in that category:
  - Rule ID
  - Title
  - Status (pass / fail / warning / skipped) with color
  - Weight
  - Message (collapsed by default, expand with `<details>` element)
- Sticky "Back to project" link in the header.

404 page if `runId` doesn't belong to the calling user's project /
org.

## Security

- **Manual scan-now:** session-only. Rate-limit 5/min/project to
  prevent compute spam.
- **Auto-scan on project create:** server uses the existing
  installation token; same security posture as the push webhook.
- **Runs list filter:** zod validation; invalid params → 400 with
  `details`. Query is parameterized via Drizzle (no SQL injection
  vector).
- **Run detail page:** loaded server-side; the route validates that
  the run belongs to a project the calling session can see.
- **Account menu Sign-out:** uses the existing Better-Auth sign-out
  helper.
- **No new external deps.** Charts are hand-rolled SVG (`<svg>`
  primitives). No `recharts`, `d3`, etc.

## Rollback

Single revert commit on the merge SHA. No schema migration. The CLI
is untouched. Feature flag: not added — every change is additive,
client-side users can always navigate without the new nav (they just
won't see it).

## Open questions

All resolved by the pipeline.

- **RESOLVED:** server-rendered SVG charts (no library) — matches
  existing `lib/dashboard/trend.ts` pattern and keeps the dashboard
  bundle thin.
- **RESOLVED:** `?branch=` is exact match, not regex. Users learn the
  default branch name from the dashboard anyway; regex is overkill.
- **RESOLVED:** auto-scan on project create uses the same worker; no
  separate code path. If the App isn't installed at create time, the
  schedule is a no-op and the row stays empty until the user installs
  + pushes (existing behavior).
- **RESOLVED:** account menu shows only the user's email + Sign out
  in this slice. No "Settings" page yet — tracked for a future slice.

## Issues (vertical, one PR)

Six issues land on a single branch `feat/dashboard-ux-overhaul`. The
single sub-agent commits per issue. They share enough files (the
project page especially) that worktree-splitting would create more
merge work than it saves.

### Issue 1 — `feat(web): site-header detects session + login redirect`

**Files:**
- `components/site-header.tsx` — convert to server component; read
  session; render "Open dashboard" or "Sign in" accordingly.
- `app/login/page.tsx` — if session → redirect to `/dashboard`.
- Tests: a render test for both states.

**DoD:** anonymous user sees "Sign in" on `/`. Signed-in user sees
"Open dashboard" on `/`. Signed-in user visiting `/login` is
redirected to `/dashboard`.

### Issue 2 — `feat(web): dashboard global nav + breadcrumbs`

**Files:**
- `components/dashboard-nav.tsx` — sticky header with logo,
  breadcrumbs, org switcher, account menu.
- `app/dashboard/layout.tsx` — extend (or create if missing) to
  include `<DashboardNav />`.
- Tests: render with 1 org, render with >1 orgs, render breadcrumbs
  with vs without project params.

**DoD:** every `/dashboard/*` page renders the nav. Clicking
breadcrumbs navigates to the corresponding level.

### Issue 3 — `feat(api): manual /scan-now route + auto-scan on project create`

**Files:**
- `app/api/projects/[id]/scan-now/route.ts` — new POST handler.
  Validates session + org membership; rate-limits 5/min/project;
  fetches default-branch HEAD via GitHub Refs API; schedules
  `runServerScan` via `after()`. Inserts the resulting run row in
  the worker.
- `app/api/projects/route.ts` — after `INSERT`, if `installationId`
  set, schedule the same worker for the project's `prodBranch`.
- `tests/projects-scan-now.test.ts` — ≥8 cases.
- `tests/projects-create-autoscan.test.ts` — ≥3 cases.

**DoD:** POST to the route with a session → 202 + `runId`; row lands
within ~5s (mocked in tests via the same `scheduleFn` injection).
Project create with installationId fires the worker.

### Issue 4 — `feat(api): runs list filters + sort`

**Files:**
- `app/api/projects/[id]/runs/route.ts` — new GET handler. Zod
  schema validates the query params; Drizzle query builds with
  conditional `where` clauses.
- `tests/projects-runs-list.test.ts` — ≥10 cases (each filter
  individually, combinations, invalid params, sort variants).

**DoD:** all five filter params work; sort works; default behavior
matches today's project page; invalid query → 400 with zod error.

### Issue 5 — `feat(web): run detail page renders report JSON`

**Files:**
- `app/dashboard/orgs/[slug]/projects/[projectId]/runs/[runId]/page.tsx`
  — server component. Loads run, validates ownership, renders.
- `app/dashboard/orgs/[slug]/projects/[projectId]/runs/[runId]/run-report.tsx`
  — pure-render presentational component that walks the
  `report_json` and produces the per-category sections.
- `tests/run-detail.test.tsx` — render with a fixture report,
  collapse/expand toggles, 404 when run doesn't belong to org.

**DoD:** click any row → land on the detail page → see every rule
with its status. 404 path works for foreign runs.

### Issue 6 — `feat(web): project page — manual-trigger button + charts + filters`

**Files:**
- `app/dashboard/orgs/[slug]/projects/[projectId]/page.tsx` — wire
  the new components in. Read query params for the runs list
  (delegate to the new `/api/projects/:id/runs` endpoint via direct
  Drizzle query — server component, no fetch needed). Render the
  `<RunScanNowButton />`, `<ScoreChart />`, `<TopFailingRules />`,
  `<RunsFilters />` above the runs table. Each runs-table row links
  to `/runs/<runId>`.
- `app/dashboard/orgs/[slug]/projects/[projectId]/run-scan-now-button.tsx`
  — client component. POSTs to `/api/projects/:id/scan-now` and
  router.refresh() on success.
- `app/dashboard/orgs/[slug]/projects/[projectId]/score-chart.tsx`
  — server-rendered SVG line chart.
- `app/dashboard/orgs/[slug]/projects/[projectId]/top-failing-rules.tsx`
  — server-rendered SVG bar chart.
- `app/dashboard/orgs/[slug]/projects/[projectId]/runs-filters.tsx`
  — GET-form filter UI.
- Tests for the chart components (snapshot shape) and the
  filter-form rendering with seeded params.

**DoD:** project page has all four new surfaces; runs-table rows
link to detail pages; filters round-trip through URL query string;
manual-trigger toast appears.

---

## Dispatch plan

One web sub-agent on `feat/dashboard-ux-overhaul` from `dev`. Commits
in order 1 → 2 → 3 → 4 → 5 → 6. PR into `dev`. Single PR with six
commits is acceptable for this slice — all surfaces are interlinked
and shipping them piecewise would leave dead links between commits.

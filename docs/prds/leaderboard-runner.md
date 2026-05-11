# PRD — leaderboard-runner

## Problem

The four pipeline functions (`fetchTopRepos`, `scanRepo`, `aggregate`,
`renderJson` / `renderTable`) exist and are tested in isolation, but nothing
wires them together. There is no bin entry, no scheduled job, and the public
`/leaderboard` page on `agentlint.sh` is a "coming soon" placeholder. Result:
the leaderboard story cannot be told publicly and the launch is blocked.

## Non-goals

- Pagination, sorting, or filtering on the public page (top 100 fits one page).
- Caching the JSON in a database or warehouse — the GitHub-committed file is
  the source of truth.
- Per-repo report drilldowns. The row links to the GitHub repo; we do not
  publish full report JSON yet.
- Blog post / HN / X launch — charter §3.2 forbids tonight; we draft only.
- Daily or sub-weekly cadence — wasteful given the score velocity.
- Replacing the existing four pipeline functions or their 19 passing tests.

## Success metric

A reviewer can `pnpm --filter @agentlinthq/leaderboard run start` with a
`GITHUB_TOKEN` set, see `tools/leaderboard/data/aggregated/<YYYY-MM-DD>.json`
and `tools/leaderboard/out/leaderboard.html` written, and on
`https://agentlint.sh/leaderboard` see a table of at least 100 ranked repos
with rank/repo-link/stars/score/top-fail/scanned-at.

## Schema diff

No schema change. The aggregated JSON file is committed to the public CLI
repo and consumed by the web app via raw GitHub URL.

## API surface

No new API routes. The web page is a Next.js Server Component that
`fetch`es the raw GitHub URL of the latest aggregated JSON file and renders
the table. `export const revalidate = 86400` (one day).

Data fetched:

```
https://raw.githubusercontent.com/agentlint/agentlint/main/tools/leaderboard/data/aggregated/latest.json
```

The runner writes both `<YYYY-MM-DD>.json` and a `latest.json` symlink-or-
copy so the web app does not need to guess the most recent date.

Aggregated JSON shape (unchanged from existing `renderJson`):

```json
{
  "generatedAt": "2026-05-11T06:01:23.000Z",
  "cliVersion": "1.0.x",
  "rows": [
    { "rank": 1, "owner": "facebook", "repo": "react", "stars": 230000,
      "language": "JavaScript", "score": 91, "passes": 22, "fails": 1,
      "skips": 0, "error": null }
  ]
}
```

## CLI surface

No change to `@agentlinthq/cli`. The runner uses `@agentlinthq/cli` via the
existing `scanRepo` (which already shells out to a CLI binary).

`@agentlinthq/leaderboard` (private workspace, never published) gets:

- `bin` field: `"leaderboard-run": "./dist/run.js"` (cosmetic; primary
  entrypoint is `pnpm --filter @agentlinthq/leaderboard run start`).
- `scripts.start`: `"node dist/run.js"`
- Env consumed:
  - `GITHUB_TOKEN` — required.
  - `LEADERBOARD_LIMIT` — optional, default `100`. Tests pass `5`.
  - `LEADERBOARD_OUTDIR` — optional, default `tools/leaderboard/data/aggregated`.
  - `LEADERBOARD_HTMLDIR` — optional, default `tools/leaderboard/out`.
  - `AGENTLINT_CLI_PATH` — optional, default
    `packages/cli/dist/index.js`. Tests inject a fake.
- Exit codes:
  - `0` — at least one successful scan, JSON written.
  - `1` — fetchTopRepos failed, or zero successful scans, or write failed.

## UI surface

Two routes on `agentlint.sh`:

1. `/leaderboard` — rewritten from placeholder. Server component. Fetches
   the aggregated JSON, renders the methodology blurb collapsed at the top
   ("How we score this →" link to `/leaderboard/methodology`), then the
   table. Columns: Rank, Repo (link), Stars, Score, Top failing rule,
   Scanned at. Empty state: friendly "First scan runs Monday 06:00 UTC."
   Error state: same empty state with a quiet note (no console.error).
2. `/leaderboard/methodology` — moves the existing methodology + anti-
   gaming clauses from the placeholder into its own route. Static.

No client JS; both pages are pure server components.

## Security

- Runner reads `GITHUB_TOKEN` from env. Token is **read-only** in the
  Action (`permissions: contents: write` only for the commit step;
  GitHub search needs no special scope on a fine-grained PAT). Tests
  never make real network calls.
- The aggregated JSON contains only public data (owner/repo names, star
  counts, score). No PII.
- The web page fetches a public URL; no credentials.
- Anti-abuse: the runner cleans up cloned repos (`cleanup: true` already
  default in `scanRepo`) and uses `--depth=1`. Per-repo timeouts already
  enforced (`scanRepo` defaults: 60s clone, 90s scan).
- HTML reporter (existing) escapes user-controlled fields. The
  React/Next page uses normal JSX interpolation so React escapes by
  default.

## Rollback

- Runner: revert the slice's commit. The four pipeline functions are
  untouched, so the rest of the tool continues to work.
- Workflow: delete `.github/workflows/leaderboard.yml` or set
  `if: false` on the job. Stops new runs immediately.
- Web page: revert; placeholder copy is recoverable from git.
- Already-committed JSON files stay in history but are inert once the
  page reverts.

## Open questions

- **Q:** Where does aggregated JSON live? **RESOLVED:** Committed to the
  public CLI repo under `tools/leaderboard/data/aggregated/`. Page fetches
  the raw GitHub URL with edge cache. Brief was already explicit.
- **Q:** Cadence? **RESOLVED:** Weekly Monday 06:00 UTC, per brief.
- **Q:** First scan size? **RESOLVED:** 100, per brief.
- **Q:** How does the page find the latest file when filenames are
  date-stamped? **RESOLVED:** Runner writes a stable `latest.json`
  alongside the dated file. The dated file is the historical record; the
  stable file is what the page reads.
- **Q:** Can the overnight loop run the first 100 scans now and commit
  the JSON? **RESOLVED — escalate:** No. 100 real clones + CLI runs is
  long-running and requires interactive token. The workflow is added
  with `workflow_dispatch` so the maintainer can trigger the first run
  on-demand. We seed `data/aggregated/latest.json` with an empty
  `rows: []` placeholder so the page renders the "first scan runs
  Monday" state cleanly. Decision logged as ADR.
- **Q:** Do we trust `LEADERBOARD_LIMIT` as a clamp or as a target?
  **RESOLVED:** Target, not clamp. The runner asks `fetchTopRepos` for
  exactly N, then scans all of them. Failures are recorded as rows with
  `score: null`.
- **Q:** Does the runner halt on the first scan error?
  **RESOLVED:** No. Per-repo errors are captured in the
  `ScanRepoResult` union; the runner aggregates everything and exits
  non-zero only if zero scans succeed (i.e. a systemic failure) or if
  a pre-scan stage (`fetchTopRepos`, output write) throws.

## Issues

This slice is small enough to ship as one PR per repo. Two issues, in
order:

### Issue 1 — `feat(leaderboard): bin orchestrator + weekly Action`

- **Repo:** CLI (`agentlint/agentlint`)
- **Files added:**
  - `tools/leaderboard/src/run.ts`
  - `tools/leaderboard/src/run.test.ts` (8+ tests)
  - `.github/workflows/leaderboard.yml`
  - `tools/leaderboard/data/aggregated/latest.json` (empty placeholder)
- **Files modified:**
  - `tools/leaderboard/package.json` (add `bin`, `start`, `tsx` runtime dep
    for spawning git/cli)
- **Independence:** blocks issue 2 (page needs JSON file URL to exist).
- **DoD:** `pnpm --filter @agentlinthq/leaderboard test` passes with 8+
  new tests; running `pnpm --filter @agentlinthq/leaderboard run start`
  (with `LEADERBOARD_LIMIT=2` and a token) writes the JSON file.
  `pnpm run ci` green. Self-audit still 100/100.

### Issue 2 — `feat(web): leaderboard page consumes aggregated JSON`

- **Repo:** web (`agentlint/agentlint.sh`)
- **Files modified:** `app/leaderboard/page.tsx`
- **Files added:**
  - `app/leaderboard/methodology/page.tsx`
  - `tests/leaderboard-page.test.tsx` (renders rows, empty state,
    error state)
- **Independence:** depends on issue 1 (URL must resolve to a valid JSON
  file).
- **DoD:** Page renders the table from a stubbed fetch in tests.
  `pnpm test` green, `pnpm exec tsc --noEmit` green.

### Marketing draft (parked, not shipped)

- `docs/marketing/drafts/leaderboard-launch.md` — escalated, do not
  publish.

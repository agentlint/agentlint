# Brief — leaderboard-runner

## One-line goal

Stand up the public agentlint leaderboard end-to-end: bin entrypoint that
orchestrates the existing four pipeline functions, weekly GitHub Action,
public `/leaderboard` page on `agentlint.sh`, first public run scored
against the top 100 GitHub repos.

## Repo

Both. CLI repo (`agentlint/agentlint`) owns the runner + Action; web repo
(`agentlint/agentlint.sh`) owns the page. Ship the runner first so the
weekly Action has something to commit; ship the page consuming the
committed JSON.

## Definition of done

A reviewer can verify:

1. `pnpm --filter @agentlinthq/leaderboard run start` (or
   `node tools/leaderboard/dist/run.js`) writes
   `tools/leaderboard/data/aggregated/<YYYY-MM-DD>.json` and
   `tools/leaderboard/out/leaderboard.html` locally.
2. A weekly GitHub Action `.github/workflows/leaderboard.yml` runs on
   cron `0 6 * * 1` (Mondays 06:00 UTC), executes the runner against
   top 100, commits the aggregated JSON to `main`, and pushes.
3. `https://agentlint.sh/leaderboard` renders a table reading the latest
   aggregated JSON via `revalidate = 86400` (one day). Columns: rank,
   repo (link to GitHub), stars, score, top failing rule, scanned-at.
4. First aggregated JSON committed to the CLI repo `main` branch with at
   least 100 rows.
5. `pnpm run ci` green on the CLI repo; existing leaderboard tests
   continue to pass plus 8+ new tests for `run.ts` (orchestration,
   error in stage N halts and reports, output paths).

## In scope

- `tools/leaderboard/src/run.ts` — orchestrator that calls
  `fetchTopRepos → scanRepo (per repo) → aggregate → renderJson +
  renderTable`. Writes JSON + HTML to disk. Honors `GITHUB_TOKEN` and an
  optional `LEADERBOARD_LIMIT` env (default 100; tests use 5).
- `tools/leaderboard/package.json` `bin` field + build config.
- `.github/workflows/leaderboard.yml` weekly Action with `GITHUB_TOKEN`
  scoped read-only.
- Web repo `app/leaderboard/page.tsx` rewritten from placeholder to read
  the JSON committed in the CLI repo (via `fetch` to the raw GitHub URL
  with edge cache; **not** a git submodule).
- Web repo `app/leaderboard/methodology/page.tsx` — moves the existing
  methodology + anti-gaming clauses from the placeholder into its own
  route.

## Out of scope

- Pagination / sorting on the leaderboard page — top 100 fits on one
  page. Larger sets are a follow-up slice.
- Blog post announcement. Charter §3.2 blocks publishing tonight; the
  loop drafts `docs/marketing/drafts/leaderboard-launch.md` and stops
  there.

## Charter check

- §3.1 allows shipping internal tooling + the web page.
- §3.2: no blog publish, no HN/X/PH submission, no email blast.

## Open decisions you may resolve

- Where does the aggregated JSON live for the page to consume?
  **RESOLVED:** committed to the public CLI repo under
  `tools/leaderboard/data/aggregated/`. The page fetches the raw
  GitHub URL with a 24h edge cache. This keeps the web repo private
  while the leaderboard data is provably public.
- Run cadence? **RESOLVED:** weekly Monday 06:00 UTC. Daily is wasteful;
  monthly is too slow for momentum.
- First scan size? **RESOLVED:** 100. The brief says ramp later.

## Notes for the agent

- The four pipeline functions (`fetchTopRepos`, `scanRepo`, `aggregate`,
  `renderTable`/`renderJson`) already have 19 passing tests. Do not
  refactor them; just orchestrate.
- The web page is a server component with `export const revalidate =
  86400`. No client JS needed.
- Cron expression `0 6 * * 1` runs against `main`; the Action token must
  have `contents: write` to push the data file.

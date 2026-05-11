# PRD — server-side scan on push (Vercel-style)

**Status:** approved by the autonomous pipeline (2026-05-10).
**Repo split:** web (`agentlint-sh`) only. **No CLI work.**
**Slug:** `server-side-scan-on-push`.
**Supersedes:** ADR-0019 (the "server-side scans removed" decision).

## Problem

A user just installed the agentlint GitHub App for PR-comment posting.
Their next instinct is "good, now scans happen automatically on push." Today
that is false — they still have to run `agentlint init` (which writes a
workflow file) for any of their CI runs to land in agentlint. ADR-0019
removed server-side scans because we couldn't justify the compute; the
maintainer pushed back this session ("how does Vercel do it?") and the
honest answer is: Vercel clones in their own infrastructure on every push
and the user writes nothing. We can match that.

This slice brings server-side scans back, but with a clean architecture
that doesn't require a user-side workflow file, doesn't require a repo
secret, and doesn't require any new App permission.

## Non-goals

- **Org-wide scan policies / thresholds.** Slice 9 in `PROJECT_STATE.md`.
- **Custom rules per project.** Future.
- **Other Git hosts** (GitLab, Bitbucket).
- **Replacing the CLI workflow path.** The OIDC-only Actions workflow
  (ADR-0026) still works and is the right answer for huge repos or for
  users who want CI control. Server-side scan is the **default**;
  Actions is the **fallback**.
- **Selective rule execution.** The full agentlint rule suite runs on
  every push.
- **Streaming progress to the dashboard.** Push → row appears on the
  next refresh. No live updates in this slice.

## Success metric

From a fresh test repo with the agentlint App installed:

```
$ git commit --allow-empty -m "test scan"
$ git push origin main
```

Within **5 seconds wall** of the push landing on GitHub, a `run` row
exists in the dev (later: prod) database with:

- `source = "server"`
- `provenance = "server-scanned"`
- `commit_sha = <the pushed sha>`
- `score = <a real score, not 0>`

And on a PR push, the agentlint App comment lands on the PR within 10s.

Measured: instrument `console.log` lines `[server-scan] start sha=…` and
`[server-scan] done sha=… ms=… score=…`. Tail Vercel logs during smoke.

## Schema diff

### Forward (`db/migrations/0004_run_source_server.sql`)

```sql
-- The `source` column is text without a CHECK; the schema lives in the
-- application layer (zod). No schema migration required for the enum
-- bump. This file exists as a marker that the application now reads/writes
-- "server" and provenance "server-scanned".
```

(If the existing schema has a CHECK or enum type, the migration adds the
new values; the agent should verify before generating.)

No new table. No new columns.

### Drizzle side

`db/schema.ts` `run.source` documentation comment updated. Zod schema for
the runs body widens to accept `"server"` (server-only path; user never
sends this from the CLI).

## API surface

### `POST /api/github/webhook` — extended

Existing handler currently dispatches `installation.*` and
`installation_repositories.*`. This slice **adds** `push` event handling:

1. Verify HMAC signature against `GITHUB_APP_WEBHOOK_SECRET` (existing).
2. Detect `X-GitHub-Event: push`.
3. Filter: scan only when the pushed `ref` matches **the repo's default
   branch** OR a branch that is the head of an **open PR** at the time of
   the event. Skip everything else (tag pushes, deletions, other
   branches without a PR).
4. Look up the `installation` row and the `project` row by
   `(repoOwner, repoName)`. If no project: 200 + `{ status: "no_project" }`
   (the user installed the App but hasn't created a project for this
   repo yet).
5. Idempotency check: if a `run` row already exists for `(project_id,
   commit_sha, source="server")`, return 200 + `{ status: "duplicate" }`.
6. Schedule the scan via Next.js `after()` so the webhook returns 200
   within GitHub's 10s budget.

The scan worker:

1. Mints an installation token via existing `lib/github-app/auth.ts`.
2. `git clone --depth=1 -b <branch> https://x-access-token:<token>@github.com/<owner>/<repo>.git /tmp/scan-<sha>`.
   - Uses the system `git` binary on the Vercel runtime (already
     available — Vercel's Node runtime includes git).
   - Hard timeout: 30s on the clone.
   - Max repo size: refuses any clone > 200 MB (check via `du -sb` after
     the clone, abort if exceeded).
3. Imports `runScan` from `@agentlinthq/cli` (new dep) — `await
   runScan({ cwd: cloneDir })`.
4. Insert `run` row with `source = "server"`, `provenance =
   "server-scanned"`, `branch`, `commit_sha`, `score`, `passes`,
   `fails`, `warnings`, `skipped`, `report_json`.
5. If the push is to a branch that's the head of an open PR, fire-and-forget
   the existing `postOrUpdatePrComment` helper.
6. Cleanup `rm -rf /tmp/scan-<sha>`.

All errors are caught and logged. The webhook handler **never returns
5xx** on scan failure — the failure is a database log entry (future
slice; for now `console.error`), not a retry signal to GitHub.

## CLI surface

**No CLI change.** This is the point of the slice — users never run
`agentlint init` to get server-side scans.

The CLI's existing flows still work for users who prefer them
(local-first, OIDC Actions, leaderboard contribution paths).

## UI surface

### Project page — new source pill

`/dashboard/orgs/[slug]/projects/[projectId]` — the runs table already
shows source/provenance for CI runs. Extend the badge styling to render
a green "server" pill alongside the existing "ci" and "local" pills.

### New-project page — copy update

`/dashboard/orgs/[slug]/projects/new/new-project-form.tsx` — after
"Project created", the success state currently prints a hint about
running `agentlint init`. **Add** a sentence above that hint:

> Scans will start running automatically on every push to this repo —
> no setup required. Want to run scans locally too? Use the CLI below.

(Local CLI hint stays; it's complementary, not replaced.)

### Org page — banner when App not installed

If the org has at least one project but no `installation` row, render a
banner: "Install the agentlint GitHub App to enable automatic scans on
every push." Link to the installer.

## Security

- **Installation token is short-lived (1h)** and never written to disk
  outside the clone URL embedding. The clone URL itself is constructed
  in memory; once the clone finishes the in-process variable is
  overwritten with empty string.
- **`/tmp/scan-<sha>`** is created with mode `0700`; `rm -rf` runs in a
  `finally` block so a thrown rule still cleans up.
- **No user input is shelled to git.** `owner`, `repo`, `branch`, `sha`
  all come from the GitHub webhook payload (signature-verified) and are
  validated against `^[a-zA-Z0-9._-]+$` before any shell command.
- **Webhook signature** is still the only gate to invoking the worker.
  Constant-time compare on `X-Hub-Signature-256`.
- **Rate limit on the worker**, not the webhook: a single repo
  pushing 100 commits in a minute should produce 100 webhook 200s but
  the worker only enqueues unique `(repo, sha)` pairs. The idempotency
  check in step 5 of the webhook does this.
- **Cost cap.** Vercel function `maxDuration: 60`. Repo size > 200MB
  → abort. Clone > 30s → abort.
- **No `Secrets:write` permission** is asked of the App.

## Rollback

- Revert this PR's three commits. The webhook handler reverts to its
  previous state (no `push` event handling). The `@agentlinthq/cli`
  dep can stay in `package.json` (idle); removing it is a follow-up.
- Feature flag `SERVER_SIDE_SCAN_ENABLED` (env var on Vercel) — default
  `true`. Set to `false` to disable server-side scans without a revert
  PR.

## Open questions

All resolved by the pipeline. Recorded as ADR-0027 (supersedes ADR-0019).

- **RESOLVED:** clone over Contents API. Clone is ~1-3s on a typical
  repo, requires no rule adaptation, and matches the "same scan as
  local/CI" promise. Contents API would force every rule to learn a
  remote-read interface.
- **RESOLVED:** Next.js `after()` over a separate queue infrastructure.
  Same pattern as the existing `postOrUpdatePrComment` dispatch in
  `/api/runs`. No new infra. Trade-off: if Vercel kills the function
  before `after()` finishes, the scan is lost — acceptable at our
  scale; we can add a queue later if needed.
- **RESOLVED:** import `runScan` from `@agentlinthq/cli` directly. Adds
  a workspace dep but avoids `npx` cold-starts on every push.
- **RESOLVED:** scan only default branch + open-PR branches. Scanning
  every branch of every push would 10x the compute for marginal value.

## Issues

Three issues. Issues 1 and 2 are sequential (2 imports from 1). Issue
3 is independent — schema-only documentation + UI pill. Dispatch
plan: one web agent handles 1+2+3 in a single branch since they all
touch the web repo and only 1+2 are sequential anyway.

### Issue 1 — `feat(web): scan-runner helper (clone + agentlint + cleanup)`

**Files in scope:**
- `package.json` — add `@agentlinthq/cli` and `@agentlinthq/core` as
  deps (latest published — `2.1.0` / `1.0.0`).
- `lib/server-scan/runner.ts` — exports `runServerScan(args:
  { installationToken: string; owner: string; repo: string; branch:
  string; sha: string }): Promise<RunResult>`. Returns the same shape
  the CLI's `--push` builds today.
- `lib/server-scan/runner.test.ts` — ≥6 tests using mocked
  `execFile` for git + a stubbed `runScan`. Cover: happy path, clone
  fails, repo too big, scan throws, cleanup runs on error path,
  cleanup runs on success path.

**Definition of done:**
- Helper returns `{ ok: true, score, passes, fails, warnings,
  skipped, reportJson }` or `{ ok: false, reason }`.
- Tests pass.

### Issue 2 — `feat(web): push-event handling in /api/github/webhook`

**Files in scope:**
- `lib/github-app/webhook-handlers.ts` — new `handlePushEvent(payload,
  { db })`. Looks up project, idempotency-checks, schedules
  `runServerScan` via `after()`, inserts `run` row on completion,
  fires PR-comment if applicable.
- `app/api/github/webhook/route.ts` — dispatch `push` event to the
  new handler.
- `lib/github-app/webhook-handlers.test.ts` (or extend existing) —
  ≥8 tests covering: no project → no_project, idempotency hit →
  duplicate, default branch push → scan scheduled, non-default
  branch without PR → skipped, scan failure caught → 200 returned,
  signature failure → 401 (existing test extended).

**Definition of done:**
- A signature-verified `push` event on a repo with a project triggers
  exactly one `run` row insert.
- Duplicate push of the same sha is a no-op.
- All errors are caught; webhook never 5xx's on scan-side failure.

### Issue 3 — `feat(dashboard,db): source/provenance enum + UI pill`

**Files in scope:**
- `app/api/runs/route.ts` — extend the zod schema's `source` enum to
  accept `"server"` (server uses this; user CLI body shape unchanged).
- `app/dashboard/orgs/[slug]/projects/[projectId]/page.tsx` — render a
  green "server" pill in the runs table for rows with
  `source = "server"`.
- `app/dashboard/orgs/[slug]/projects/new/new-project-form.tsx` —
  the copy update from the UI surface spec.
- Test the pill rendering.

**Definition of done:**
- Pill renders in the runs table for server-side rows.
- Copy on the new-project success state mentions automatic scans.

### Optional Issue 4 — `feat(dashboard): banner when App not installed`

If time permits. Adds the "Install the agentlint GitHub App" banner on
the org page when there's at least one project but no `installation`
row. Can be skipped on this run.

---

## Dispatch plan

Single sub-agent handles issues 1+2+3 on branch
`feat/server-side-scan-on-push` in the web repo. Branches from `dev`.
PR into `dev`.

---
name: agentlint-feature-pipeline
description: Drive the agentlint hosted-dashboard build forward autonomously. Pick the next unfinished P1 vertical slice from docs/PROJECT_STATE.md, grill yourself on it, write a PRD, cut vertical issues, ship them under TDD, then update state and commit. Use this whenever the user says "next feature", "keep building", "continue the pipeline", "ship the next slice", "/agentlint-feature-pipeline", or any equivalent prompt that means "autonomous-build mode on this repo." Also trigger when no specific feature is named but the user wants forward progress on the agentlint hosted dashboard, the leaderboard, or any P1 item in PROJECT_STATE.
---

# agentlint-feature-pipeline

Autonomous build pipeline for the agentlint hosted dashboard and leaderboard.
You are the executing agent — not a planner that hands work off. Read this
top to bottom once, then run it.

## What this skill is for

agentlint has a public CLI (open-source, MIT, `agentlint/agentlint`) and a
private web app (`agentlint/agentlint.sh`). Pro and Team subscriptions are
**pulled from the UI** until the hosted-dashboard surface is real (see
[ADR-0012](../../../docs/DECISIONS.md)). Your job is to ship that surface,
one vertical slice per run.

The pipeline is fixed. Walk through it in order. The point of fixing it is
that decisions stay legible and the human reviewer always knows where in the
loop you are.

## Inputs

None. The skill reads `docs/PROJECT_STATE.md` itself.

## Outputs per run

- One PRD at `docs/prds/<slug>.md` (committed to the CLI repo).
- 3–7 vertical issues — filed on GitHub if `gh` is wired to an issue tracker
  for this repo, otherwise written as a markdown checklist at the bottom of
  the PRD.
- Code, tests, and migrations for the slice (CLI repo, web repo, or both).
- `docs/PROJECT_STATE.md` "Done — recent" updated.
- `docs/DECISIONS.md` appended with a new ADR if any non-obvious choice was
  made (anything a future contributor might ask "why?" about).
- Commits in Conventional Commits format. Push at the end.

## STOP condition

If `docs/PROJECT_STATE.md` has no unfinished P1 vertical slice (items 4–9
under "P1 — unblock paid tiers", or a successor list once those are done),
emit a single line:

```
agentlint-feature-pipeline: no P1 slices pending. Next gate: revert ADR-0012 + flip Stripe live.
```

…and exit. Do not invent work.

## Pipeline

### 1. READ PENDING

Open `docs/PROJECT_STATE.md`. Find the lowest-numbered unfinished item under
**P1 — unblock paid tiers** (4–9). State, in one paragraph:

- Slice title
- The user-visible feature it unlocks
- Affected repos (CLI, web, or both)
- The "Done" check — what an external observer should see when the slice
  has shipped

If the leaderboard track (item 10) is also pending and the dashboard slice
is blocked on a human decision, you may pick the leaderboard slice instead.
Say so explicitly and continue.

### 2. SELF-INTERROGATE via grill-me

Invoke the `grill-me` skill with the chosen slice as the subject. The point
is to surface every branch of the decision tree before any code is written.
At minimum, resolve:

- **Scope.** What is in this slice? What is explicitly out of it?
- **Schema shape.** Tables, columns, indexes, foreign keys. Migration
  direction (forward + rollback). Whose data lives where (per-user,
  per-org, public)?
- **Auth model.** Session-cookie? API token? Both? Token rotation? Scope
  per token?
- **API surface.** Routes added or changed. Request and response shapes.
  Error envelope. Rate limiting.
- **CLI surface (if any).** New flags. Default off. Local-first invariant
  preserved (CLI must not phone home unless the user opts in via `--push`
  or equivalent).
- **UI surface.** New routes, components, empty states, error states.
- **Failure modes.** What happens if the network fails? If the token is
  revoked? If the schema migration partially applies? If the user is on the
  free plan and hits a paid feature?
- **Observability.** What logs land where. What is alertable.
- **Rollout.** Behind a feature flag? Killable how?

Make the calls. Do not punt to the human unless a charter-level boundary
is hit — see the autonomy table in [`CHARTER.md`](../../../docs/CHARTER.md).
Charter-level escalations include: changing rule weights, changing
`CATEGORY_MAX`, anything that sends data over the network from the CLI by
default, anything that changes the public scoring API, switching Stripe to
live mode, taking the CLI repo private, taking the agentlint.sh repo
public.

You are allowed — encouraged — to disagree and commit. If you think a
direction encoded in PROJECT_STATE is suboptimal, log the dissent in
`docs/DECISIONS.md` as a new ADR, then ship the chosen path without
sandbagging it.

### 3. WRITE PRD via to-prd

Invoke the `to-prd` skill. Output: `docs/prds/<slice-slug>.md`. The slug is
kebab-case, derived from the slice title — e.g. `agentlint-push-ingest`,
`run-history-dashboard`, `score-badge-svg`, `github-app-pr-comments`,
`org-dashboard`, `policy-thresholds`.

Required sections, in this order:

1. **Problem.** One paragraph. What is broken or missing.
2. **Non-goals.** Bullet list. What this slice will not do.
3. **Success metric.** A single, observable thing. Not "users love it" —
   something like "calling `agentlint --push` from a CI run results in a
   row in `runs` and a 200 response, end to end, in under 3 seconds at
   p95."
4. **Schema diff.** SQL or Drizzle snippet. Forward and rollback.
5. **API surface.** Routes, methods, request/response JSON, status codes,
   auth requirement.
6. **CLI surface.** If applicable. Flag name, default, behavior.
7. **UI surface.** Page or component diff at a high level — no pixel
   pushing.
8. **Security.** Token scope, what's hashed, what's logged, rate limits,
   abuse cases.
9. **Rollback.** What to do if this PR ships and breaks. The minimum is a
   feature flag plus a documented revert commit.
10. **Open questions.** Empty if grill-me worked. If non-empty, this slice
    is not ready — go back to step 2 or escalate.

One PRD per vertical slice. **Do not write a shared schema PRD that other
slices "extend" later.** Every slice owns its slice of the schema and ships
it.

### 4. CUT ISSUES via to-issues

Invoke the `to-issues` skill on the PRD. Aim for 3–7 issues. Each must be
**independently shippable**:

- Each issue owns its slice of the schema, API, CLI flag, and UI.
- An issue is allowed to add migrations, routes, components, and tests in
  the same PR.
- Forbidden patterns:
  - "Add all DB tables for the dashboard" (horizontal — cuts across
    slices)
  - "Scaffold all hosted API routes" (same problem)
  - "Set up auth tokens" as a standalone issue when no feature consumes
    them yet (premature scaffolding)
- Encouraged patterns:
  - "End-to-end `agentlint --push` for the local user" — owns the table,
    the token, the route, the CLI flag, and the dashboard list.
  - "Public score badge for `<owner>/<repo>`" — owns the public flag on
    `runs`, the SVG endpoint, and the README copy snippet.

If `gh issue create` works in this repo (the org has the issue tracker
enabled and the current `gh` auth has scope for it), file the issues. If
not, append a checklist to the PRD at the bottom under "## Issues" and
proceed. Either way, the list is the source of truth for the next step.

### 5. TDD EXECUTION via tdd

For each issue, in order, invoke the `tdd` skill. Constraints specific to
this repo:

- **CLI repo (`packages/cli`, `packages/core`, `tools/leaderboard`).**
  Tests in `*.test.ts` next to the source. Runner: `vitest`. Coverage gate:
  80% on changed files. New rules go through the rules contract — they
  catch and return a `fail` Result, never throw.
- **Web repo (`agentlint.sh`).** Unit and integration tests in `*.test.ts`
  next to the source, runner `vitest`. Critical user flows (login,
  dashboard load, `--push` ingest end-to-end) get a Playwright spec under
  `e2e/`. Coverage gate: 80% on changed files. Webhook handlers must have
  signature-failure tests.
- **Both repos.** Red → green → refactor → re-run. No commit until the
  test that motivated the code passes.

When a slice spans both repos, ship the producer side first (server route
or CLI flag) with its own tests passing, then the consumer side (UI,
follow-up CLI behavior). Keep PRs small.

### 6. CLOSE-OUT

In order:

1. Update `docs/PROJECT_STATE.md`:
   - Move the slice from **Pending** to **Done — recent** with a short
     entry (3–5 bullets).
   - Update the snapshot table if status fields changed (Stripe state,
     repo visibility, deployment URLs, etc.).
2. Append `docs/DECISIONS.md` if any non-obvious decision was made.
3. Run the verifier:
   - CLI repo: `pnpm run ci` (must pass) and `pnpm run agentlint .` (must
     report 100/100).
   - Web repo: `node node_modules/next/dist/bin/next build` (must succeed),
     plus `pnpm test` and `pnpm exec playwright test` if e2e specs exist.
4. Stage and commit per Conventional Commits. Examples:
   - `feat(cli): add agentlint --push to upload reports`
   - `feat(web): score badge SVG endpoint at /badge/:owner/:repo.svg`
   - `feat(web): GitHub App webhook posts PR score-diff comments`
   - `docs: ADR-0014 token scope for --push API tokens`
5. Push. If the slice is in the web repo and CI is wired, wait for the
   Vercel preview to come up and link it in the closing summary.

### 7. SUMMARY

End every run with a 3-bullet summary to the human:

```
SHIPPED: <slice title> — <one-line outcome>
PENDING: <next slice in the P1 list>
NEXT: <what `agentlint-feature-pipeline` will do on its next invocation>
```

## Charter constraints (do not violate without an ADR)

These are sticky. Re-read [`CHARTER.md`](../../../docs/CHARTER.md) before
shipping if you are unsure.

1. **Score-of-100 invariant.** `pnpm run agentlint .` on the CLI repo must
   still report 100/100 after the change. Either fix the regression in the
   same PR or revert.
2. **Public scoring API is sacred.** Rule weights and `CATEGORY_MAX` never
   change without an ADR superseding [ADR-0003](../../../docs/DECISIONS.md).
3. **Local-first.** The CLI never phones home in the default code path. The
   `--push` opt-in flag is the only sanctioned network call from the CLI,
   and even then only when the user passes it.
4. **Rules never throw.** They catch and return a `fail` Result.
5. **Conventional Commits.** Always. The husky hook in
   `.husky/prepare-commit-msg` already appends the agent co-authorship
   trailer — do not skip hooks.
6. **Disagree-and-commit is allowed.** If you think a direction encoded in
   PROJECT_STATE is wrong, log the dissent as a new ADR, propose the
   alternative, then ship the chosen path without sandbagging it.

## Multi-agent dispatch (when slices are independent)

If two pending slices are genuinely independent — different files, different
schema namespaces, different deployment surfaces — you may dispatch them in
parallel. Use the `Agent` tool with subagent types and clean contexts:

- Web work → `general-purpose` (or `typescript-reviewer` for review-only
  passes).
- CLI work → `general-purpose` with explicit instruction to keep `core/`
  IO-free.
- TDD enforcement → `tdd-guide`.
- Code review after a slice ships → `code-reviewer` and, for any code that
  touches auth/billing/user input, `security-reviewer`.

Each subagent gets the slice's PRD path and its issue list. They report
back, you integrate, you close out.

If unsure whether two slices are independent, run them sequentially. Sequential
correctness beats parallel speed.

## When this skill should *not* run

- The user is asking a question, not asking for forward progress.
- The user has given a specific instruction that bypasses the pipeline
  ("just rename this file", "fix this typo"). Do the specific thing.
- A charter-level boundary is being hit and the human has not weighed in.
- `pnpm run ci` is currently red on the CLI repo's `main` — fix that first
  with a `fix(...)` commit before starting a new slice.

## Re-enabling Pro and Team

When the P1 slices are done — `--push` ingest, run history, score badge,
PR comments, org dashboard, policy thresholds — the next pipeline run should
do exactly two things:

1. Revert the UI portion of [ADR-0012](../../../docs/DECISIONS.md):
   restore the `Subscribe` CTAs in `app/pricing/page.tsx`, restore the
   `/dashboard` upgrade CTA, remove the `Coming soon` badges and status
   banner.
2. Append a new ADR superseding ADR-0012, dated, with the receipts: which
   features shipped, the smoke-test runbook for the live-mode flip, and
   the rollback commit.

Do not flip Stripe to live mode in the same PR. That is a human-signed
action per the charter.

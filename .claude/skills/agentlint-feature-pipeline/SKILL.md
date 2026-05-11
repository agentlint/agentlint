---
name: agentlint-feature-pipeline
description: Autonomous build pipeline for ANY agentlint feature — CLI, web (`agentlint.sh`), leaderboard tool, docs, or rules. Takes a feature description (user-supplied or picked from `docs/PROJECT_STATE.md`), runs `grill-me` → `to-prd` → `to-issues` → `tdd`, dispatches independent slices to parallel sub-agents, then runs the close-out ritual. Use whenever the user says "next feature", "ship X", "build feature Y", "continue the pipeline", "/agentlint-feature-pipeline", or otherwise asks for autonomous forward progress on this repo or its sibling `agentlint-sh` repo. Replaces the old P1-only flavor — works for any feature, not just hosted-dashboard slices.
---

# agentlint-feature-pipeline

Generic autonomous build pipeline for agentlint and the sibling web app.

You are the executing agent. Read this top to bottom once, then run it.

## What this skill is for

agentlint is a TypeScript monorepo:

- `packages/cli` + `packages/core` — public, MIT, npm name `@agentlinthq/cli`
- `tools/leaderboard` — private workspace, never published
- sibling repo `agentlint-sh` at `~/Code/agentlint-sh/` — private Next.js 15
  web app (`agentlint.sh`), Better-Auth + Drizzle + Neon + Stripe

This skill drives a feature end-to-end: scope it, write a PRD, slice it into
vertical issues, ship them under TDD, then close out. The pipeline order is
**fixed** so the human reviewer always knows where in the loop you are.

## Inputs

Two modes. Both supported.

### Mode A — explicit feature

The user supplied a feature description in the prompt. Use it. Restate it in
your own words in step 1 so the human can correct course before any code is
written. A feature can be anything that fits in 1–3 PRs:

- a new CLI subcommand or flag
- a new web route, dashboard surface, or auth flow
- a new check or category of rules
- a leaderboard milestone (orchestrator, weekly run, public page)
- an ops upgrade (telemetry, billing flow, env split)
- a docs / marketing artefact (a launch post counts as a feature here)

### Mode B — no feature specified

Open `docs/PROJECT_STATE.md`. Pick the lowest-numbered unfinished item under
**Pending — prioritized**. If multiple priorities exist, prefer:

1. **P0** — needed before public launch
2. **P1 — unblock paid tiers** — vertical slices that bring back Pro/Team
3. **P1 — leaderboard launch**
4. **P1 — hygiene**
5. **P2 — 1.x roadmap**

State which slice you picked and why in step 1.

### STOP condition

Mode B only. If `PROJECT_STATE.md` has zero pending items, emit:

```
agentlint-feature-pipeline: no pending work. Suggest opening a PRD for a P2/P3 item or shipping a docs/marketing pass.
```

…and exit. Do not invent work.

## Pipeline

### 1. RESTATE

In one paragraph state:

- **Feature title** (kebab-case slug you'll use for the PRD file)
- **User-visible outcome** — what the user does after this ships that they
  cannot do today
- **Affected surfaces** — CLI repo, web repo, both, docs only, etc.
- **Done check** — a single observable thing an external reviewer can
  verify (e.g. "`agentlint --push` from a fresh repo writes a row in
  `run`, p95 under 3s")

If the feature is large enough that the Done check is fuzzy, that is a
signal it needs to be sliced before this run. Either narrow scope here, or
call it out and pick the first sub-slice.

### 2. SELF-INTERROGATE via grill-me

Invoke the `grill-me` skill on the chosen feature. **Answer your own
questions** — do not block on the human. Decisions you make autonomously
are logged in the PRD's "Open questions" section as `RESOLVED:` lines so
they're auditable.

At minimum, resolve:

- **Scope.** In/out. Non-goals.
- **Schema shape.** Tables, columns, indexes, FKs. Forward + rollback
  migration. Org-scoped, user-scoped, public? (v2 schema FKs every
  business table to `organization.id` — see ADR-0018.)
- **Auth model.** Session-cookie? Project token (`agl_proj_…`)? GitHub
  Actions OIDC? Device-flow? Token scope and rotation.
- **API surface.** Routes added or changed. Request/response shapes.
  Error envelope. Rate limits. Idempotency.
- **CLI surface.** New flags. Default off. Local-first invariant
  preserved — no network in the default code path.
- **UI surface.** New routes, components, empty/error states, copy.
- **Failure modes.** Network down. Token revoked. Migration half-applied.
  Free-plan user hits paid feature. Multi-org user.
- **Observability.** What logs land where. Alertable.
- **Rollout.** Feature flag? Killable how?
- **Charter check.** Score-of-100 invariant intact? Local-first
  invariant intact? Public scoring API untouched? If a charter
  boundary is crossed (rule weights, `CATEGORY_MAX`, Stripe live-mode,
  CLI default-on network, repo visibility flip), **stop and escalate**.

Disagree-and-commit is allowed and encouraged. If a direction in
`PROJECT_STATE.md` or an existing ADR seems suboptimal, log dissent as a new
ADR in `docs/DECISIONS.md`, then ship the path you chose.

### 3. PRD via to-prd

Invoke `to-prd`. Output: `docs/prds/<slug>.md` in this repo (the CLI repo
holds all PRDs even when the work lives in `agentlint-sh`).

Required sections, in this order:

1. **Problem.** One paragraph. What is missing or broken.
2. **Non-goals.** Bullet list. Explicit out-of-scope.
3. **Success metric.** One observable thing. Not "users love it" —
   something measurable end-to-end.
4. **Schema diff.** SQL or Drizzle snippet. Forward + rollback. Mark
   "no schema change" if applicable.
5. **API surface.** Routes, methods, request/response JSON, status
   codes, auth requirement, rate limits.
6. **CLI surface.** Flag/subcommand name, default, behavior, exit
   codes. Mark "no CLI change" if applicable.
7. **UI surface.** Page/component diff at a high level. Empty, loading,
   error states. No pixel-pushing.
8. **Security.** Token scope, what's hashed, what's logged, rate
   limits, abuse cases, CSRF/replay/SSRF if applicable.
9. **Rollback.** Feature flag + documented revert commit, minimum.
10. **Open questions.** Empty when this skill resolves them
    autonomously. Any `RESOLVED:` lines from step 2 live here as a
    paper trail of decisions.
11. **Issues.** Filled in by step 4.

One PRD per feature. **Do not write a shared schema PRD that other
features "extend" later.** Each feature owns its slice of the schema and
ships it.

### 4. CUT ISSUES via to-issues

Invoke `to-issues` on the PRD. Aim for 3–7 issues. Each must be
**independently shippable**:

- An issue owns its slice of the schema, API, CLI flag, and UI.
- An issue may add migrations, routes, components, and tests in one PR.
- Forbidden patterns:
  - "Add all DB tables for the dashboard" (horizontal scaffolding)
  - "Scaffold all API routes" (same problem)
  - "Set up auth tokens" as a standalone issue when no feature consumes
    them yet (premature scaffolding)
- Encouraged patterns:
  - "End-to-end `agentlint --push` for the local user" — owns the
    table, the token, the route, the CLI flag, and the dashboard list.
  - "Public score badge for `<owner>/<repo>`" — owns the public flag
    on `runs`, the SVG endpoint, and the README snippet.

If `gh issue create` works for the relevant repo (`agentlint/agentlint`
public; `agentlint/agentlint.sh` private), file them. Otherwise, append
the checklist to the PRD under `## Issues` and continue. Either way, the
list is the source of truth for step 5.

For each issue, record:

- **Title** — Conventional Commits prefix recommended
  (`feat(web):`, `feat(cli):`, `fix(...)`, `docs(...)`)
- **Repo** — CLI or web (or both, with the producer-first split)
- **Independence** — what other issues, if any, it blocks or is blocked by
- **Definition of done** — the one thing a reviewer can verify

### 5. TDD EXECUTION

For each issue, run TDD: red → green → refactor → re-run. Constraints:

- **CLI repo.** Tests in `*.test.ts` next to source. Runner `vitest`.
  Coverage gate 80% on changed files. Rules contract: rules never
  throw — they catch and return a `fail` Result.
- **Web repo (`agentlint-sh`).** Unit + integration tests in
  `*.test.ts` next to source, runner `vitest`. Critical flows (login,
  dashboard load, ingest end-to-end) get a Playwright spec under
  `e2e/` if and only if that critical flow is touched. Coverage gate
  80% on changed files. Webhook handlers must have signature-failure
  tests. Auth handlers must have unauthenticated-request tests.
- **Both repos.** No commit until the motivating test passes.

When a slice spans both repos: ship the **producer side first** (server
route or CLI flag) with its own tests passing, then the consumer side (UI,
follow-up CLI behavior). Keep PRs small.

#### Parallel dispatch (when issues are independent)

Two issues are independent when they touch different files, different
schema namespaces, and different deployment surfaces. When that's true,
dispatch them in parallel via the `Agent` tool, each in its own worktree:

- Web work → `general-purpose` (or `typescript-reviewer` for review-only)
- CLI work → `general-purpose` with an explicit reminder to keep
  `packages/core/` IO-free
- TDD enforcement → `tdd-guide`
- Code review after a slice ships → `code-reviewer`. For auth, billing,
  or user-input code → also `security-reviewer`.

Each subagent gets:

1. The PRD path
2. Its assigned issue (title + DoD + files in/out of scope)
3. Repo root path (CLI or web)
4. Charter pointer (`docs/CHARTER.md`) so it knows the guardrails

Subagents report back; you integrate; you close out. If unsure whether
two issues are independent, **run them sequentially**. Sequential
correctness beats parallel speed.

### 6. CLOSE-OUT

In order:

1. **Update `docs/PROJECT_STATE.md`:**
   - Move the slice from **Pending** to **Done — recent** with a 3–5
     bullet entry.
   - Update the snapshot table if any status field changed (test count,
     CI status, ADR pointers, env vars, deployment URLs).
2. **Append `docs/DECISIONS.md`** with a new ADR for any non-obvious
   decision (anything a future contributor would ask "why?" about).
3. **Verify both repos:**
   - CLI repo: `pnpm run ci` (must pass) and `pnpm run agentlint .`
     (must report 100/100).
   - Web repo: `pnpm test`, build (`node_modules/next/dist/bin/next
     build`), and `pnpm exec playwright test` if e2e specs were
     touched or added.
4. **Stage and commit** per Conventional Commits. Examples:
   - `feat(cli): agentlint login subcommand (device-flow OAuth)`
   - `feat(web): API route for CLI device-flow exchange`
   - `feat(dashboard): redesigned project setup wizard`
   - `docs: ADR-00XX device-flow CLI auth`
5. **Push** to the relevant remote. If the slice is in the web repo and
   the deploy workflow is wired, wait for the Vercel preview and link it
   in the closing summary.

### 7. SUMMARY

End every run with a 3-bullet summary to the human:

```
SHIPPED: <feature title> — <one-line outcome + PR/URL>
PENDING: <next pending item or "nothing — propose next">
NEXT: <what /agentlint-feature-pipeline will do on its next invocation>
```

## Charter constraints (do not violate without an ADR)

Sticky. Re-read [`CHARTER.md`](../../../docs/CHARTER.md) when in doubt.

1. **Score-of-100 invariant.** `pnpm run agentlint .` on the CLI repo
   must still report 100/100 after the change.
2. **Public scoring API is sacred.** Rule weights and `CATEGORY_MAX`
   never change without an ADR superseding [ADR-0003](../../../docs/DECISIONS.md).
3. **Local-first.** The CLI never phones home in the default code path.
   Opt-in network calls (today: `--push`, `--public`, OIDC fetch when
   CI detected, future: `agentlint login` device-flow) all require an
   explicit user action or env signal — never default-on.
4. **Rules never throw.** They catch and return a `fail` Result.
5. **Conventional Commits, always.** The husky hook in
   `.husky/prepare-commit-msg` appends the agent co-author trailer —
   do not skip hooks.
6. **Disagree-and-commit is allowed.** Log dissent as a new ADR, ship
   the chosen path without sandbagging it.
7. **Branch policy** (ADR-0021). CLI repo: `feat/*` → PR → `main`. Web
   repo: `feat/*` → PR → `dev` → PR → `main`. Never push directly to
   `main` on either repo.

## When this skill should *not* run

- The user is asking a question, not asking for forward progress.
- The user gave a specific narrow instruction ("rename this file",
  "fix this typo"). Do the specific thing.
- A charter-level boundary is being hit and the human has not weighed
  in. Escalate.
- `pnpm run ci` is currently red on the CLI repo's `main` — fix that
  first with a `fix(...)` commit before starting a new feature.

## Repo map (quick reference)

| Concern | Location |
|---|---|
| CLI source | `~/Code/agentlint/packages/cli/src/` |
| CLI tests | `*.test.ts` next to source; `vitest` |
| Score calc / types | `~/Code/agentlint/packages/core/src/` |
| Leaderboard tool | `~/Code/agentlint/tools/leaderboard/src/` |
| Web app | `~/Code/agentlint-sh/app/` and `~/Code/agentlint-sh/lib/` |
| Web schema | `~/Code/agentlint-sh/db/schema.ts` |
| Web tests | `~/Code/agentlint-sh/tests/` and `*.test.ts` next to source |
| PRDs | `~/Code/agentlint/docs/prds/` |
| ADRs | `~/Code/agentlint/docs/DECISIONS.md` |
| Project state | `~/Code/agentlint/docs/PROJECT_STATE.md` |
| Playbook | `~/Code/agentlint/docs/PLAYBOOK.md` |
| Charter | `~/Code/agentlint/docs/CHARTER.md` |

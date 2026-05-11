# Brief — dependabot-triage

## One-line goal

Walk the 4 open dependabot alerts on `agentlint/agentlint.sh` (2 high, 2
moderate). Auto-merge those whose blast radius is trivial; open an ADR
sketch for the rest with rollback plan.

## Repo

`agentlint/agentlint.sh` (web repo) — `~/Code/agentlint-sh`.

## Definition of done

A reviewer can verify:

1. `gh api repos/agentlint/agentlint.sh/dependabot/alerts --jq '.[].state'`
   shows zero `open` alerts at minimum severity HIGH.
2. For each MODERATE alert that wasn't auto-merged, an ADR sketch
   exists at `docs/DECISIONS.md` (in the CLI repo, per the charter) with
   the package name, advisory ID, why it's deferred, and the trigger
   condition that will reopen it.
3. `pnpm test` and `next build` green on the dev branch after each merge.
4. Each merged dependabot PR has a "by overnight loop" trailer in the
   merge commit body.

## In scope

- `gh api` calls to list, read, and merge dependabot alerts.
- For each high-severity alert: review the patch, run dev test suite, if
  green merge the PR via the `dev` branch flow (`gh pr merge --squash`).
- For each moderate-severity alert: write a deferral ADR if not auto-merged.

## Out of scope

- Major-version bumps (charter §3.2). Defer those with an ADR no matter
  the severity.
- Bumping deps that aren't behind a dependabot alert. That's a separate
  hygiene pass.

## Charter check

- §3.1 explicitly allows "bumping patch versions of dependencies… when
  CI stays green". This slice operationalizes that policy on a backlog
  of alerts.
- §3.2 still applies: any **major** bump pauses and asks. The loop
  writes an ESCALATE log line and a deferral ADR.

## Open decisions you may resolve

- What counts as "trivial blast radius"? **RESOLVED:** patch or minor
  bumps where the package surfaces only in build-time tooling
  (`@types/*`, `vitest`, `tsx`), or in a transitive dep with a published
  CVE for which the patch is purely additive. Anything in `next`,
  `better-auth`, `drizzle-orm`, `stripe`, or `@octokit/*` defers to an
  ADR.

## Notes for the agent

- Run `gh api repos/agentlint/agentlint.sh/dependabot/alerts` first to get
  the current list; do not trust this brief's count.
- For each dependabot PR, run `gh pr checks <num>` and refuse to merge
  if checks aren't green.
- Squash-merge into `dev`. The deploy workflow handles the alias.

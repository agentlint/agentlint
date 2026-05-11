# Brief — policy-thresholds-team

## One-line goal

Org admins on Team plan can set a minimum passing score; CLI `--push`
reads the org policy in the response and exits non-zero when the run is
below threshold. Slice 9 from `PROJECT_STATE.md`.

## Repo

Both. Producer-first: web ships the policy table + the read endpoint in
`--push` response first; CLI consumes second.

## Definition of done

A reviewer can verify:

1. New table `org_policy` keyed on `organizationId` with columns
   `minScore int`, `enforce boolean default false`, `created_at`,
   `updated_at`. FK + unique on `organizationId`.
2. Org-admin UI on `/dashboard/orgs/[slug]/settings/policy` with two
   controls: "Minimum score" (0–100) and "Enforce on CLI push" toggle.
   Gated by Team plan (`canSeeOrgOverview` from previous slice is
   reused as `canEditPolicy`).
3. `POST /api/runs` response gains an optional `policy: { minScore,
   enforce, passed: boolean }` object when the run's project belongs
   to a Team-plan org with a policy set.
4. CLI repo: `--push` reads the policy from the response. If
   `policy.enforce === true && policy.passed === false`, the CLI prints
   a red "Policy failed: score X is below minimum Y" line and exits
   with code 2. Otherwise behavior is unchanged.
5. 12+ tests on web (schema, route, gate). 8+ tests on CLI (response
   parsing, exit codes, policy-disabled path).

## In scope

- Web: schema, migration applied to **dev** Neon branch, settings page,
  route response extension, plan-gate reuse.
- CLI: response parser in `packages/cli/src/push/client.ts`, exit-code
  handling in `packages/cli/src/index.ts`.

## Out of scope

- Per-project policies (only org-level for now). Bumping a project
  outside the policy is a future slice.
- Email/Slack notifications on enforce-fail. The CLI exit code is the
  contract for now; CI surfaces the failure.

## Charter check

- §4 "Public scoring API sacred": this **does not** change scores. The
  CLI's exit code is policy-driven, not score-driven.
- §4 "Local-first": the CLI behavior is unchanged absent `--push`. The
  policy only fires when the user opts into push.
- §4 "Don't break agents that depend on `--json` / `--markdown`": the
  CLI's JSON output gets a new `policy` field but only when present —
  additive, minor-version-safe.

## Open decisions you may resolve

- Default `minScore` when the org first sets a policy? **RESOLVED:**
  blank — the form requires an explicit number, no implicit default
  that surprises users.
- What about back-fills for runs from before the policy existed?
  **RESOLVED:** policy applies prospectively only. Historical runs in
  the dashboard are unaffected.
- CLI exit code 2 vs. 1 on policy fail? **RESOLVED:** 2. Reserve 1 for
  agentlint score-of-100 fails so the user can tell them apart in CI.

## Notes for the agent

- This is a producer-first slice. Web changes ship first with the new
  response field. CLI changes can ship in a follow-up commit on the
  same PR.
- The exit-code change is a soft compat break — document it in the
  CLI's `README.md` under "Exit codes" and reflect it in
  `docs/PROJECT_STATE.md` for the next release roll-up.

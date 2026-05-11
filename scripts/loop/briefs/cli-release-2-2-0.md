# Brief — cli-release-2-2-0

## One-line goal

Roll up the CLI-side changes that landed in tiers 0 and 3
(`cli-runscan-export`, the `--push` policy exit code from
`policy-thresholds-team`) into `@agentlinthq/cli@2.2.0`. Tag, publish to
npm via the `publish-cli.yml` workflow, create a GitHub Release.

## Repo

`agentlint/agentlint` (CLI repo) — this repo, `~/Code/agentlint`.

## Definition of done

A reviewer can verify:

1. `packages/cli/package.json` version bumped to `2.2.0`. If
   `@agentlinthq/core` got a behavioral change, bump it to `1.1.0` and
   update the workspace dependency.
2. A new tag `v2.2.0` exists on the CLI repo's `main` branch.
3. `npm view @agentlinthq/cli@2.2.0` resolves (published via
   `publish-cli.yml` workflow_dispatch). `NPM_TOKEN` secret is already
   set; the workflow handles the publish.
4. A GitHub Release at
   `https://github.com/agentlint/agentlint/releases/tag/v2.2.0` with
   release notes covering: programmatic `runScan` export, policy
   thresholds, exit-code-2 on policy fail, plus any incidental fixes
   from tier 0.
5. `README.md` "Quick start" still works against the new version
   (`npx @agentlinthq/cli@2.2.0` on a fresh dir scores 100/100 on
   this repo).

## In scope

- Version bump in `packages/cli/package.json`.
- `CHANGELOG.md` entry (create the file if it doesn't exist; otherwise
  prepend).
- `git tag v2.2.0 && git push origin v2.2.0`.
- `gh workflow run publish-cli.yml` to fire the npm publish.
- `gh release create v2.2.0 --notes-file CHANGELOG.md` (extract the
  relevant section).
- Smoke: `npx @agentlinthq/cli@2.2.0 --version` should print `2.2.0`
  once npm propagation lands (usually <2 min).

## Out of scope

- Annual release cadence change. This is a single minor bump.
- Announcement. Drafts only — charter §3.2 is still in force for
  public posts.

## Charter check

- §3.2: "Publishing a release to npm (the human pastes the 2FA OTP at
  minimum…)." The user has authorized npm publish tonight; the
  workflow uses `NPM_TOKEN` so no OTP is required.
- §3.2 "Bumping the **major** version of agentlint or any breaking
  change to the CLI flags, exit codes, or report shape." A new exit
  code (`2` for policy fail) is **arguably** a breaking change. The
  policy-thresholds-team brief logged this as a soft compat break;
  the release notes call it out explicitly. If the agent decides this
  warrants a major bump (3.0.0), it may do so — log the choice as an
  ADR and update the release tag accordingly.

## Open decisions you may resolve

- Minor (2.2.0) or major (3.0.0)? **RESOLVED:** minor — new exit code
  fires only when the org policy is enabled, which is a Team-plan
  feature gated on opt-in. Users who don't opt in see no change. A
  major bump would surprise free-tier users who never see the new
  behavior. Document in release notes.
- Include a "what's coming next" section? **RESOLVED:** yes, a one-line
  pointer to the leaderboard launch.

## Notes for the agent

- The `publish-cli.yml` workflow exists from CLI v2.0.0 ship. Verify
  it before triggering; if it's broken, fix it in the same PR.
- npm 2FA: the workflow uses `NPM_TOKEN` from secrets. No OTP needed
  unless npm policy has changed since last publish; in that case,
  ESCALATE.
- Release notes draft lives in the CLI repo's `CHANGELOG.md`. Keep
  them short, factual, contributor-readable.

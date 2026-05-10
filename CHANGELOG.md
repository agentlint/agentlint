# Changelog

All notable changes to agentlint are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-05-10

The hosted-dashboard companion at <https://agentlint.sh> went live in
this release; the CLI now opts into uploading reports, marking them
public for the score badge, and attaching PR context so the GitHub
App can post PR comments. All new behavior is **opt-in** — the
local-first invariant is preserved
([CHARTER §3](./docs/CHARTER.md)). Without `--push` the CLI behaves
identically to v1.0.0 and never makes a network call.

### Added

- `--push` uploads the report to your agentlint.sh dashboard. Requires
  a token from `AGENTLINT_TOKEN` env or `~/.config/agentlint/token`.
  The endpoint is `https://agentlint.sh` by default; override with
  `AGENTLINT_URL` or `--push --url <origin>`. Push failures never
  exit non-zero — the local audit succeeded, push is a side effect.
- `--public` marks a pushed run as publicly visible so the score
  badge at `https://agentlint.sh/badge/<owner>/<repo>.svg` renders
  the score for that repo. No effect without `--push`.
- `--pr <number>` manually attaches a pull-request number to the
  pushed run. CI environment auto-detection runs first
  (`GITHUB_EVENT_NAME=pull_request*` + `GITHUB_REF=refs/pull/<n>/…`,
  with `AGENTLINT_PR` as a CI-vendor-agnostic override); the CLI
  flag is a manual override on top. When a PR context is attached
  and the corresponding repo has the `agentlint-ci` GitHub App
  installed, the server posts (or updates) a single PR comment
  showing the score + diff vs. the previous run.
- Repository owner/name auto-detected from
  `git config --get remote.origin.url` and sent with the push body.

### Changed

- The `--url` flag is now overloaded between two distinct uses: when
  used alone it still sets the docs-site target for documentation
  rules; with `--push`, a *bare-origin* `--url` (path empty or `/`)
  selects the push endpoint. Anything with a non-trivial path falls
  back to `AGENTLINT_URL` or the default. Existing single-flag use
  is unchanged.

### Internal

- New modules in `packages/cli/src/push/`: `token.ts`, `client.ts`,
  `repo-detect.ts`, `pr-detect.ts`. All pure-ish — env access and
  IO go through injected dependencies for testability. 51 new tests
  across the four modules.

## [1.0.0] - 2026-05-09

Initial public release.

> The CLI is published as **`@agentlinthq/cli`** because the unscoped
> `agentlint` name and the `agentlint` npm org name are both held by an
> unrelated package
> ([ADR-0011](./docs/DECISIONS.md#adr-0011--publish-under-agentlinthq-org-scope-the-unscoped-agentlint-and-the-org-name-agentlint-are-both-taken)).
> The installed binary is still `agentlint`.

### Added

- `@agentlinthq/cli`: scan any repository against ~30 checks across 5 categories
  (discoverability, buildability, conventions, documentation, safety).
- 0–100 agent-readiness score, renormalized against applicable categories
  ([ADR-0003](./docs/DECISIONS.md#adr-0003--score-formula-renormalized-to-0100)).
- Default outputs: colored terminal report and self-contained
  `agentlint-report.html` written to disk
  ([ADR-0004](./docs/DECISIONS.md#adr-0004--default-outputs-terminal--html-structured-outputs-behind-flags)).
- Structured outputs for agents and CI: `--json` and `--markdown` flags
  send machine-readable reports to stdout.
- Optional documentation-surface scan via `--url <docs-url>`; skipped when
  not provided.
- Exit code 1 when score falls below 80, suitable as a CI gate.
- `@agentlinthq/core`: pure types and score calculator with no IO, useful for
  custom runners and future hosted dashboards.

### Project

- Project constitution published in `docs/`: CHARTER, PROJECT_STATE,
  PLAYBOOK, DECISIONS. agentlint is operated autonomously by an agent
  with a human in the loop; the operating model is public.
- Self-audit: the repository scores 100/100 on its own rubric.

[1.1.0]: https://github.com/agentlint/agentlint/releases/tag/v1.1.0
[1.0.0]: https://github.com/agentlint/agentlint/releases/tag/v1.0.0

<!-- npm packages: -->
<!-- @agentlinthq/cli — https://www.npmjs.com/package/@agentlinthq/cli -->
<!-- @agentlinthq/core — https://www.npmjs.com/package/@agentlinthq/core -->

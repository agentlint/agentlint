# Changelog

All notable changes to agentlint are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-05-09

Initial public release.

> The CLI is published as **`@agentlint/cli`** because the unscoped
> `agentlint` name on npm is held by an unrelated package
> ([ADR-0011](./docs/DECISIONS.md#adr-0011--publish-cli-as-agentlintcli-the-unscoped-agentlint-is-taken)).
> The installed binary is still `agentlint`.

### Added

- `@agentlint/cli`: scan any repository against ~30 checks across 5 categories
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
- `@agentlint/core`: pure types and score calculator with no IO, useful for
  custom runners and future hosted dashboards.

### Project

- Project constitution published in `docs/`: CHARTER, PROJECT_STATE,
  PLAYBOOK, DECISIONS. agentlint is operated autonomously by an agent
  with a human in the loop; the operating model is public.
- Self-audit: the repository scores 100/100 on its own rubric.

[1.0.0]: https://github.com/agentlint/agentlint/releases/tag/v1.0.0

<!-- npm packages: -->
<!-- @agentlint/cli — https://www.npmjs.com/package/@agentlint/cli -->
<!-- @agentlint/core — https://www.npmjs.com/package/@agentlint/core -->

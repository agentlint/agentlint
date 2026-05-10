# Contributing to agentlint

Thanks for considering a contribution. agentlint is operated autonomously by
an agent (see [`docs/CHARTER.md`](./docs/CHARTER.md)) and is open to human
and agent contributors on equal terms. There is no enforcement on who or
what wrote a patch — only on whether the patch passes the bar.

## TL;DR

1. Open an issue first for anything bigger than a typo or a one-line fix.
   Saves you wasted work.
2. Fork → branch → PR. Branch off `main`, name `feat/<thing>` or
   `fix/<thing>`.
3. `pnpm run ci` must pass and the self-audit must stay at 100/100.
4. Conventional Commits.
5. PRs are reviewed by the maintaining agent. CRITICAL/HIGH issues block
   merge; MEDIUM/LOW are advisory.

## Setup

```bash
# Prereqs: Node 18+, pnpm 9+
git clone https://github.com/agentlint/agentlint.git
cd agentlint
pnpm install
pnpm run ci
```

`pnpm run ci` runs build → typecheck → lint → tests → self-audit. All five
must pass. If self-audit drops below 100/100, the change is not done.

## What kinds of contributions are welcome

| Kind | Notes |
|---|---|
| Bug fix | Always welcome. Include a regression test. |
| New rule | Proposed via an issue first. See [`docs/PLAYBOOK.md` § Adding a new rule](./docs/PLAYBOOK.md#adding-a-new-rule-to-the-rubric). Note: adding a rule with a non-zero weight changes the public scoring API; expect discussion before merge. |
| Reporter improvement | Terminal/HTML/JSON/Markdown reporters welcome. Keep HTML self-contained (no external CSS, fonts, JS). Keep JSON shape backwards-compatible. |
| Performance | Benchmark before and after; include numbers in PR description. |
| Docs | Always welcome. Fixing a typo? Send the PR. |
| Test improvements | Always welcome. |
| Architecture / refactoring | Open an issue first. Refactors with no behavior change should not change the score. |

## What is not welcome

- Changes to scoring weights or `CATEGORY_MAX` without a `RFC` issue and
  maintainer sign-off — these are public API.
- Adding telemetry, network calls, or analytics to the CLI hot path. The
  CLI is local-first by design.
- Adding `<link>`, `<script src>`, or other external resources to the HTML
  reporter. Reports must work offline.
- Sweeping style changes mixed with logic changes. Keep them separate.
- AI-generated content that hasn't been reviewed by you. We don't filter
  by who-or-what wrote it; we do filter by quality.

## Conventions

### Branches

- `feat/<thing>` for new functionality.
- `fix/<thing>` for bug fixes.
- `docs/<thing>` for docs-only.
- `refactor/<thing>` for restructuring without behavior change.
- `chore/<thing>` for tooling, deps, CI.

### Commits

Conventional Commits. Format:

```
<type>: <short description>

<optional body explaining the why>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`.

Commits in this repo are auto-trailered with
`Co-Authored-By: Claude <noreply@anthropic.com>` via
`.husky/prepare-commit-msg`. This applies to human contributors as well —
see [ADR-0009](./docs/DECISIONS.md#adr-0009--husky-prepare-commit-msg-hook-auto-appends-co-authored-by-claude)
for the rationale. To opt a single commit out, edit the message to remove
the trailer before finalizing.

### Code style

- TypeScript strict mode. No `any` without a `// reason:` comment.
- Files: kebab-case. Types: PascalCase. Functions/vars: camelCase.
- Workspace imports use `@agentlinthq/core`. Never deep-import.
- Rules never throw. They catch internally and return a `Result` with
  status `fail`.
- Don't bypass `scan-context.ts` with raw `fs` calls inside rules — the
  cache layer is shared across rules in a run.

Biome is the formatter and linter. `pnpm run lint` and
`pnpm exec biome format --write packages/` before committing, or let the
`pre-commit` hook handle it.

### Tests

Every rule should have tests for `pass`, `fail`, and `skip` cases. New
behavior in any module needs a test that fails on the un-fixed code and
passes on the fixed code.

Run tests:

```bash
pnpm run test
pnpm --filter @agentlinthq/cli run test
```

## Pull request workflow

1. Fork the repo (or push a branch directly if you have write access).
2. `git checkout -b feat/whatever`.
3. Make changes. Commit with Conventional Commits.
4. `pnpm run ci` must pass locally.
5. Push your branch and open a PR against `main`.
6. CI runs the same pipeline. It must pass before review.
7. The maintaining agent reviews. Expect a triage label within 24h on
   weekdays. Substantive review usually within 72h.
8. Address review comments by pushing additional commits (don't force-push
   while review is active — keep the diff visible).
9. Once approved and CI is green, the maintainer merges. Squash-merge by
   default to keep `main` history linear.

### What "approved" means

- No CRITICAL or HIGH issues identified by review.
- All discussions resolved.
- Self-audit score on this repo is still 100/100 after the merge.
- Tests cover the new behavior.

## Proposing a new rule

Rules are the load-bearing public API of agentlint. A rule proposal goes
through this process:

1. **Open an issue** with the title `RFC: <category>/<rule-id>`. Describe:
   - What the rule checks.
   - Why a project should care (the harm of failing it).
   - The proposed `weight`. Justify it relative to existing rules in the
     same category.
   - The proposed `fix` text and remediation.
2. **Discussion.** Other contributors and the maintainer weigh in. Some
   proposals are rejected; some are reshaped.
3. **Implementation.** Once accepted in the issue, send a PR per
   [`PLAYBOOK.md` § Adding a new rule](./docs/PLAYBOOK.md#adding-a-new-rule-to-the-rubric).
4. **Self-audit.** This repo must still score 100/100 after the rule is
   added. If your rule fails on this repo, fix this repo first (eat your
   own dog food) or rethink the rule.

Adding a rule with a non-zero weight raises the category cap and
renormalizes everyone's score. This is treated as a soft breaking change:
minor version bump, prominent changelog note.

## Reporting bugs

Open an issue with:

- agentlint version (`agentlint --version`).
- Node version, OS, package manager.
- Exact command run.
- Expected behavior.
- Actual behavior, ideally with the full terminal output.
- A minimal repro repo if possible.

The maintainer will label `needs-repro` on issues without a clear
reproduction. Issues with `needs-repro` and no response in 14 days are
closed `not-actionable` — reopen any time with the missing info.

## Reporting security issues

**Do not file a public issue.** See
[`docs/PLAYBOOK.md` § Handling a security disclosure](./docs/PLAYBOOK.md#handling-a-security-disclosure).
Email `security@agentlint.sh` (forwarding will be set up shortly; until
then, open a private security advisory at
<https://github.com/agentlint/agentlint/security/advisories/new>).

## Code of Conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). By
participating, you agree to abide by it.

## License

By contributing, you agree your contribution is licensed under the
project's MIT License.

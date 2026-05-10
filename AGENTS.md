# AGENTS.md — agentlint

> Briefing for AI coding agents working in this repo. Concise and actionable. Source of truth that all other tool-specific files (CLAUDE.md, .cursor/rules, copilot-instructions.md) point at.

## Project

agentlint is a TypeScript monorepo using pnpm workspaces. It ships an open-source CLI (`packages/cli`) that scans a repository against ~30 checks and produces a 0–100 agent-readiness score, plus a `core` package with pure types and score calculation.

## Build, test, lint, typecheck

All commands run from the repo root. Package manager: **pnpm** (>=9).

```bash
pnpm install                # install deps for all workspaces
pnpm run build              # build everything
pnpm run test               # run tests (vitest) across all workspaces
pnpm run lint               # biome check
pnpm run typecheck          # tsc --noEmit across the workspace
pnpm run agentlint .        # run agentlint on this repo (must score 100)
pnpm run ci                 # full pipeline: build + typecheck + lint + test + agentlint
```

Always run `pnpm run ci` before considering work done. CI runs the same pipeline; if the score drops below 100, the build fails.

## Architecture

```
packages/
  core/                 pure types, score-calc — no IO
    src/types.ts        Result, Rule, Report, ScanContext
    src/score.ts        buildReport, registerRuleCategory
  cli/                  CLI entrypoint, FS walker, reporters
    src/index.ts        bin entry
    src/scan-context.ts cached FS reads + project meta detection
    src/rules/          one file per category, six rules each
    src/report/         terminal, html, json, markdown reporters
```

`core` is depended on by `cli` via `workspace:*` protocol. Never make `core` depend on anything in `cli` — it must stay IO-free for testing.

## Conventions

- Language: TypeScript strict mode. No `any` without a `// reason:` comment.
- Naming: kebab-case for files, PascalCase for types, camelCase for functions and variables.
- Imports: workspace imports use `@agentlint/core`. Never deep-import.
- Errors: rules never throw — they catch internally and return a `Result` with status `fail`. The runner wraps `check()` in a try/catch as a last resort.
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).
- Tests: every rule should have a test covering pass, fail, and skip cases.

## Adding a new rule

1. Create a rule object in the appropriate `packages/cli/src/rules/<category>.ts` file.
2. Export it and add it to the category's `*Rules` array.
3. Add a test for it in `packages/cli/src/rules/rules.test.ts`.
4. Run `pnpm run build && pnpm run agentlint .` and verify the new rule appears.

## Off-limits

Do not modify these without explicit instruction:

- Rule weights in `packages/cli/src/rules/*.ts` `meta` blocks — these define the public scoring API. Bumping them is a breaking change.
- `packages/core/src/score.ts` `CATEGORY_MAX` — the score formula is intentionally simple; changing it changes everyone's score.
- Generated `dist/` directories.

## Secrets

Never commit `.env*` files. The CLI is local-first; nothing requires secrets at runtime.

## Gotchas

- The CLI is published as `agentlint` on npm; the workspace name is also `agentlint`. The core package is `@agentlint/core`.
- This repo uses `pnpm`, not npm. The `workspace:*` protocol in package.json only resolves under pnpm/yarn-berry; running `npm install` will fail.
- `fast-glob` patterns are case-sensitive on Linux/CI but case-insensitive on macOS — tests that depend on filename casing must account for this.
- The HTML reporter is self-contained: no external CSS, no fonts, no JS. Reports must work offline. Don't add `<link>` or `<script src="...">` tags.
- Network calls (in the documentation rules) must use `safeFetch` with an `AbortSignal.timeout` — never an unbounded `fetch`.
- The scan-context is a single shared object across all rules in a run — its caches make repeated `read`/`exists`/`glob` calls cheap. Don't bypass it with raw `fs` calls inside rules.

## Verification before finishing

For any change, the agent should:

1. `pnpm run typecheck` — passes
2. `pnpm run test` — all tests pass; new code has tests
3. `pnpm run lint` — clean
4. `pnpm run agentlint .` — score is still 100/100
5. Diff confined to the agreed paths.

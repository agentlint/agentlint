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
    src/index.ts        bin entry — argv parsing + subcommand dispatch
    src/init/index.ts   `agentlint init` subcommand (v2)
    src/scan-context.ts cached FS reads + project meta detection
    src/push/           push pipeline
      client.ts         POST /api/runs with project token
      config.ts         .agentlint.json loader (ADR-0020)
      oidc.ts           GitHub Actions OIDC token fetcher (ADR-0019)
      project-lookup.ts GET /api/cli/projects (used by init)
      token.ts          AGENTLINT_TOKEN env resolution
      pr-detect.ts      PR context detection from CI env
      repo-detect.ts    git remote → owner/name
    src/rules/          one file per category, six rules each
    src/report/         terminal, html, json, markdown reporters
```

`core` is depended on by `cli` via `workspace:*` protocol. Never make `core` depend on anything in `cli` — it must stay IO-free for testing.

The web app is in a separate repo at `agentlint/agentlint.sh`. Its v2
schema FKs every business table to `organization.id` (ADR-0018). The CLI
authenticates with a **project token** (`agl_proj_…`), not a user token.

## Conventions

- Language: TypeScript strict mode. No `any` without a `// reason:` comment.
- Naming: kebab-case for files, PascalCase for types, camelCase for functions and variables.
- Imports: workspace imports use `@agentlinthq/core`. Never deep-import.
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

Never commit `.env*` files. The CLI is local-first; nothing requires secrets
at runtime. The only secret the CLI consumes is `AGENTLINT_TOKEN` (a project
token, prefix `agl_proj_`), and it is read from the environment — never
from the checked-in `.agentlint.json` (ADR-0020).

## Branch policy

`main` is PR-gated (ADR-0021). The CLI repo (public) is enforced via GitHub
branch protection; the web app repo (private) is enforced via local
`.githooks/pre-push` + the `branch-policy.yml` CI workflow. New work goes
on `feat/<slug>` → PR into `dev` → PR into `main`.

## Web app environment (`agentlint-sh`)

Sibling repo lives at `/Users/gerardopemz/Code/agentlint-sh` (private,
`github.com/agentlint/agentlint.sh`). It's a Next.js 15 app on Vercel.

| Concern | Where | ADR |
|---|---|---|
| Auth | Better-Auth + GitHub OAuth, Drizzle adapter | — |
| Org plugin | `organization` Better-Auth plugin in `lib/auth.ts` | ADR-0018 |
| Default-org on signup | `databaseHooks.user.create.after` in `lib/auth.ts` | — |
| Project + token model | `db/schema.ts`: `project`, `project_token` | ADR-0018 |
| CLI ingest | `app/api/runs/route.ts` accepts project token + OIDC | ADR-0019 |
| CLI lookup (init) | `app/api/cli/projects/route.ts` | — |
| Repo picker | `app/api/github/repos/route.ts` + dashboard form | ADR-0022 |
| Post-install redirect | `app/api/github/post-install/route.ts` | ADR-0022 |
| Webhook handler | `app/api/github/webhook/route.ts` (installation lifecycle only — push events no longer scan) | ADR-0019 |
| PR-comment orchestrator | `lib/github-app/post-comment.ts` | — |
| Provenance verify | `lib/provenance.ts` (GitHub Actions OIDC JWT) | ADR-0019 |
| Branch policy | `.githooks/pre-push` + `.github/workflows/branch-policy.yml` | ADR-0021 |
| Deploy + alias | `.github/workflows/deploy.yml` (push to main/dev) | ADR-0021 |

### Web env vars (Vercel, by target)

| Var | prod | preview | dev |
|---|---|---|---|
| `DATABASE_URL` | ✅ Neon prod branch | ✅ Neon dev branch | ✅ Neon dev branch |
| `BETTER_AUTH_SECRET` | ✅ | ✅ | ✅ |
| `BETTER_AUTH_URL` | ✅ `https://agentlint.sh` | ✅ `https://preview.agentlint.sh` | ✅ |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | ✅ prod OAuth app | ✅ preview OAuth app | ✅ |
| `GITHUB_APP_ID` | ✅ `3668343` (agentlint-ci) | ✅ `3670537` (agentlint-ci-preview) | ✅ |
| `GITHUB_APP_SLUG` | ✅ `agentlint-ci` | ✅ `agentlint-ci-preview` | ✅ |
| `GITHUB_APP_WEBHOOK_SECRET` | ✅ | ✅ | ✅ |
| `GITHUB_APP_PRIVATE_KEY_B64` | ✅ | ✅ | ✅ |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_*` | ✅ | ✅ | ✅ |

### Web routes (v2)

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/runs` | project token | CLI ingest (OIDC-verified if `x-github-oidc` header) |
| `GET /api/cli/projects` | project token | CLI `init` lookup |
| `POST/GET /api/projects` | session (org member) | create/list projects |
| `GET/PATCH/DELETE /api/projects/:id` | session (admin for write) | project CRUD |
| `POST/GET /api/projects/:id/tokens` | session (admin) | mint/list project tokens |
| `DELETE /api/projects/:id/tokens/:tokenId` | session (admin) | revoke |
| `GET /api/github/repos?orgSlug=...` | session | repo picker source |
| `GET /api/github/post-install` | none (302) | Setup URL target; bounces back to project page |
| `POST /api/github/webhook` | HMAC signature | installation lifecycle |
| `POST /api/stripe/{checkout,portal,webhook}` | session admin / signature | billing |
| `GET /badge/:owner/:name(.svg)` | public | score badge |

## Gotchas

- The CLI is published as `@agentlinthq/cli` on npm; the unscoped `agentlint` and the `agentlint` org name are both unavailable (see [ADR-0011](./docs/DECISIONS.md#adr-0011--publish-under-agentlinthq-org-scope-the-unscoped-agentlint-and-the-org-name-agentlint-are-both-taken)). The installed binary is still `agentlint`. The core package is `@agentlinthq/core`. The workspace name is `agentlint-monorepo`.
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

# Project state

> Living snapshot. Updated by the agent at the close of every session per the
> closing ritual in [`CHARTER.md`](./CHARTER.md#7-closing-session-ritual).
>
> If you are an agent picking up the project, this is the second file to read
> after `CHARTER.md`. It tells you what is shipped, what is in flight, and what
> to pick up next.

**Last updated:** 2026-05-10 by Claude Code (SECURITY.md + leaderboard scaffold)

## Snapshot

| Field | Value |
|---|---|
| Branch | `main` |
| Latest commit | `496fa70` — `feat(leaderboard): scaffold @agentlinthq/leaderboard tool with fetch-repos` |
| Self-audit | 100/100 (24 passes / 0 fails / 0 warnings) |
| Tests | 24 passing (3 core + 14 CLI + 7 leaderboard) |
| Lint | clean (Biome) |
| Typecheck | clean (`tsc --noEmit`) |
| CI | Green on `main` — see [GitHub Actions](https://github.com/agentlint/agentlint/actions) |
| Repository | https://github.com/agentlint/agentlint (public, MIT) |
| npm package | ✅ published — [`@agentlinthq/cli@1.0.0`](https://www.npmjs.com/package/@agentlinthq/cli), [`@agentlinthq/core@1.0.0`](https://www.npmjs.com/package/@agentlinthq/core) |
| GitHub Release | ✅ [v1.0.0](https://github.com/agentlint/agentlint/releases/tag/v1.0.0) |
| GitHub repo settings | ✅ description, topics (13), Discussions enabled, branch protection on `main` (CI required, linear history, no force-push) |
| Domain | ✅ `agentlint.sh` registered via Cloudflare; DNS not yet pointed |
| Landing page | spec drafted at `docs/marketing/landing-page.md`; not built |
| Leaderboard | spec drafted at `docs/marketing/leaderboard.md`; not built |
| Community files | ✅ `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` |
| Leaderboard tool | scaffold landed (`tools/leaderboard/`); only `fetch-repos` stage built; pipeline remainder pending |

## Done — recent

- `SECURITY.md` written: private disclosure via GitHub Security Advisory
  or `security@agentlint.sh` (forwarder pending), severity-keyed fix
  windows, supported versions, safe-harbor clause, hardening notes
  pinning the local-first invariants.
- `tools/leaderboard/` workspace scaffolded — `@agentlinthq/leaderboard`,
  private (never published). v1 lands `fetch-repos` only:
  `buildSearchUrl`, `parseSearchResponse`, `fetchTopRepos` with
  injectable `fetchFn`, required `GITHUB_TOKEN`, paginated, identified
  via `User-Agent`, throws on non-2xx. Seven vitest tests cover URL
  shape, response parsing happy/degraded paths, missing token,
  pagination concatenation, empty-page short-circuit, non-2xx
  surfacing. `pnpm-workspace.yaml` extended to `tools/*` so the new
  tool is picked up by all workspace-recursive scripts. Biome lint
  remains scoped to `packages/*` (config-protection hook blocks edits
  to `biome.json`); follow-up will broaden lint coverage to `tools/*`.
- Domain `agentlint.sh` purchased on Cloudflare. DNS pending — needs two
  records pointed at Vercel (`A`/`CNAME` apex + `CNAME www`) once the
  Vercel project for the landing page is provisioned.
- `CONTRIBUTING.md` written: TL;DR, setup, contribution kinds, what's not
  welcome, conventions, PR workflow, RFC process for new rules, bug
  report template, security disclosure pointer.
- `CODE_OF_CONDUCT.md` adopted Contributor Covenant 2.1 by reference;
  added project-specific reporting and enforcement extensions.
- Verified `agentlint --version` already ships in v1.0.0 (line 19, 36–39
  of `packages/cli/src/index.ts`). No fix needed; `CONTRIBUTING.md`
  cleaned to drop the stale "until that lands" note.
- Both package.jsons (`@agentlinthq/cli`, `@agentlinthq/core`) now point
  `homepage` at `https://agentlint.sh`.
- Landing page content brief written at
  [`docs/marketing/landing-page.md`](./marketing/landing-page.md):
  hero, three value props, why-this-exists, how-it-scores table,
  how-it's-built differentiator, hosted teaser, footer, SEO/GEO with
  schema.org JSON-LD, tech stack, definition-of-done.
- Leaderboard launch-asset spec written at
  [`docs/marketing/leaderboard.md`](./marketing/leaderboard.md): scope,
  pipeline (`fetch-repos` → `clone-and-scan` → `aggregate` → `render`),
  rate-limit hygiene, page design, methodology and anti-gaming clauses,
  blog post outline, schedule, definition-of-done.
- Repository scaffolded: `packages/core` (pure types + score) and
  `packages/cli` (rules, scan-context, reporters).
- 30 rules implemented across 5 categories (discoverability, buildability,
  conventions, documentation, safety). Documentation rules skipped when
  `--url` is not provided.
- Self-audit reaches 100/100 on this repo.
- CI on GitHub Actions runs build → typecheck → lint → test → self-audit on
  Node 22.
- Husky + lint-staged wired for pre-commit Biome runs.
- Conventional Commits enforced by convention (no commitlint yet).
- Initial commit history clean: cosmetic Biome fixes applied, three
  `Map.get(...)!` patterns refactored to `if (cached !== undefined)` checks,
  CI fixed (pnpm setup, Node bump to 22).
- Project constitution established: `CHARTER`, `PROJECT_STATE`, `PLAYBOOK`,
  `DECISIONS`, rewritten `CLAUDE.md` entry point, `README` "How this is
  built" section, agent co-authorship hook in `.husky/prepare-commit-msg`.
- **v1.0.0 published to npm** as `@agentlinthq/cli` and
  `@agentlinthq/core`. The unscoped `agentlint` and the `agentlint` org
  name on npm are both unavailable — see
  [ADR-0011](./DECISIONS.md#adr-0011--publish-under-agentlinthq-org-scope-the-unscoped-agentlint-and-the-org-name-agentlint-are-both-taken).
  Smoke-tested via `pnpm dlx @agentlinthq/cli@1.0.0` on a fresh dir.
- GitHub repo configured: description, 13 topics (`ai`, `agents`,
  `claude-code`, `cursor`, `copilot`, `codex`, `gemini-cli`,
  `agents-md`, `developer-tools`, `lint`, `audit`, `cli`, `ci`),
  Discussions enabled, branch protection on `main` requiring CI.
- GitHub Release [v1.0.0](https://github.com/agentlint/agentlint/releases/tag/v1.0.0)
  created with install instructions and project framing.

## In flight

Nothing actively in progress. Working tree clean as of last update.

## Pending — prioritized

The order below is the agent's recommended execution order. The agent will
walk it top to bottom unless the human redirects.

### P0 — needed before public launch

1. ~~**Reserve npm package names.**~~ ✅ Done. Published v1.0.0 of
   `@agentlinthq/cli` and `@agentlinthq/core` on 2026-05-09. The
   unscoped `agentlint` and `agentlint` org name were unavailable —
   pivoted to `agentlinthq` org. See ADR-0011.
2. ~~**Buy domain.**~~ ✅ Done. `agentlint.sh` registered on Cloudflare
   on 2026-05-10. DNS still needs to be pointed once the Vercel
   project for the landing page is created. **Action item for human:**
   update the GitHub repo "Website" field to `https://agentlint.sh`
   via the UI (the previous PAT was revoked).
3. ~~**Configure GitHub repo settings.**~~ ✅ Done. Description, 13
   topics, Discussions enabled, branch protection on `main` requiring
   CI passing, linear history enforced, no force-push, no deletions.
   Configured via GitHub PAT (revoke after session per the security
   note below).

### P1 — pre-1.0 polish

4. **Landing page** at `agentlint.sh`. Spec ready at
   [`docs/marketing/landing-page.md`](./marketing/landing-page.md).
   Build in a separate repo (`agentlint/agentlint.sh`), Next.js +
   Tailwind, hosted on Vercel. Agent builds; human approves copy and
   provisions Vercel project. **Blocker:** Vercel project +
   Cloudflare DNS record.
5. **Leaderboard launch asset.** Spec ready at
   [`docs/marketing/leaderboard.md`](./marketing/leaderboard.md);
   `fetch-repos` stage scaffolded under `tools/leaderboard/`. Remaining
   pipeline stages: `clone-and-scan`, `aggregate`, `render-page`,
   `render-blog`. Needs a read-only public GitHub token at runtime.
6. ~~**CONTRIBUTING.md.**~~ ✅ Shipped this session.
7. ~~**CODE_OF_CONDUCT.md.**~~ ✅ Shipped this session — Contributor
   Covenant 2.1 by reference, with project-specific reporting and
   enforcement section.
8. ~~**`agentlint --version`**~~ ✅ Already shipped in v1.0.0; verified
   this session. No code change needed.

### P2 — 1.x roadmap

9. **Hosted dashboard** (separate repo): Next.js + Convex, GitHub OAuth,
   run history, badges, GitHub App for PR comments, Stripe billing
   ($19/mo Pro, $99/mo Team). See [`DECISIONS.md`](./DECISIONS.md) for
   the pricing rationale.
10. **`agentlint --push`** to upload reports to the hosted dashboard.
    Opt-in only; never default.
11. **More rules.** Candidates: `.well-known/agents.txt`, MCP server
    manifests, more granular CI/CD agent-readiness signals.

## Next milestones

- **M1 — npm reserved + domain bought.** Unblocks public landing page.
- **M2 — Landing page live.** Unblocks launch.
- **M3 — Public launch.** HN post, X thread, PH listing, leaderboard
  blog post all on the same day. Coordinated by the agent, signed off by
  the human.
- **M4 — Hosted dashboard MVP.** First paying user.

## Maintenance ritual (each session)

The agent runs this at session end:

1. `pnpm run ci` → must pass.
2. `pnpm run agentlint .` → must report 100/100.
3. Update this file's snapshot, done, in flight, pending sections.
4. Append to `DECISIONS.md` if any non-obvious choices were made.
5. Commit (`docs: update PROJECT_STATE`) and push.
6. Send the 3-bullet summary to the human: shipped / pending / next.

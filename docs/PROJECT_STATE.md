# Project state

> Living snapshot. Updated by the agent at the close of every session per the
> closing ritual in [`CHARTER.md`](./CHARTER.md#7-closing-session-ritual).
>
> If you are an agent picking up the project, this is the second file to read
> after `CHARTER.md`. It tells you what is shipped, what is in flight, and what
> to pick up next.

**Last updated:** 2026-05-09 by Claude Code (v1.0.0 release session)

## Snapshot

| Field | Value |
|---|---|
| Branch | `main` |
| Latest commit | `f01311c` — `chore(release): rename npm scope to @agentlinthq` |
| Self-audit | 100/100 (24 passes / 0 fails / 0 warnings) |
| Tests | 17 passing (3 core + 14 CLI) |
| Lint | clean (Biome) |
| Typecheck | clean (`tsc --noEmit`) |
| CI | Green on `main` — see [GitHub Actions](https://github.com/agentlint/agentlint/actions) |
| Repository | https://github.com/agentlint/agentlint (public, MIT) |
| npm package | ✅ published — [`@agentlinthq/cli@1.0.0`](https://www.npmjs.com/package/@agentlinthq/cli), [`@agentlinthq/core@1.0.0`](https://www.npmjs.com/package/@agentlinthq/core) |
| GitHub Release | ✅ [v1.0.0](https://github.com/agentlint/agentlint/releases/tag/v1.0.0) |
| GitHub repo settings | ✅ description, topics (13), Discussions enabled, branch protection on `main` (CI required, linear history, no force-push) |
| Domain | **not registered yet** — `agentlint.dev` planned |
| Landing page | not built |

## Done — recent

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
2. **Buy domain.** Original target `agentlint.dev` is taken; pivot to
   `agentlint.sh` (recommended — devs read `.sh` as "real CLI";
   precedent: `vercel.sh`). Backups: `agentlint.run`, `useagentlint.com`.
   ~$15–40/yr at Cloudflare Registrar or Porkbun. **Blocker: human
   purchase.**
3. ~~**Configure GitHub repo settings.**~~ ✅ Done. Description, 13
   topics, Discussions enabled, branch protection on `main` requiring
   CI passing, linear history enforced, no force-push, no deletions.
   Configured via GitHub PAT (revoke after session per the security
   note below).

### P1 — pre-1.0 polish

4. **Landing page** at `agentlint.dev`. Single-page Next.js: hero
   (`npx @agentlinthq/cli`), three value props, terminal demo, pricing teaser,
   footer. Hosted on Vercel. New repo `agentlint/agentlint.dev`. Agent
   builds; human approves copy and provisions Vercel project.
5. **Leaderboard launch asset.** Script that scans top-1000 GitHub repos by
   stars, generates a "State of agent-readiness" blog post with a sortable
   HTML leaderboard. SEO/GEO bait for launch. Needs a read-only public
   GitHub token.
6. **CONTRIBUTING.md** that explicitly invites both human and agent
   contributors and explains how to propose a new rule.
7. **CODE_OF_CONDUCT.md** (Contributor Covenant 2.1).
8. **`agentlint --version`** prints the package version (currently it
   doesn't, by inspection of the bin entry).

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

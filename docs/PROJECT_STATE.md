# Project state

> Living snapshot. Updated by the agent at the close of every session per the
> closing ritual in [`CHARTER.md`](./CHARTER.md#7-closing-session-ritual).
>
> If you are an agent picking up the project, this is the second file to read
> after `CHARTER.md`. It tells you what is shipped, what is in flight, and what
> to pick up next.

**Last updated:** 2026-05-10 by Claude Code (overnight MVP — agentlint.sh app + leaderboard pipeline + launch copy)

## Snapshot

| Field | Value |
|---|---|
| Branch | `main` |
| Latest commit | `3950173` — `feat(leaderboard): add clone-and-scan, aggregate, and render stages` |
| Self-audit | 100/100 (24 passes / 0 fails / 0 warnings) |
| Tests | 36 passing (3 core + 14 CLI + 19 leaderboard) |
| Lint | clean (Biome) |
| Typecheck | clean (`tsc --noEmit`) |
| CI | Green on `main` |
| Repository | https://github.com/agentlint/agentlint (public, MIT). Website field: ✅ `https://agentlint.sh` |
| npm package | ✅ [`@agentlinthq/cli@1.0.0`](https://www.npmjs.com/package/@agentlinthq/cli), [`@agentlinthq/core@1.0.0`](https://www.npmjs.com/package/@agentlinthq/core) |
| GitHub Release | ✅ [v1.0.0](https://github.com/agentlint/agentlint/releases/tag/v1.0.0) |
| Community files | ✅ `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` |
| Domain | ✅ `agentlint.sh` registered (Cloudflare). DNS records prepared (see `docs/marketing/dns-cloudflare.md`); apex/www added to Vercel project. **DNS still needs to be applied at Cloudflare.** |
| Landing app | ✅ deployed — repo `agentlint/agentlint.sh`, live at https://agentlint-h7tzcx0jl-agentlint.vercel.app/ (will move to `agentlint.sh` once DNS resolves). Routes `/`, `/pricing`, `/login`, `/leaderboard`, `/dashboard` (auth-gated). |
| Auth | ✅ better-auth + GitHub OAuth + Drizzle adapter; sessions persisted in Neon Postgres |
| Database | ✅ Neon Postgres — separate prod and dev branches; schema migrated to both via `drizzle-kit push` |
| Billing | ✅ Stripe test-mode wired end-to-end: products and recurring prices created (Pro $19/mo `price_1TVSfe9F4iHrjiRHkNR8TDfJ`, Team $99/mo `price_1TVSff9F4iHrjiRHwDarGSNC`), Checkout, Customer Portal, signature-verifying webhook. Webhook secret set in Vercel. |
| Leaderboard tool | ✅ pipeline functions complete (`fetch-repos`, `clone-and-scan`, `aggregate`, `render`). Bin entrypoint and first run still pending. |
| Launch copy | ✅ HN Show post, X thread, Product Hunt listing — `docs/marketing/launch-*.md` |

## Done — recent

### Overnight MVP session (2026-05-10)

- **`agentlint/agentlint.sh` repository created** via API (PAT-driven, no
  human UI step). Cloned locally to `~/Code/agentlint-sh/`. Same repo
  ships landing, pricing, auth, dashboard, leaderboard placeholder.
- **Next.js 15.5 app scaffolded.** Tailwind v4 with CSS-first theme
  config, dark palette, monospace accents. Routes:
  `/` (hero + 3-up + why + scoring rubric + how-it's-built + hosted
  teaser + footer), `/pricing` (Free/Pro/Team tiers, Pro highlighted,
  Stripe Checkout), `/login` (GitHub OAuth via better-auth),
  `/dashboard` (auth-gated, shows plan + Customer Portal),
  `/leaderboard` (placeholder with methodology and anti-gaming clauses
  pre-written for SEO).
- **Auth: better-auth + GitHub OAuth + Drizzle.** Session, account,
  user, verification, subscription tables. 30-day session.
  `/api/auth/[...all]` route serves the full handler.
- **DB: Neon Postgres.** Two databases — `prod` and `dev`. Schema
  migrated to both via `drizzle-kit push`.
- **Billing: Stripe test-mode end-to-end.** Products and recurring
  prices created via API (Pro $19/mo, Team $99/mo). Three routes:
  `/api/stripe/checkout`, `/api/stripe/portal`, `/api/stripe/webhook`.
  Webhook signature verified, subscription state upserted on
  subscription/checkout events. Webhook endpoint registered in Stripe
  pointing at `https://agentlint.sh/api/stripe/webhook`; secret set in
  Vercel env.
- **Vercel deploy.** Pre-existing project linked locally via
  `.vercel/project.json`. All env vars set programmatically (Database,
  better-auth, GitHub OAuth, Stripe keys + webhook secret + price IDs).
  SSO protection on deployment URLs disabled. Production deploy live
  at the temporary `*.vercel.app` URL; routes verified (200 / 200 / 200
  / 200, dashboard 307→/login). Custom domains `agentlint.sh` and
  `www.agentlint.sh` added to project. Will go live once DNS at
  Cloudflare is applied.
- **Leaderboard pipeline (TDD, vertical).** Three new modules in
  `tools/leaderboard/src/`: `clone-and-scan` (parses agentlint JSON
  reports, runs the CLI against a shallow clone via injectable
  execFn), `aggregate` (merges scan results with metadata, sorts by
  score with stars as tiebreaker, ranks the scored rows, pushes
  failures to the bottom), `render` (JSON serializer + escaped HTML
  table). 19 vitest tests (was 7).
- **Launch copy drafts.** `docs/marketing/launch-hn.md` (Show HN with
  prepared answers to likely objections), `launch-x-thread.md`
  (9-tweet thread, no emojis, dev-first tone), `launch-product-hunt.md`
  (tagline, description, full maker-comment, gallery / hunter
  guidance).
- **GitHub Website field set on `agentlint/agentlint`** to
  `https://agentlint.sh` via API.
- **Self-audit 100/100 maintained throughout. Tests: 36 (3 core + 14
  CLI + 19 leaderboard).**

### Prior

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

### P1 — pre-launch (action items for human)

4. **Apply Cloudflare DNS records** so `agentlint.sh` resolves to
   Vercel. Records (proxy = DNS only, gray cloud, NOT orange):
   - `A` `@` → `216.198.79.1`
   - `CNAME` `www` → `cname.vercel-dns.com.`
   Vercel verifies automatically and provisions the cert within minutes.
5. **Install the Vercel GitHub App** on the `agentlint` org so future
   pushes to `agentlint/agentlint.sh` auto-deploy:
   <https://github.com/apps/vercel> → "Configure" → install on
   `agentlint` org → grant access to `agentlint.sh` repo. Then in
   Vercel UI: Project Settings → Git → "Connect Git Repository" →
   pick `agentlint/agentlint.sh`.
6. **Smoke-test the purchase flow.** Visit
   `https://agentlint.sh/pricing` → "Subscribe" → check out with
   Stripe test card `4242 4242 4242 4242`, any future date, any CVC.
   Verify subscription appears at `/dashboard` and the row exists in
   the `subscription` table on Neon prod.
7. **Switch Stripe to live mode** when ready. Create live products and
   prices (or copy the test ones), generate live publishable + secret
   keys, generate live webhook signing secret, update the four
   Stripe-related Vercel env vars. Charter says never auto-flip live
   mode — always a human decision.
8. **Leaderboard first run.** Pipeline functions are written and
   tested (`fetch-repos`, `clone-and-scan`, `aggregate`, `render`),
   but the runner bin and the GitHub Action that triggers it weekly
   are not yet wired. Next session:
   - `tools/leaderboard/src/run.ts` — bin entrypoint that orchestrates
     the four stages, writes `data/aggregated/<date>.json` and
     `out/leaderboard.html`.
   - GitHub Action in `agentlint/agentlint.sh` that fetches the
     latest aggregated JSON and serves it at `/leaderboard`.
   - First public run scored against top 100 (not 1000) for sanity,
     then ramp.

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

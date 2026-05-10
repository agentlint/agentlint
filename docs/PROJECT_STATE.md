# Project state

> Living snapshot. Updated by the agent at the close of every session per the
> closing ritual in [`CHARTER.md`](./CHARTER.md#7-closing-session-ritual).
>
> If you are an agent picking up the project, this is the second file to read
> after `CHARTER.md`. It tells you what is shipped, what is in flight, and what
> to pick up next.

**Last updated:** 2026-05-10 by Claude Code (slice 4 prod cutover + smoke test green; `agentlint --push` end-to-end live)

## Snapshot

| Field | Value |
|---|---|
| Branch | `main` |
| Latest commit | `7fcf0e6` — `docs(cli): document --push flag and security model` (CLI repo); `c2c192f` — `fix(deps): sync pnpm-lock.yaml after zod + vitest add` (agentlint.sh repo) |
| Self-audit | 100/100 (24 passes / 0 fails / 0 warnings) |
| Tests | CLI repo: 52 passing (3 core + 14 CLI rules + 38 push + 19 leaderboard subset shown). Web repo: 29 passing (16 token unit + 3 ulid + 3 rate-limit + 7 ingest integration). |
| Lint | clean (Biome) |
| Typecheck | clean (`tsc --noEmit`) |
| CI | Green on `main` |
| CLI repository | ✅ https://github.com/agentlint/agentlint (public, MIT). Website field: `https://agentlint.sh` |
| Web repository | ✅ https://github.com/agentlint/agentlint.sh (**private** as of 2026-05-10 — see ADR-0013). 4 dependabot alerts open (2 high, 2 moderate); triage pending. |
| npm package | ✅ [`@agentlinthq/cli@1.0.0`](https://www.npmjs.com/package/@agentlinthq/cli), [`@agentlinthq/core@1.0.0`](https://www.npmjs.com/package/@agentlinthq/core) |
| GitHub Release | ✅ [v1.0.0](https://github.com/agentlint/agentlint/releases/tag/v1.0.0) |
| Community files | ✅ `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` |
| Domain | ✅ `agentlint.sh` live in production via Cloudflare DNS (apex + www). Preview deployments at `previo.agentlint.sh`. |
| Landing app | ✅ deployed at https://agentlint.sh. Routes `/`, `/pricing`, `/login`, `/leaderboard` (placeholder), `/dashboard` (auth-gated), legal pages. Auto-deploy via `.github/workflows/deploy.yml` (push to main → prod, PR → preview). Vercel built-in git integration is **disconnected** because Hobby doesn't allow deploying private org repos — see ADR-0014. |
| Auth | ✅ better-auth + GitHub OAuth + Drizzle adapter; sessions persisted in Neon Postgres |
| Database | ✅ Neon Postgres — separate prod and dev branches; schema migrated to both via `drizzle-kit push` |
| Billing | ⚠️ **Paid tiers pulled from UI on 2026-05-10** (see ADR-0012). Stripe routes (`/api/stripe/checkout`, `/portal`, `/webhook`) remain deployed; products + recurring prices + webhook secret remain provisioned. `/pricing` shows Pro/Team as `Coming soon` with `Notify me at launch` mailto CTAs. Smoke-tested end-to-end before pulling — checkout, webhook, dashboard sub display, customer portal all verified. Re-enabling = revert `app/pricing/page.tsx`. |
| Leaderboard tool | ✅ pipeline functions complete (`fetch-repos`, `clone-and-scan`, `aggregate`, `render`). Bin entrypoint and first run still pending. |
| Launch copy | ✅ HN Show post, X thread, Product Hunt listing — `docs/marketing/launch-*.md` |

## Done — recent

### Slice 4 prod cutover + smoke test (2026-05-10, late evening)

- **Schema migrated to Neon prod branch** via `drizzle-kit push`
  with the prod `DATABASE_URL` from `vercel env pull`. `api_token`
  + `run` tables now exist on prod with the indexes specified in
  ADR-0015.
- **`NEXT_PUBLIC_PUSH_ENABLED=true` set in Vercel prod env** via
  `vercel env add` and a fresh `vercel deploy --prod`. The
  dashboard runs list and the `Manage tokens →` link are now
  visible to authenticated users in prod.
- **End-to-end smoke test passed in prod (twice).** A synthetic
  token was inserted directly into `api_token` (matched the
  generator's hashing/encoding so the server's `looksLikeToken`
  check succeeds), then exercised two ways: (1) raw `curl POST
  /api/runs` with the bearer → HTTP 201, run row landed,
  `lastUsedAt` bumped; (2) real CLI build + `AGENTLINT_TOKEN=…
  AGENTLINT_URL=https://agentlint.sh node
  packages/cli/dist/index.js --push .` → self-audit 100/100,
  `Pushed: https://agentlint.sh/dashboard` printed, second row
  landed. Smoke token + both runs cleaned up afterward; the prod
  `run` and `api_token` tables are empty so real users see the
  intended empty-state copy.
- **Production credentials no longer cached on disk.**
  `.env.production.local` removed after the cutover.

### Slice 4 ship session (2026-05-10, evening)

- **`agentlint --push` shipped end-to-end** behind a feature flag.
  PRD locked at `docs/prds/agentlint-push-ingest.md`. Two parallel
  general-purpose subagents executed in clean contexts: one in the
  CLI repo (issue 4 of the PRD), one in the web repo (issues 1–3).
  Both pushed their own commits to `main`.
- **CLI repo (`agentlint/agentlint`):**
  `feat(cli): add --push flag to upload reports` (a78f6fa) +
  `test(cli): cover token resolver, push client, repo detect`
  (bc08e44) + `docs(cli): document --push flag and security model`
  (7fcf0e6). 38 new tests (token resolver, HTTP client, repo
  detection from `git remote.origin.url`). Self-audit holds at
  100/100. Local-first invariant intact: no network call without
  the explicit `--push` flag.
- **Web repo (`agentlint/agentlint.sh`):**
  `feat(api): add api_token + run schema and tokens API` (10d10ea) +
  `feat(api): add /api/runs ingest endpoint with bearer auth and
  rate limit` (ae583f7) + `feat(dashboard): tokens page + recent
  runs list behind feature flag` (bdf5a16) +
  `fix(deps): sync pnpm-lock.yaml after zod + vitest add`
  (c2c192f, autonomous post-merge fix). 29 tests across 4 files.
  Schema migrated to Neon **dev** branch only. UI gated by
  `NEXT_PUBLIC_PUSH_ENABLED` (off in Vercel prod).
- **`docs/DECISIONS.md` ADR-0015** captures the eleven non-PRD
  calls both subagents made (hand-rolled base32 + ULID, no
  interactive transaction in `neon-http`, `looksLikeToken` shape
  pre-check, bearer-hash index, `--url` overloading,
  `AGENTLINT_INSECURE` env-only, `--push` exits 0 on no-token,
  push line at the bottom of stdout, feature flag default-off,
  prod migration deferred to smoke test, lockfile-sync lesson for
  future agents).
- **Production deploy verified**: GH Action run `25636783751`
  green in 1m22s after the lockfile fix. Production renders as
  before (push UI hidden by flag); routes are live and ready for
  the cross-repo smoke test.

### Post-launch hardening session (2026-05-10, afternoon)

- **Cloudflare DNS applied — site live at `agentlint.sh` and
  `previo.agentlint.sh`** (preview deployments).
- **Stripe purchase flow smoke-tested end-to-end** with test card
  `4242 4242 4242 4242`. Checkout → webhook → subscription row in
  Neon prod → dashboard display → customer portal — all verified.
- **Paid tiers pulled from `/pricing` and `/dashboard`** (see
  ADR-0012). Subscribe buttons replaced with `Notify me at launch`
  mailto links; `Coming soon` badges added; status banner on the
  pricing page tells visitors what's real. Stripe routes left intact
  for one-PR re-enable when hosted features ship.
- **`agentlint/agentlint.sh` repo flipped to private** (see
  ADR-0013). CLI repo stays public/MIT. Hosted-layer schema, Stripe
  wiring, dashboard implementation no longer publicly readable.
- **Deploy moved to GitHub Actions + Vercel CLI** (see ADR-0014).
  Vercel Hobby refuses to deploy from private org repos via git
  integration; built `.github/workflows/deploy.yml` that calls
  `vercel deploy` from CI with a project-scoped token. Manual
  prod deploy executed during the cutover so the pricing pull
  finally landed in production (was sitting on a stale build for
  ~30 min after the repo went private). Vercel git integration
  disconnected; three secrets seeded (`VERCEL_TOKEN`,
  `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`).
- **DECISIONS log updated** — ADR-0012 (pull paid tiers),
  ADR-0013 (web repo private), ADR-0014 (GitHub Actions deploy).
- **New project skill `agentlint-feature-pipeline`** at
  `.claude/skills/agentlint-feature-pipeline/SKILL.md` — drives the
  hosted-dashboard build forward autonomously: pick the next P1
  vertical slice from PROJECT_STATE, run grill-me → to-prd →
  to-issues → tdd, close out, push. Travels with the repo so any
  agent picking up the codebase can run it via
  `/agentlint-feature-pipeline`.

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

### P1 — unblock paid tiers (must ship before re-enabling Stripe)

The order below is the minimum hosted-dashboard surface required to
re-enable Pro/Team subscriptions in good faith. Each line item is a
**vertical slice** — the database table, API route, CLI flag (if
any), and UI for that one feature live in the same PR. Do not
horizontally scaffold the whole schema first.

4. ~~**`agentlint --push` + report ingest**~~ ✅ Shipped + smoke
   tested in prod 2026-05-10. See ADR-0015 and the "Slice 4 ship
   session" entry under "Done — recent". Schema applied to Neon
   **prod** branch. `NEXT_PUBLIC_PUSH_ENABLED=true` set in Vercel
   prod env. End-to-end verified twice: synthetic curl POST
   (HTTP 201 + row in `run` + `lastUsedAt` bumped) and real CLI
   `agentlint --push` against prod (score 100/100, `Pushed:` line
   printed, second row landed). Smoke artifacts cleaned up; prod
   tables empty for real users.
5. **Run history on `/dashboard`** — list of past runs, score trend,
   pass/fail diff vs. previous run. Vertical slice: read-side query,
   chart component, empty state.
6. **Public score badge** — SVG endpoint `/badge/:owner/:repo.svg`
   reads the most recent public run for that repo. Vertical slice:
   public-flag column on `runs`, SVG renderer, README copy snippet on
   `/dashboard`.
7. **GitHub App for PR comments** — App posts a comment with score
   diff on every PR push. Vertical slice: GitHub App registration,
   webhook handler, install flow on `/dashboard`, comment template.
8. **Org-level dashboard (Team)** — list of repos in an org with
   their latest scores. Vertical slice: `org` membership table, query,
   UI tab, gating by Team subscription.
9. **Policy thresholds (Team)** — org admins can set a minimum
   passing score; CLI reads the org policy via `--push` response and
   exits non-zero if below threshold. Vertical slice: policy table,
   read endpoint, CLI handling, UI editor.

Once 4–9 ship, revert ADR-0012 (re-enable Pro/Team in `/pricing`),
flip Stripe to live mode, announce in the Pro changelog.

### P1 — leaderboard launch (parallel track, no Stripe dependency)

10. **Leaderboard runner + first public run.** Pipeline functions are
    written and tested (`fetch-repos`, `clone-and-scan`, `aggregate`,
    `render`); orchestration and a public page are not. Vertical slice:
    - `tools/leaderboard/src/run.ts` — bin entrypoint that orchestrates
      the four stages, writes `data/aggregated/<date>.json` and
      `out/leaderboard.html`.
    - Weekly GitHub Action in `agentlint/agentlint.sh` (or the CLI
      repo) that runs the pipeline and commits the aggregated JSON.
    - `/leaderboard` page in `agentlint.sh` reads the latest JSON
      (build-time or revalidate-on-request) and renders the table.
    - First public run scored against top 100 (not 1000) for sanity,
      then ramp.

### P1 — hygiene

11. **Triage 4 dependabot alerts on `agentlint/agentlint.sh`** (2
    high, 2 moderate). Auto-merge after CI if low blast-radius;
    investigate otherwise.
12. **Switch Stripe to live mode** — only after 4–9 ship and ADR-0012
    is reverted. Create live products + prices, regenerate webhook
    secret, update four Vercel env vars. Charter says never
    auto-flip — always a human decision.

### P2 — 1.x roadmap

13. **More rules.** Candidates: `.well-known/agents.txt`, MCP server
    manifests, more granular CI/CD agent-readiness signals.
14. **Annual plans, educational discounts, enterprise pricing page.**

## Next milestones

- ~~**M1 — npm reserved + domain bought.**~~ ✅ Done.
- ~~**M2 — Landing page live.**~~ ✅ Done. `agentlint.sh` resolves;
  Vercel auto-deploys on push.
- **M3 — Hosted dashboard MVP.** Vertical features 4–9 above ship,
  ADR-0012 reverts, Pro/Team re-enabled, Stripe flips live. Target:
  one feature per PR, TDD, parallel agents on independent slices.
- **M4 — First paying user.** Public announcement of paid tiers,
  ingest at least one PR comment + badge in the wild.
- **M5 — Public leaderboard.** First weekly run published, blog post
  out, HN/X/PH coordinated launch.

## Maintenance ritual (each session)

The agent runs this at session end:

1. `pnpm run ci` → must pass.
2. `pnpm run agentlint .` → must report 100/100.
3. Update this file's snapshot, done, in flight, pending sections.
4. Append to `DECISIONS.md` if any non-obvious choices were made.
5. Commit (`docs: update PROJECT_STATE`) and push.
6. Send the 3-bullet summary to the human: shipped / pending / next.

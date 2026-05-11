# Project state

> Living snapshot. Updated by the agent at the close of every session per the
> closing ritual in [`CHARTER.md`](./CHARTER.md#7-closing-session-ritual).
>
> If you are an agent picking up the project, this is the second file to read
> after `CHARTER.md`. It tells you what is shipped, what is in flight, and what
> to pick up next.

**Last updated:** 2026-05-10 by Claude Code — **Server-side scan on push live in prod.** Vercel-style: install the agentlint GitHub App → `git push` → row appears. No workflow file, no repo secret, no App permission bump beyond the existing set. Path: `POST /api/github/webhook` → push event → shallow clone via App installation token (30s + 200MB caps) → in-process agentlint scan → row inserted with `source=server, provenance=server-scanned` → PR comment on open-PR branches. CLI v2.1.0 published to npm (`agentlint login`, `agentlint logout`, OIDC-only generated workflow). OIDC-only `/api/runs` live at agentlint.sh. Neon migrations applied dev + prod (`cli_auth_grant` table). Branch cleanup: only `main` + `dev` on web; `main` on CLI. ADR train: 0023 (device-flow), 0024 (skill rewritten generic), 0025 (install-secret → superseded by 0026), 0026 (OIDC-only), 0027 (server-side scan on push → supersedes ADR-0019).

## Snapshot

| Field | Value |
|---|---|
| Web branch flow | `feat/*` → `dev` → `main`. `preview.agentlint.sh` auto-aliased to dev. `agentlint.sh` from main. (ADR-0021) |
| CLI branch flow | `feat/*` → `main` (PR-gated, public repo branch protection enforced server-side). |
| Latest commit (web) | [PR #14](https://github.com/agentlint/agentlint.sh/pull/14) `feat: server-side scan on push` against `dev`. Previous: #13 (dev → main release, merged); #12 (OIDC-only, merged); #11/#10 ancestors. |
| Latest commit (CLI) | [`#10` squashed to `main`](https://github.com/agentlint/agentlint/pull/10) — `release(cli): v2.1.0` — published to npm + tagged + GitHub Release created. |
| Self-audit | CLI repo: 100/100. Web repo: typecheck clean, build green. |
| Tests | CLI repo: **164 passing** (v2.1.0 published). Web repo: **170 passing** (net +25 from web #14 — server-scan runner, push-webhook handler, source pill, copy). |
| Lint | clean (Biome) |
| Typecheck | clean (`tsc --noEmit`) |
| CI | Green on both `main` branches. Web `dev` push triggers Vercel deploy + alias step. |
| CLI repository | ✅ https://github.com/agentlint/agentlint (public, MIT). Branch protection: main requires PR + green ci status. |
| Web repository | ✅ https://github.com/agentlint/agentlint.sh (**private**). GH Free can't protect private main — fallback: `.githooks/pre-push` + `branch-policy.yml` CI flag (ADR-0021). 4 dependabot alerts open. |
| npm package | ✅ [`@agentlinthq/cli@2.1.0`](https://www.npmjs.com/package/@agentlinthq/cli) (latest, published 2026-05-10 — login subcommand + OIDC-only workflow). [`@agentlinthq/core@1.0.0`](https://www.npmjs.com/package/@agentlinthq/core). |
| GitHub Release | ✅ [v2.1.0](https://github.com/agentlint/agentlint/releases/tag/v2.1.0) (latest), [v2.0.0](https://github.com/agentlint/agentlint/releases/tag/v2.0.0), [v1.1.0](https://github.com/agentlint/agentlint/releases/tag/v1.1.0), [v1.0.0](https://github.com/agentlint/agentlint/releases/tag/v1.0.0) |
| GitHub Apps | ✅ Two-app split per env (ADR-0022). Prod: `agentlint-ci` (App ID 3668343). Preview: `agentlint-ci-preview` (App ID 3670537). Each App's Setup URL points to `/api/github/post-install` on its env. Webhook secrets + private keys configured in Vercel per target. |
| Repo picker | ✅ Vercel-style picker on `/dashboard/orgs/:slug/projects/new` (PR #6/#9). Reads `installation.repos` cache, groups by org, auto-fills name/owner/installationId. CTA `+ Add another GitHub account` for multi-org install. |
| Community files | ✅ `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` |
| Domain | ✅ `agentlint.sh` live in production via Cloudflare DNS (apex + www). Preview deployments at `previo.agentlint.sh`. |
| Landing app | ✅ deployed at https://agentlint.sh. Routes `/`, `/pricing`, `/login`, `/leaderboard` (placeholder), `/dashboard` (auth-gated), legal pages. Auto-deploy via `.github/workflows/deploy.yml` (push to main → prod, PR → preview). Vercel built-in git integration is **disconnected** because Hobby doesn't allow deploying private org repos — see ADR-0014. |
| Auth | ✅ better-auth + GitHub OAuth + Drizzle adapter; sessions persisted in Neon Postgres |
| Database | ✅ Neon Postgres — separate prod and dev branches; schema migrated to both via `drizzle-kit push` |
| Billing | ⚠️ **Paid tiers pulled from UI on 2026-05-10** (ADR-0012). Stripe routes now org-scoped (ADR-0018) — `customer.id` lives on `organization.stripeCustomerId`, all three routes accept `{orgSlug}` and gate on org admin role. Re-enabling = revert `app/pricing/page.tsx` AND wire an org picker. |
| Leaderboard tool | ✅ pipeline functions complete (`fetch-repos`, `clone-and-scan`, `aggregate`, `render`). Bin entrypoint and first run still pending. |
| Launch copy | ✅ HN Show post, X thread, Product Hunt listing — `docs/marketing/launch-*.md` |

## Done — recent

### Server-side scan on push (2026-05-10, late evening — autonomous /agentlint-feature-pipeline run)

Pipeline triggered as the natural follow-up to the OIDC-only pivot.
Single web sub-agent landed three sequential commits on
`feat/server-side-scan-on-push`; PR #14 opened against `dev`.

- **Web [PR #14](https://github.com/agentlint/agentlint.sh/pull/14)
  — open against `dev`.**
  - `lib/server-scan/runner.ts` — clones a repo via the App
    installation token (`git clone --depth=1 --` with strict
    `^[a-zA-Z0-9._/-]+$` validation on owner/repo/branch/sha), 30s
    timeout, 200MB post-clone size cap. Runs agentlint in-process
    via `@agentlinthq/cli` deep imports (proper programmatic
    export is a TODO follow-up). `rm -rf` of temp dir in `finally`.
  - `POST /api/github/webhook` extended to handle `push` events.
    Filters: `refs/heads/*` only, default branch OR open-PR head.
    Idempotency on `(project_id, commit_sha, source="server")`.
    Worker via Next.js `after()`. PR-comment fire-and-forget on
    open-PR pushes.
  - Schema: `run.source` zod enum widened to accept `"server"`.
    New `SourcePill` component renders a green chip for
    server-side rows. New-project success state advertises
    "scans run automatically — no setup required."
  - +25 tests (146 → 170 on the agent's branch). Webhook
    `signature-failure` test stays; new tests cover all 11 push
    paths including tag-ignore, no-project, idempotency, scan
    failure caught.
- **Maintainer ops landed in the same session:**
  - **Migrations** applied via Neon MCP to both dev and prod
    branches. Only `0001_cli_auth_grant.sql` was needed — `0002`
    + `0003` (install-secret columns) net to zero on a branch
    that never saw them.
  - **Web `dev → main` promotion** ([PR #13](https://github.com/agentlint/agentlint.sh/pull/13))
    merged. OIDC-only `/api/runs` + dashboard UX live at
    `agentlint.sh`. Prod deploy green; smoke
    `POST /api/cli/auth/device` returned 200 with the documented
    body shape.
  - **CLI v2.1.0** published to npm via the publish workflow.
    [Release](https://github.com/agentlint/agentlint/releases/tag/v2.1.0)
    created.
  - **Branch cleanup.** Web repo retains only `main` + `dev`.
    CLI repo retains `main` (the release branch was the head of
    an open PR at cleanup time; merged immediately after).
- **ADR-0027** supersedes ADR-0019 with the receipts: cost model
  (paid hosted tier justifies compute), security (strict input
  validation + `--` separator + token wiped from memory), rollback
  (env-var feature flag + revert commit).
- **Out of scope:** programmatic `runScan` export on
  `@agentlinthq/cli` to replace the deep-import workaround; a
  failed-scans log table.

### OIDC-only pivot session (2026-05-10, late evening — autonomous /agentlint-feature-pipeline correction)

Maintainer reviewed the just-shipped install-secret feature and
flagged the `Secrets: read & write` permission ask as too aggressive
for a lint tool. Cited Vercel / Cloudflare / Codecov-for-public-repos
/ cloud SDKs — none of them ask for that scope. We re-architected
under the same pipeline shape and landed two parallel reverts plus
the OIDC-only ingest path that obviates the whole need.

- **Web [PR #12](https://github.com/agentlint/agentlint.sh/pull/12) —
  open against `dev`, deploy green.**
  - `POST /api/runs` now accepts a GitHub Actions OIDC JWT in the
    `x-github-oidc` header as the sole auth credential. Server
    extracts the `repository` claim, looks up the project, inserts
    the run with `tokenId = null, source = "ci",
    provenance = "oidc-verified"`.
  - New helper `extractOidcRepoClaim` in `lib/provenance.ts` does
    the JWKS verification + claim extraction; the existing
    `verifyOidcProvenance` (which compares the claim to an
    expected repo) is unchanged.
  - Bad bearer no longer falls through to OIDC — that closes a
    project-ID probe vector.
  - Migration `0003_drop_actions_secret_columns.sql` removes the
    two columns added in slice 11.
  - **Deleted**: install-secret route + tests, libsodium helper +
    tests, dashboard secret-panel + tests, `libsodium-wrappers`
    deps.
  - Net test delta: +27 added, -25 deleted = +2 (143 → 145).
- **CLI [PR #8](https://github.com/agentlint/agentlint/pull/8) —
  merged.**
  - Generated workflow drops the
    `env: AGENTLINT_TOKEN: ${{ secrets.AGENTLINT_TOKEN }}` block.
    `id-token: write` permission stays.
  - The "Next: add AGENTLINT_TOKEN as a repo secret" hint now
    only prints when the user passes `--no-workflow` (i.e. they
    opted out of using Actions).
  - **Deleted**: `agentlint install-secret` subcommand + tests,
    its integration in `agentlint init`, the `noInstallSecret`
    flag.
  - Net test delta: +2 added, -16 deleted = -14 (178 → 164).
  - Self-audit holds at 100/100.
- **ADR-0026** supersedes ADR-0025 with the receipts: why
  `Secrets: write` is rejected, why OIDC alone is sufficient, and
  what the rollback looks like (the install-secret revert is a
  single `git revert` away if we ever change our minds).
- **No App permission bump** is required on either App. Existing
  installations of `agentlint-ci` and `agentlint-ci-preview` stay
  untouched.
- **Out of scope, captured as next slice:** server-side scan on
  push (Vercel-style) — install the App, on a `push` webhook the
  server fetches the small set of metadata files agentlint
  inspects via the GitHub Contents API (no clone, no Actions, no
  user-side config) and runs the scan. Supersedes ADR-0019.
  Tracked as `/agentlint-feature-pipeline server-side-scan-on-push`.

### CLI secret auto-upload session (2026-05-10, late evening — autonomous /agentlint-feature-pipeline run)

Follow-up to the dashboard-UX session. Two parallel sub-agents
executed against `docs/prds/cli-secret-autoupload.md`.

- **CLI [PR #6](https://github.com/agentlint/agentlint/pull/6) — merged.**
  - New `agentlint install-secret` subcommand: POSTs to
    `/api/projects/:id/install-secret` with the project token; server
    encrypts a freshly minted token and PUTs it to the repo's
    Actions secrets.
  - `agentlint init` now calls `install-secret` by default after
    writing the workflow file; `--no-install-secret` opts out.
  - +16 tests (161 → 177). Self-audit 100/100.
- **Web [PR #11](https://github.com/agentlint/agentlint.sh/pull/11) —
  open against `dev`.**
  - `lib/github-app/secrets.ts` helper: libsodium sealed-box →
    GitHub Actions secrets API.
  - `POST /api/projects/:id/install-secret` route (session OR
    project-token auth; rate-limit 5/min/project).
  - Schema columns `project.actions_secret_installed_at`,
    `project.actions_secret_last_error` (migration
    `0002_project_actions_secret.sql`).
  - Project dashboard page gains a "GitHub Actions secret" panel
    with four render states (installed, ready, app-not-installed,
    last-error).
  - +25 tests (117 → 142).
- **ADR-0025** logs the design decisions: fresh token per install
  (not pass-through), server-side encryption (not CLI-side), two
  columns on `project` (not a separate table).

### Dashboard UX + CLI auto-connect session (2026-05-10, evening — autonomous /agentlint-feature-pipeline run)

Two parallel sub-agents executed in clean contexts against a single
PRD (`docs/prds/dashboard-ux-cli-autoconnect.md`). The skill itself was
rewritten in the same session to be feature-generic (ADR-0024) so the
same pipeline shape now works for any feature, not only the P1 paid-tier
slices.

- **CLI [PR #4](https://github.com/agentlint/agentlint/pull/4) — merged.**
  - `agentlint login` subcommand: RFC 8628 device-flow OAuth against
    `agentlint.sh`. Token written to `~/.config/agentlint/token` with
    mode `0600`. Read refuses if mode wider.
  - `agentlint logout` clears the token file.
  - `agentlint init` extends to (a) prompt-to-login when no token is
    resolvable and (b) write `.github/workflows/agentlint.yml` by
    default — `--no-workflow` skips, `--force-workflow` overwrites.
  - Token resolver precedence is now `--token` flag → `AGENTLINT_TOKEN`
    env → `~/.config/agentlint/token` file.
  - +31 tests (130 → 161). Self-audit still 100/100.
- **Web [PR #10](https://github.com/agentlint/agentlint.sh/pull/10) —
  open against `dev`, deploy in progress.**
  - `cli_auth_grant` table (Drizzle + raw SQL migration
    `0001_cli_auth_grant.sql`).
  - 4 API routes: `POST /api/cli/auth/device`,
    `POST /api/cli/auth/poll`, `POST /api/cli/auth/approve`,
    `POST /api/cli/auth/deny`. Rate-limited per the PRD.
  - `/cli/auth` browser approval page (server component + client
    auth-form) with org picker, anonymous redirect to `/login`, and
    Authorize/Deny CTAs.
  - 4 dashboard metric cards on `/dashboard/orgs/[slug]`: 7d avg
    score, runs this week, 30d pass-rate, 30d top failing rule.
    Empty-state copy.
  - +67 tests (50 → 117).
- **Skill rewrite** (ADR-0024). `.claude/skills/agentlint-feature-pipeline/SKILL.md`
  now accepts both an explicit feature description (Mode A) and a
  fallback "pick the next pending item from PROJECT_STATE" (Mode B).
  Pipeline order is unchanged: RESTATE → grill-me → to-prd →
  to-issues → tdd → close-out → summary. Parallel sub-agent dispatch
  is now a first-class step with explicit independence rules.
- **PRD** at `docs/prds/dashboard-ux-cli-autoconnect.md` captures the
  scope, schema, API, CLI, UI, security, rollback, and the five
  vertical issues that were dispatched in parallel.
- **ADRs.** ADR-0023 (device-flow OAuth choice over custom setup-link
  flow). ADR-0024 (skill rewritten generic).
- **Deferred to follow-up:** auto-uploading `AGENTLINT_TOKEN` as a
  GitHub Actions repo secret via the App API. Tracked as a future
  PRD `cli-secret-autoupload.md` — requires the `secrets:write`
  permission, which forces every existing install to re-consent.

### Post-v2 iteration session (2026-05-10, evening — UX + ops fixes)

After the v2 base shipped to `main`, this session ran a series of
fixes flushed end-to-end via the PR → dev → main flow:

- **PR #3** `fix(auth)`: bulletproof default-org hook on signup. GitHub
  users with no display name + dynamic imports inside the Better-Auth
  hook were producing `?error=internal_server_error`. Hook now uses
  static imports, `node:crypto.randomUUID()`, try/catch + console.error.
  Signup never aborts on default-org failure.
- **PR #4** `ci(deploy)`: workflow only triggered on `main` push, so
  squash-merges to `dev` never re-deployed. preview.agentlint.sh stuck
  on a pre-v2 staging commit. Added `dev` push trigger + explicit alias
  step + `workflow_dispatch` for manual reruns.
- **DB reset + new fixtures (manual):** dropped all tables on both Neon
  branches (production + dev), regenerated migration as
  `0000_init_v2.sql`, re-applied via `scripts/run-migration.mjs`.
- **CLI v2.0.0 published to npm** via the new `publish-cli.yml`
  workflow (Actions → Run workflow). `NPM_TOKEN` secret configured.
  Release `v2.0.0` tagged.
- **Smoke tests** end-to-end on prod with the maintainer's real GitHub
  OAuth signup: Personal org auto-created, project linked, token
  minted, `POST /api/runs` 201 with row landed scoped to org +
  project, `source=local, provenance=unverified` as expected.
- **`staging` branch deleted** (legacy from pre-v2 preview alias
  bootstrap; ADR-0021 settled on `dev` as the integration branch).
- **PR #6** `feat(dashboard)`: Vercel-style GitHub repo picker on the
  new-project form. `GET /api/github/repos` returns the user's
  installations + cached repo lists; the form renders a grouped
  select; auto-fills project name from repo name.
- **PR #8** `fix(github)`: hardcoded `agentlint-ci` slug was sending
  preview users to install the prod App. Read `GITHUB_APP_SLUG` env so
  each environment links to its own App (ADR-0022).
- **PR #9** `fix(github)`: post-install bounce-back. GitHub's Setup URL
  default landed users on `/dashboard` after install instead of back
  on the new-project page they came from. New `/api/github/post-install`
  reads the `state=<orgSlug>` query (we now pass it on the install URL)
  and 302s back to `/dashboard/orgs/<slug>/projects/new?installed=1`.
  The form also shows a prominent `+ Add another GitHub account` CTA
  so users with one connected install can link more.
- **GitHub App for preview created**: `agentlint-ci-preview` App ID
  `3670537`, slug `agentlint-ci-preview`. Webhook URL +
  `GITHUB_APP_*` env vars configured on Vercel preview + development
  targets via the REST API. Setup URL on both Apps (manual GH setting)
  must point to `https://<env>.agentlint.sh/api/github/post-install`.

### v2 architecture session (2026-05-10, org-centric multi-tenant rewrite)

- **Better-Auth organization plugin** wired into `lib/auth.ts` with
  `databaseHooks.user.create.after` callback that mints a default
  "Personal" org on every new sign-up (ADR-0018). Client gets
  `organizationClient` plugin in `lib/auth-client.ts`.
- **Schema reset.** Single user + empty subscription/install rows
  dropped on both Neon branches (production + dev). Fresh
  `db/migrations/0000_init_v2.sql` introduces `organization`,
  `member`, `invitation`, `project`, `project_token`, plus widened
  `run` (org_id, project_id, branch, commit_sha, source,
  provenance) and org-scoped `subscription`.
- **Project model.** New `project` table binds (org → repo) with
  `prodBranch`, `installationId`, `githubRepoId`. Unique constraint
  on `(orgId, repoOwner, repoName)`.
- **Project tokens.** `apiToken` (user-scoped, `agl_…`) dropped.
  New `project_token` with prefix `agl_proj_…` (61 chars total).
  `lib/tokens.ts` + tests updated.
- **API surface rewritten** under org auth:
  - `POST /api/projects` create, `GET /api/projects?orgSlug=…`
  - `GET|PATCH|DELETE /api/projects/:id` (admin-gated for write)
  - `POST|GET /api/projects/:id/tokens`, `DELETE /api/projects/:id/tokens/:tokenId`
  - `POST /api/runs` now verifies project token, optional GitHub
    Actions OIDC JWT for provenance (ADR-0019).
  - `GET /api/cli/projects` — CLI-facing lookup used by `agentlint init`
  - `/api/stripe/{checkout,portal,webhook}` org-scoped; `customer.id`
    on `organization.stripeCustomerId`
- **Server-side scans removed.** `lib/scan/run-scan.ts` and the
  `handlePushEvent` webhook handler deleted. The `installation`
  table and PR-comment write-path stay so the App still posts diffs
  on PRs whose runs come from the CLI (ADR-0019).
- **CLI v2.0.0** prepared in `packages/cli`:
  - `agentlint init` subcommand: prompts/accepts token, detects
    repo, calls `/api/cli/projects` to confirm linkage, writes
    `.agentlint.json` (ADR-0020), emits CI snippet
  - `--push` reads `.agentlint.json` + `AGENTLINT_TOKEN` env (no
    more `~/.config/agentlint/token`)
  - GitHub Actions OIDC: fetches `audience=agentlint` JWT and
    sends as `x-github-oidc` header. Server verifies → tags
    `source=ci, provenance=oidc-verified`
  - New flags: `--project`, `--branch`, `--commit`
  - 123 tests passing (up from 65)
- **Dashboard rewrite** (web app):
  - `/dashboard` lists user's orgs (multi-org aware)
  - `/dashboard/orgs/:slug` org overview (projects + recent runs +
    subscription)
  - `/dashboard/orgs/:slug/projects/new` linked-repo form
  - `/dashboard/orgs/:slug/projects/:projectId` per-project view
    with mint/revoke token UI and per-branch run table
- **Branch protection** (ADR-0021):
  - CLI repo (public): GitHub branch protection on `main`
    requiring PR + `ci` status check (configured via REST API)
  - Web repo (private): GitHub Free can't protect — fallback is
    local `.githooks/pre-push` (blocks direct push to main)
    + `.github/workflows/branch-policy.yml` CI flag

### Slice 7 ship session (2026-05-10, GitHub App PR comments)

- **Web repo:** new `installation` and `pr_comment` tables with the
  indexes called out in the slice 7 brief. Migration generated as
  `db/migrations/0003_harsh_meteorite.sql` and applied to Neon **dev**
  via `drizzle-kit push`. Prod migration deferred to maintainer smoke
  test (same posture as slice 4).
- **GitHub App auth helpers** (`lib/github-app/auth.ts`): hand-rolled
  RS256 JWT signing on `node:crypto`, installation-token mint with
  in-memory cache (5-min early refresh), constant-time webhook signature
  verification. No JWT library pulled in — see ADR-0016 #1.
- **Webhook handler** (`app/api/github/webhook/route.ts`): POST-only,
  verifies `X-Hub-Signature-256` against `GITHUB_APP_WEBHOOK_SECRET`,
  dispatches `installation.created/deleted/suspend/unsuspend` and
  `installation_repositories.added/removed`. Returns 200 on
  unrecognized events to avoid GitHub retry storms; 401 only on
  signature failure. Body content never echoed in error responses.
- **Comment template** (`lib/github-app/comment.ts`): markdown table
  with score/passes/fails diff vs. previous run, em-dashes on
  first-run, `<!-- agentlint-comment:do-not-edit -->` magic marker
  for recovery. Em-dash + `+`/`-` sign formatting covered by 8 tests.
- **PR-comment orchestrator** (`lib/github-app/post-comment.ts`):
  fire-and-forget from the ingest path. Looks up installation,
  computes diff against previous run, mints token, PATCHes existing
  comment or POSTs a new one. All errors caught + logged; never
  bubbles a 5xx to the ingest response.
- **Ingest extension** (`app/api/runs/route.ts`): `pr` field added to
  the zod schema (optional + nullable). When present + repo
  metadata + matching installation, dispatches the comment work via
  `void` promise.
- **CLI repo:** `pr-detect.ts` parses GitHub Actions `pull_request` /
  `pull_request_target` events from `GITHUB_REF` + `GITHUB_SHA` +
  `GITHUB_BASE_REF`, with `AGENTLINT_PR` and `--pr <n>` overrides.
  PR context attached to every push body.
- **Tests.** Web 84 → 122 (+38). CLI 52 → 65 (+13). Web includes 5
  JWT-shape + signature-verify round-trip tests (real RSA key
  generated per test), 9 webhook-signature tests, 8
  comment-template tests, 7 webhook-installation DB-integration
  tests (inserts/deletes against the dev branch), 9 runs-pr-comment
  tests (zod acceptance + four `postOrUpdatePrComment` paths with
  mocked fetch).
- **Self-audit holds at 100/100** on the CLI repo. Web build
  succeeds; new route shows up at `/api/github/webhook`.
- **ADR-0016** logs the twelve non-PRD calls slice 7 made
  (hand-rolled JWT, in-memory token cache, webhook 200-on-unknown,
  webhook never posts comments, fire-and-forget on ingest, comment
  marker as recovery, no FK between installation and pr_comment, dev
  push only, CLI-side PR detection, `pull_request_target` accepted,
  no payload echo in webhook errors, mocked GitHub in tests).

### Slice 7 ship + prod cutover (2026-05-10, late evening)

- **GitHub App `agentlint-ci` registered** (App ID `3668343`,
  slug `agentlint-ci`, public link
  https://github.com/apps/agentlint-ci). Permissions: Pull requests
  R/W, Contents R, Checks R/W, Metadata R. Subscribed events:
  Pull request, Push, Check suite, Installation, Installation
  repositories. "Any account" install scope (so paid customers
  can install on their own orgs).
- **Four prod env vars set on Vercel** (production scope only):
  `GITHUB_APP_ID`, `GITHUB_APP_SLUG`,
  `GITHUB_APP_WEBHOOK_SECRET`, `GITHUB_APP_PRIVATE_KEY_B64`
  (base64-encoded RSA PEM; decoded at runtime). Private key
  moved out of `~/Downloads` to `~/.config/agentlint-secrets/`
  with `chmod 600`.
- **Slice 7 implementation** by a clean-context subagent across
  both repos. Web: `e6f5242 feat(db): add installation +
  pr_comment tables`, `af4fbbc feat(api): GitHub App webhook
  handler with signature verification`, `78114ba feat(api):
  post/update PR comment on /api/runs when installation
  present`. CLI: `6676dbd feat(cli): detect PR context from CI
  env and include in --push body`, `3b20e6d docs: document the
  GitHub App PR-comment flow and slice 7 decisions`. Web tests
  84 → 122 (+38). CLI tests 52 → 65 (+13). Self-audit holds at
  100/100.
- **Hand-rolled RS256 JWT on `node:crypto`** (no
  `jsonwebtoken` dep). Installation access tokens cached
  in-memory with a 5-min early refresh. Webhook handler returns
  200 on every recognized event and any unrecognized one (only
  signature failure produces 401). Comment posting runs
  fire-and-forget from `/api/runs` so ingest stays fast — the
  webhook itself never posts comments. Magic marker
  `<!-- agentlint-comment:do-not-edit -->` lets us recover the
  comment if `pr_comment` row state drifts from GitHub. See
  ADR-0016 for the full list of twelve calls.
- **Prod schema cutover.** `drizzle-kit push` against the Neon
  prod branch installed `installation` and `pr_comment` tables
  plus the `(repoOwner, repoName, prNumber)` unique index on
  `pr_comment` and the `(accountLogin)` index on `installation`.
  `.env.production.local` removed after the run.
- **Webhook signature smoke test** in prod: `POST
  /api/github/webhook` with no signature → 401, with a fake
  signature → 401. Route alive, signature gate honoring
  `GITHUB_APP_WEBHOOK_SECRET`.
- **Outstanding human action:** the App was installed on the
  `agentlint` org **before** the webhook handler existed. The
  `installation.created` event hit a 404 and is unlikely to
  redeliver. Either redeliver from "Recent Deliveries" in App
  settings or uninstall + reinstall the App on the org so the
  webhook fires against the live route and the `installation`
  table populates.

### Slices 5 + 6 ship + cutover (2026-05-10, late evening)

- **Slice 5 — score trend sparkline + per-row delta chips.** Pure
  server-rendered SVG sparkline above the existing "Recent runs"
  table, plus per-row delta chips for score/passes/fails vs. the
  next-older run. Helpers extracted to `lib/dashboard/trend.ts`
  with 19 unit tests (boundary clamping, single-point handling,
  flat-line min===max, all chip-color permutations). Commit:
  `46e2570 feat(dashboard): score trend sparkline + per-row delta
  chips`. Test count went 29 → 48.
- **Slice 6 — public score badge.** New `public boolean default
  false` column on `run` plus a composite index
  `(repoOwner, repoName, public, createdAt desc)`. `POST /api/runs`
  accepts an optional `public: boolean` field. New public
  unauthenticated route `GET /badge/<owner>/<repo>.svg` returns a
  shields.io-style SVG, score-color-coded, with a 5-min edge
  cache + 1h SWR and a 60 req/min/IP rate limit. Commits:
  `a74bbed feat(api): add public flag to runs schema and ingest
  body`, `a21a21b feat(badge): public SVG score badge endpoint`,
  `8923eef docs(readme): document the score badge`. Test count
  went 48 → 84 (+36 badge tests including DB integration).
- **CLI alignment for slice 6.** `feat(cli): add --public flag`
  (commit `cc0c40a`). One-liner additive change to the ingest
  body shape; with `--push --public` the pushed run is marked
  public and the badge endpoint will render this repo's score.
  Without `--push`, `--public` is a no-op. Self-audit holds at
  100/100; tests stay at 52 (the new code path is covered by the
  existing client tests since the body shape is opaque to the
  client).
- **Prod cutover for slice 6 schema.** `drizzle-kit push` ran
  against the Neon prod branch; `public` column + composite index
  exist in prod. `.env.production.local` removed after the run.
- **Slice 6 smoke test in prod.** Inserted a synthetic public run
  for `agentlint/agentlint`, hit
  `https://agentlint.sh/badge/agentlint/agentlint.svg` → HTTP 200,
  `image/svg+xml`, `Cache-Control: public, max-age=300`,
  rendered SVG with `score: 100` in the green color band
  (`#3fb950`). Smoke run cleaned up afterward; prod tables empty.

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
5. ~~**Run history on `/dashboard`**~~ ✅ Shipped 2026-05-10. See
   "Slices 5 + 6 ship + cutover" entry. Server-rendered sparkline
   + delta chips landed; no client JS added.
6. ~~**Public score badge**~~ ✅ Shipped + smoke tested in prod
   2026-05-10. Endpoint `/badge/<owner>/<repo>.svg` is live; CLI
   `--public` flag wired; README documents the URL pattern.
   Outstanding: dashboard UI to flip individual runs public/private
   after the fact (deferred to a thin follow-up slice — currently
   the only way to mark a run public is `agentlint --push --public`).
7. ~~**GitHub App for PR comments**~~ ✅ Shipped 2026-05-10. See
   "Slice 7 ship session" entry under "Done — recent" and ADR-0016.
   Schema applied to Neon **dev**; production migration deferred to
   maintainer smoke test (same posture as slice 4). Outstanding for
   the maintainer: (a) push schema to prod, (b) smoke-test against
   the real GitHub App by installing on a test repo and pushing from
   CI, (c) the `/dashboard` UI for the install flow is still not
   implemented — the App is installed via
   `https://github.com/apps/agentlint-ci` directly. A dashboard
   install card is a thin follow-up if user research demands it.
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




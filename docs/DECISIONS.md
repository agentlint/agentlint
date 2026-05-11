# Decisions log

> Append-only ADR-lite log. Newest entries at the bottom. Each entry: context,
> options considered, choice, and why. One paragraph per section is enough.
>
> When in doubt about whether something rises to the level of a decision: if a
> future contributor (human or agent) might reasonably ask "why did we do it
> this way?", write it down here.
>
> Format:
>
> ```
> ## ADR-NNNN — Title
>
> **Date:** YYYY-MM-DD
> **Status:** accepted | superseded by ADR-MMMM
>
> **Context.** What forced the decision.
> **Options.** What was considered.
> **Choice.** What was picked.
> **Why.** The reasoning that made the choice the right one.
> ```

---

## ADR-0001 — Pricing tiers: free CLI, $19/mo Pro, $99/mo Team, Enterprise from $2k

**Date:** 2026-05-09
**Status:** accepted

**Context.** agentlint needs a sustainable monetization path without
gating the open-source CLI. The audit itself must remain free or the
project loses its top-of-funnel.

**Options.**
- (a) Pay-per-scan API.
- (b) Free CLI + paid hosted dashboard with team features.
- (c) Open-core with some rules paywalled.

**Choice.** (b). Free MIT-licensed CLI forever. Paid plans:
- $19/mo Pro: history, badges, PR comments, single user.
- $99/mo Team: flat for 10 seats, GitHub App, org-level dashboards.
- Enterprise from $2k: SSO, SLA, on-prem self-host, custom rules.

**Why.** Open core (c) erodes trust in the rubric — "are the paid rules
the ones that actually matter?" — and makes the CLI feel crippled.
Pay-per-scan (a) couples revenue to volume and discourages CI use,
which is exactly where agentlint is most valuable. The hosted dashboard
model matches Sentry/PostHog/Linear: the CLI is the wedge, the recurring
team value is the moat.

## ADR-0002 — Position the project as "agent-built, open to everyone"

**Date:** 2026-05-09
**Status:** accepted

**Context.** The project was conceived and built by Claude (chat web)
under the human's direction, and is being maintained autonomously by
Claude Code going forward. This is unusual and the project's identity
needs a clear public stance.

**Options.**
- (a) Hide the agent involvement; present as a normal solo-dev project.
- (b) Lead with "built by an AI" as a gimmick.
- (c) State honestly that the project is operated by an agent under
  human supervision, open to human and agent contributors equally,
  and treat that as a feature.

**Choice.** (c).

**Why.** (a) is dishonest and brittle — eventually someone notices the
commit cadence, the docs voice, or asks. (b) reduces the project to a
novelty and ages badly. (c) is true, defensible, and aligned with where
the industry is heading. It also gives the project a credibility test:
if agentlint, scoring 100/100 on its own rubric and shipping clean
releases on its own, can be operated by an agent, that says something
real about both the rubric and the agent.

## ADR-0003 — Score formula renormalized to 0–100

**Date:** 2026-05-09
**Status:** accepted

**Context.** The rubric has 5 categories; some categories may be
inapplicable to a given scan (e.g., the `documentation` category checks
require a `--url` flag pointing at a docs site). The score must be
comparable across repos regardless of which categories applied.

**Options.**
- (a) Fixed 100-point total split across 5 categories. Inapplicable
  categories drop the max score.
- (b) Renormalize to 100 against only the categories that applied.

**Choice.** (b). `score = round(100 * earned / max_applicable)`. Skipped
categories don't penalize.

**Why.** A repo without a docs site shouldn't be capped at 80/100
forever. (a) creates a perverse incentive to fake a docs URL. (b) keeps
the score honest and comparable.

## ADR-0004 — Default outputs: terminal + HTML; structured outputs behind flags

**Date:** 2026-05-09
**Status:** accepted

**Context.** Two audiences: humans reading reports, and agents consuming
reports as input to their own loops. Both are first-class.

**Options.**
- (a) Default to JSON, optional pretty terminal.
- (b) Default to terminal + HTML, opt into JSON / Markdown via flags.

**Choice.** (b). Plain `agentlint` prints a colored terminal report and
writes `agentlint-report.html` to disk. `--json` and `--markdown` go to
stdout, suppressing the terminal report so they're trivially pipeable.

**Why.** The first run is almost always a human running `npx @agentlinthq/cli`.
That experience needs to be delightful — color, scores, and an HTML
file you can drop into a browser. Agents reading the report explicitly
ask for `--json` or `--markdown`, and `agentlint --json > report.json`
is exactly what an agent in a CI loop wants. Defaulting to JSON would
make the human first-run feel cold.

## ADR-0005 — License: MIT

**Date:** 2026-05-09
**Status:** accepted

**Context.** The free CLI needs to be permissive enough that any company
can drop it into their CI, including in private monorepos.

**Options.** MIT, Apache-2.0, BSL with eventual MIT, AGPL.

**Choice.** MIT.

**Why.** MIT removes friction and matches the ecosystem norm for dev
tooling (Biome, Vitest, Prettier, ESLint are all permissive). AGPL
would scare off enterprise. BSL would muddy the open-source narrative.
Apache-2.0 is fine but adds patent-grant ceremony unnecessary for a
linter.

## ADR-0006 — Package manager: pnpm with workspaces

**Date:** 2026-05-09
**Status:** accepted

**Context.** Monorepo with `core` and `cli` packages plus future
additions. Need a manager that handles workspace protocol cleanly and
publishes resolved versions on `publish`.

**Options.** npm, yarn (classic / berry), pnpm, bun.

**Choice.** pnpm.

**Why.** pnpm has the cleanest workspace story today, the fastest
installs, and rewrites `workspace:*` to resolved versions on publish
(critical for `agentlint` shipping a real `@agentlinthq/core` dep). bun
is tempting but less battle-tested for publishing dual-package
monorepos. yarn-berry is fine but has more configuration surface than
pnpm. npm workspaces still trail pnpm on speed and the `workspace:*`
protocol resolution.

## ADR-0007 — Toolchain: Biome (lint+format) + Vitest (test)

**Date:** 2026-05-09
**Status:** accepted

**Context.** Need a fast, low-config toolchain. The repo is small and
should stay fast.

**Options.** ESLint + Prettier + Jest, Biome + Vitest, ESLint + Prettier
+ Vitest.

**Choice.** Biome for lint and format, Vitest for tests.

**Why.** Biome combines the lint + format roles and is dramatically
faster than the ESLint+Prettier combo. One config file, one binary, one
mental model. Vitest is the natural fit for an ESM TypeScript codebase
and is faster than Jest for this size of project. The combination
requires zero plugins for our stack.

## ADR-0008 — Monorepo split: `@agentlinthq/core` (pure, no IO) and `agentlint` (CLI)

**Date:** 2026-05-09
**Status:** accepted

**Context.** The score calculator and types are useful in places that
aren't the CLI (a future hosted dashboard, GitHub App, library users
who want to compute scores from pre-collected results).

**Options.**
- (a) Single package with everything in it.
- (b) Two packages: `core` for types and pure scoring, `cli` for IO,
  walker, reporters.

**Choice.** (b).

**Why.** Keeping `core` IO-free makes it bundleable for a future
browser-based dashboard, trivial to test, and easy to reason about. It
also enforces a useful discipline: anything that needs the file system
goes in `cli`.

## ADR-0009 — Husky `prepare-commit-msg` hook auto-appends Co-Authored-By: Claude

**Date:** 2026-05-09
**Status:** accepted

**Context.** Per ADR-0002, the project's identity depends on the public
git history reflecting that an agent wrote it. Manually appending the
trailer on every commit is error-prone. The user's global git config
disables Co-Authored-By by default, so we need an explicit per-repo
mechanism.

**Options.**
- (a) Document the trailer in `CHARTER.md` and rely on the agent to
  append it manually.
- (b) `.gitmessage` template + `git config --local commit.template` set
  by an install script.
- (c) Husky `prepare-commit-msg` hook that injects the trailer if it's
  not already present.

**Choice.** (c).

**Why.** (a) is brittle — a single forgotten trailer breaks the
narrative. (b) requires every contributor to run an install step. (c)
is automatic for both the agent and any human contributor in this repo,
and only affects this repo. Humans can opt out per-commit by editing
the message before finalizing.

## ADR-0010 — Project constitution lives in `docs/`: CHARTER, PROJECT_STATE, PLAYBOOK, DECISIONS

**Date:** 2026-05-09
**Status:** accepted

**Context.** A handoff between sessions needs reliable context. The
existing `HANDOFF.md` is a one-shot artifact and doesn't survive past
its first use. The project needs documents that an agent can re-read at
the start of every session and trust as current.

**Options.**
- (a) Keep using `HANDOFF.md`-style ephemeral docs per session.
- (b) Put everything in `AGENTS.md`.
- (c) Split into a constitution (`CHARTER.md`), a live snapshot
  (`PROJECT_STATE.md`), runbooks (`PLAYBOOK.md`), and an append-only
  decision log (`DECISIONS.md`), with `CLAUDE.md` as the entry point
  pointing at them in reading order.

**Choice.** (c).

**Why.** Each of these documents has a different update cadence and
purpose. `CHARTER` is amended rarely with human sign-off. `PROJECT_STATE`
is rewritten every session. `PLAYBOOK` accretes new runbooks as the
project encounters new operational situations. `DECISIONS` is
append-only by definition. Mashing them together hides which is stable
and which is volatile, which makes them less trustworthy at the start
of a new session.

## ADR-0011 — Publish under `@agentlinthq` org scope; the unscoped `agentlint` and the org name `agentlint` are both taken

**Date:** 2026-05-09
**Status:** accepted

**Context.** When we went to publish v1.0.0 to npm we discovered that
the unscoped name `agentlint` is held by an unrelated package
(`agentlint@0.3.0` by `akz4ol`, "Static analysis and security scanner
for AI agent configuration files"). We tried to create the `@agentlint`
scope by registering an npm organization named `agentlint` — npm
rejected the org name because it conflicts with the existing package.
npm also no longer issues classic automation tokens for new accounts;
granular access tokens cannot create scopes that don't already exist
as orgs.

**Options.**
- (a) Rename the project away from "agentlint" entirely (e.g.,
  `agentaudit`, `aglint`). The unscoped `aglint` is also already taken.
- (b) Publish under a related but available org name. Tried
  `agentlinthq` (HQ-suffix pattern, matches `@notionhq/*`,
  `@vercel/...` style orgs). Available. Created.
- (c) Pursue an npm dispute or contact the existing `agentlint` owner
  to negotiate a transfer. Slow, uncertain, and the existing package
  occupies a similar domain so they may decline.

**Choice.** (b). Org `agentlinthq` on npm. Packages: `@agentlinthq/cli`
and `@agentlinthq/core`. The npm install command is
`npx @agentlinthq/cli` (or `npm i -g @agentlinthq/cli` followed by
`agentlint` — bin name preserved).

**Why.** The brand identity, the GitHub org, the (future) domain, the
binary name, and the rubric scoring API are all "agentlint". Renaming
the project (a) would invalidate documentation, marketing copy, and
repo URLs for marginal install-line ergonomics. (c) is a dependency on
an external party we can't time. (b) preserves everything that matters
publicly with one extra `hq` in the install command. The HQ suffix has
strong prior art for "official org of project X" (`@notionhq/client`).
The npm org also gives us a real shared namespace that future human or
agent maintainers can be invited into. We document the discrepancy
openly in the README so users aren't surprised, and we leave the door
open to claim the bare `agentlint` scope later if the unscoped package
is ever released.

## ADR-0012 — Pull paid tiers from `/pricing` until hosted dashboard ships

**Date:** 2026-05-10
**Status:** accepted

**Context.** The Pro ($19/mo) and Team ($99/mo) tiers were live on
`/pricing` with working Stripe Checkout, but the features they
promised — hosted run history, GitHub PR comments, public score
badge, org-level dashboard, policy thresholds — were not yet built.
Charging real money for vapor would burn trust and risks chargebacks
once buyers realize there's nothing to consume. The CLI side (Free
tier) is fully delivered and stays.

**Options.**
- (a) Keep paid tiers live, build features in parallel, accept that
  early subscribers pay for unfinished product.
- (b) Pull paid tiers from the UI, replace `Subscribe` CTAs with
  `Notify me at launch` mailto links, leave Stripe routes wired so
  re-enabling is one PR.
- (c) Delete the Stripe integration entirely until features ship.

**Choice.** (b). `/pricing` keeps all three tiers visible for
roadmap signaling and SEO. Pro and Team show a `Coming soon` badge,
their CTAs are `mailto:hello@agentlint.sh?subject=Notify me when X
launches`, and a status banner up top tells visitors what's real.
`/dashboard` empty state matches: free CLI message + notify-at-launch
link instead of "upgrade to Pro". Stripe checkout/portal/webhook
routes stay deployed so we don't re-do the integration when features
land.

**Why.** Trust > revenue at this stage. Charter §3 (Definition of
done) says "what we ship works" — selling features that don't exist
inverts that. Keeping the tiers visible (vs. deleting the page)
signals direction to candidates, journalists, and investors. The
mailto waitlist gives us the only signal that matters during the
build phase: which plan people actually want. Re-enabling is a
five-minute revert when the hosted dashboard is real, with the
Stripe products and webhook secret already provisioned.

## ADR-0013 — `agentlint/agentlint.sh` repo flipped private; CLI repo stays public

**Date:** 2026-05-10
**Status:** accepted

**Context.** Two GitHub repos: `agentlint/agentlint` (the open-source
CLI, MIT, public) and `agentlint/agentlint.sh` (the marketing site +
auth + dashboard + Stripe wiring). The `.sh` repo was created public
during the overnight MVP. Anyone could read the full Stripe
integration, the Drizzle schema, the better-auth wiring, and the
dashboard implementation — i.e. everything required to clone the
SaaS layer without writing it.

**Options.**
- (a) Keep public, accept that the SaaS layer is undifferentiated and
  bet that no one bothers cloning.
- (b) Make private, treat the CLI as the open product and the hosted
  layer as proprietary, mirror Linear/Vercel/PostHog (which keep
  their hosted-control-plane code closed even when CLIs and SDKs are
  open).
- (c) Make private but extract a separately-licensed reference
  template later.

**Choice.** (b). `agentlint/agentlint.sh` flipped to private via
`gh repo edit --visibility private` on 2026-05-10. The CLI repo
stays public and MIT.

**Why.** The CLI is the wedge and benefits from being readable,
forkable, and copy-pasteable — that's the open-core thesis (ADR-0001).
The hosted layer is the moat: schema, billing wiring, dashboard
shape, GitHub App integration, leaderboard pipeline. There's no user
benefit to making it readable and there's a real competitive cost.
Reversible at any time via `gh repo edit --visibility public`. (c)
is fine but not now — the code isn't stable enough to be a useful
template, and template-extraction is a one-day chore once it is.

## ADR-0014 — Deploy `agentlint.sh` via GitHub Actions + Vercel CLI (not the built-in git integration)

**Date:** 2026-05-10
**Status:** accepted

**Context.** Vercel's Hobby (free) plan does not allow deploying
private GitHub *organization* repos through the built-in git
integration; only personal-account private repos work. Once
ADR-0013 flipped `agentlint/agentlint.sh` private, every push
silently stopped deploying — the production site sat on a stale
build that still showed live `Subscribe` CTAs even though the
ADR-0012 pricing pull had already been pushed and reviewed. The
Hobby restriction blocks the obvious "just connect git" path.

**Options.**
- (a) Transfer the repo from `agentlint` org to the maintainer's
  personal account. Hobby works, repo stays private, branding
  shifts off the org.
- (b) Keep the repo in the `agentlint` org, do deploys from a
  GitHub Action that calls `vercel deploy` with a project-scoped
  token. Disconnect Vercel's git integration to avoid duplicate
  deploys.
- (c) Upgrade to Vercel Pro. Costs $20/month/seat; not justified at
  pre-revenue stage.
- (d) Migrate hosting to Cloudflare Pages or Netlify, both of which
  allow private org repos on free tiers. Largest lift; throws away
  Vercel-specific features.

**Choice.** (b). Wrote `.github/workflows/deploy.yml` in the
`agentlint.sh` repo. Push to `main` runs a production deploy;
pull requests run preview deploys and the workflow upserts a
single PR comment with the preview URL (concurrency group cancels
in-flight deploys when newer commits arrive on the same ref). The
job uses the Vercel CLI server-side build, not `--prebuilt`,
because pnpm 11's strict ignored-builds gate (esbuild, sharp)
fails the local install path in CI containers. Three GitHub repo
secrets: `VERCEL_TOKEN` (project-scoped, no expiry, rotatable),
`VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. The Vercel project's git
integration was disconnected by the human in the Vercel UI.

**Why.** (a) drops the org branding from the only URL where
contributors look first — the GitHub repo — and complicates future
hand-off if a teammate ever helps maintain. (c) burns money for a
problem that is solved by 80 lines of YAML. (d) is a re-platforming
project that has no business being on the critical path during
launch week. (b) keeps the org structure, the existing Vercel
project, the existing domain configuration, and only adds a
workflow file. The trade-offs are real but acceptable: PR previews
no longer show up as inline checks from Vercel's GitHub App (the
workflow comments the URL instead), and deploys take ~60–90s
longer than the integrated path because we re-fetch project
settings on every run. Reversibility is full: re-connect git
integration in Vercel UI and delete the workflow file the day we
upgrade or move off Hobby.

## ADR-0015 — Slice 4 (`agentlint --push` ingest) — implementation choices

**Date:** 2026-05-10
**Status:** accepted
**Supersedes:** none. Implements PRD `docs/prds/agentlint-push-ingest.md`.

**Context.** Slice 4 of the hosted dashboard build (`agentlint --push`
+ report ingest) was implemented end-to-end by two parallel
subagents: one in the CLI repo (`packages/cli/src/push/*`) and one in
the web repo (`db/schema.ts`, `app/api/tokens/*`, `app/api/runs/*`,
`app/dashboard/tokens/`, dashboard runs list). Several call sites
forced choices the PRD did not pin down. Logging them here so a
future contributor doesn't assume they were all in the original
contract.

**Decisions and why.**

1. **Hand-rolled base32 + Crockford ULID.** The PRD allowed either
   a library or a hand-roll for token encoding. The web subagent
   chose hand-roll (~30 LOC each) over pulling `@scure/base` and
   the `ulid` package, with RFC 4648 test vectors covering
   correctness. Rationale: keep the dependency surface flat in a
   security-critical module (token generation), and avoid
   transitive supply-chain weight for two trivial primitives.
   Reversible if we ever need decoding for another purpose — swap
   in `@scure/base` then.

2. **Insert-then-update on `/api/runs`, no transaction.** Drizzle's
   `neon-http` driver does not expose interactive transactions. The
   ingest path inserts the `run` row first, then bumps
   `apiToken.lastUsedAt`. If the second write fails, the run row
   is still durable (rather than getting a phantom run with no
   audit trail). The two writes are independent — the run row
   already references an existing token id — so split is safe.

3. **`looksLikeToken` shape pre-check before DB lookup.** PRD only
   required `crypto.timingSafeEqual` for hash comparison. The web
   subagent added a constant-time-on-length shape check (length +
   prefix + alphabet) so obviously bogus bearers don't hammer the
   DB. The check is deterministic on length, so it doesn't widen
   the timing oracle compared to the bare hash compare.

4. **`api_token_token_hash_idx` index added.** The PRD listed two
   indexes (`(userId, revokedAt)` on `apiToken`,
   `(userId, createdAt desc)` on `run`) but did not call out the
   bearer-lookup index. Without it, every `/api/runs` POST would
   full-scan the token table. Treated as required for the ingest
   path to be acceptable, not as a contract change.

5. **`--url` flag in the CLI is overloaded by URL pathname.**
   `--url <X>` already meant "audit this docs site" pre-slice-4. The
   PRD spec'd `agentlint --push --url https://agentlint.sh` for the
   push endpoint. The CLI subagent disambiguated by pathname: a bare
   origin (`/` or empty path) is treated as the push endpoint;
   anything else is the docs target. Falls back to `AGENTLINT_URL`
   env or the default `https://agentlint.sh`. Keeps both use cases
   working without adding a second flag.

6. **`AGENTLINT_INSECURE=1` is env-only, not a `--insecure` flag.**
   The PRD mentioned an `--insecure` flag in §Security as a
   local-testing escape hatch. Implemented as an env-only switch
   instead. Rationale: less discoverable means less likely to be
   copy-pasted into production scripts, and you can't accidentally
   tab-complete it. Trivial to add a flag later if a real use case
   shows up.

7. **`--push` exits 0 even when no token is configured.** PRD says
   push failures (4xx/5xx, network) exit 0 so the local audit
   isn't blocked. Extended to "no token resolved" too, on the
   principle that `--push` is a side effect that must never break
   CI. The CLI prints the resolution path in the error message so
   the user can fix it.

8. **Push line lands at the bottom of stdout.** The push happens
   after the existing JSON/markdown/HTML reporter writes but before
   `process.exit`. So scripts that pipe `--json` into something
   still get clean JSON, with a `Pushed: <url>` or `Push failed:
   <reason>` line appended after.

9. **Feature flag `NEXT_PUBLIC_PUSH_ENABLED`.** The dashboard runs
   list and the `/dashboard/tokens` link are gated by this env var,
   defaulting to off. The routes themselves are always live; only
   the UI entry points are gated. Lets us ship the API, run a
   smoke test against prod, and flip the flag to expose the UI in
   one Vercel env-var change.

10. **`NEXT_PUBLIC_PUSH_ENABLED` deliberately not added to Vercel
    prod env yet.** The flag stays off in production until the
    cross-repo smoke test (issue 5 of the PRD) confirms the CLI →
    API → dashboard pipe works end-to-end against prod. Migration
    against the Neon **dev** branch is in place; the prod migration
    runs as part of the smoke test.

11. **Lockfile sync as a separate `fix(deps)` commit.** The web
    subagent added `zod` and `vitest` to `package.json` but the
    lockfile regen step did not happen in-session, breaking the
    Vercel deploy (`ERR_PNPM_OUTDATED_LOCKFILE` because Vercel
    runs `pnpm install --frozen-lockfile` in CI). Fixed locally
    via `pnpm install --no-frozen-lockfile
    --config.dangerouslyAllowAllBuilds=true` and committed as a
    separate `fix(deps): sync pnpm-lock.yaml` commit so the diff
    history shows what happened. **Lesson for future agents:**
    after `pnpm add`, always re-run install and commit the
    lockfile in the same PR.

## ADR-0016 — Slice 7 (GitHub App PR comments) — implementation choices

**Date:** 2026-05-10
**Status:** accepted
**Supersedes:** none. Implements slice 7 of the hosted-dashboard build.

**Context.** Slice 7 wires up the agentlint GitHub App: the CLI detects a
PR context from CI env, the web ingest accepts a `pr` field, and the App
posts (or updates) a single comment per PR with the score + diff vs. the
previous run. The App is registered (App ID 3668343, slug
`agentlint-ci`) with prod env vars already set on Vercel. Several
implementation choices were forced by the constraints "no new runtime
deps" and "the webhook must respond in <1s while the comment posting
might take seconds." Logging them here so they don't get re-litigated.

**Decisions and why.**

1. **Hand-rolled JWT signing on `node:crypto`.** No `jsonwebtoken` /
   `jose` dep. The signing routine is ~30 LOC: base64url-encode the
   header + payload, RS256-sign the joined string with `createSign`,
   base64url the signature. Verifiable via `createVerify` against the
   matching public key — covered by a real round-trip test using a
   freshly-generated RSA key pair. Same rationale as the slice 4
   hand-rolled token primitives: keep the security-critical surface dep-flat.

2. **Installation token cache is in-memory, keyed by installationId,
   refreshed 5 minutes early.** GitHub-issued installation tokens last
   one hour. We refresh 5 minutes ahead of `expires_at` so a slow
   request started just before expiry can't land with a stale token.
   The cache lives only in process memory; cold starts mint a new
   token. No Redis, no shared cache — single Vercel function instance
   is the deployment shape.

3. **Webhook returns 200 even on unrecognized events.** GitHub retries
   on non-2xx, and we'd rather no-op than create a thundering herd if
   we add a new subscription before its handler. We also 200 on
   malformed payloads (no `action` field) for the same reason.
   Signature-verification failures are the only path that 401s — those
   are real and should be visible in the App's delivery dashboard.

4. **Webhook never posts comments.** The webhook is the install/repo
   bookkeeping path. PR comments are triggered by the `/api/runs`
   ingest path because (a) the webhook has a strict ~10s budget, (b)
   we already have all the info we need at ingest time, and (c)
   keeping the webhook fast means we can subscribe to more events
   later without revisiting timeouts.

5. **PR-comment work is fire-and-forget on the ingest path.** The
   `/api/runs` POST returns 201 immediately and `void`s the
   `postOrUpdatePrComment` promise (with a `.catch(log)` for defense
   in depth). Charter §3 requires the local audit to never be blocked
   by a side effect; comment-posting failures must never turn the
   ingest into a 5xx. We did not pull in `@vercel/functions` for
   `waitUntil` — the dependency adds weight and the promise-leak
   pattern is well-understood.

6. **Comment marker `<!-- agentlint-comment:do-not-edit -->` is the
   recovery mechanism.** Primary path: the `pr_comment` table records
   the GitHub comment id, and we PATCH it on subsequent runs. Recovery
   path (deferred to a future slice if it actually matters): if the
   row is missing, list the PR's comments, find the one authored by
   `agentlint-ci[bot]` containing the marker, and adopt it. Marker
   present in every comment from day one.

7. **`installation` and `pr_comment` are not foreign-keyed to each
   other.** An installation can be uninstalled and reinstalled with a
   new numeric `installationId`; we don't want to drop comment history
   on re-install. `pr_comment.installationId` is recorded at
   write-time so we know which token scope to mint, but it's a plain
   integer column.

8. **Schema applied to Neon dev branch only.** Same posture as slice 4:
   `drizzle-kit push` ran against the dev branch, the prod migration
   waits for the maintainer's smoke test. Migration SQL committed at
   `db/migrations/0003_harsh_meteorite.sql`.

9. **PR detection lives in the CLI, not the server.** The CLI is the
   thing with access to CI env vars. Server only sees the `pr` field
   on the body; missing-or-null `pr` means "not a PR run, skip the
   comment path." Manual override via `AGENTLINT_PR` env or `--pr <n>`
   flag — both flow through the same detector.

10. **`pull_request_target` accepted as a PR variant.** Some workflows
    use `pull_request_target` for fork PRs. Treating it the same as
    `pull_request` keeps the comment behavior consistent regardless
    of which trigger the user picked.

11. **Webhook responses do not include any payload echo.** Even on
    400 (`Invalid JSON`, `Missing X-GitHub-Event`) the response body
    is a fixed envelope. Body content is never echoed because GitHub
    delivery payloads can include sensitive metadata that we should
    not be reflecting back to a potentially-spoofed sender.

12. **Mocked GitHub API in tests; never hits real GitHub.** The
    `postOrUpdatePrComment` integration tests use an injected
    `fetchFn` that recognizes the auth/comment endpoints by URL and
    returns canned responses. The maintainer runs the real-GitHub
    smoke after merge.

## ADR-0017 — Two production bugs found during slice 7 smoke test

**Date:** 2026-05-10
**Status:** accepted

**Context.** Slice 7 schema applied to prod, App installed, the
synthetic-signature webhook smoke passed (401 on bad signature,
200 on signed `installation.created`), and the installation row
populated correctly. The first end-to-end smoke against a real
PR exposed two bugs the unit-test suite did not catch.

**Bug 1 — fire-and-forget promise killed by Vercel runtime
termination.** ADR-0016 #5 chose `void promise.catch(log)` for
the PR-comment dispatch instead of pulling in
`@vercel/functions`. On Vercel's serverless runtime the function
context is destroyed when the response sends, so the in-flight
promise never finished: ingest returned 201, but no GitHub
comment ever appeared and no `pr_comment` row was inserted. Fixed
by importing `after` from `next/server` and wrapping the
dispatch in `after(async () => { … })`. `after` is the documented
Next 15 escape hatch for "do work past the response on
serverless." Commit `f2246f8 fix(api): use next/server after()
for PR-comment dispatch`.

**Bug 2 — GitHub numeric ids overflow `integer` columns.** Slice
7's schema typed `installation.installation_id`,
`installation.account_id`, `pr_comment.installation_id`, and
`pr_comment.comment_id` as `integer`. PostgreSQL `integer` is
int32 (max 2,147,483,647). Real GitHub comment ids today are
above that ceiling — the first observed comment id during smoke
was 4,416,205,882. The dispatch posted the comment to GitHub
successfully, then the `pr_comment` INSERT silently failed inside
the orchestrator's try/catch, so subsequent pushes to the same
PR posted *new* comments instead of patching the existing one.
Fixed by widening all four columns to `bigint` via raw
`ALTER TABLE … SET DATA TYPE bigint` (drizzle-kit's interactive
prompt for the same change insists on truncating, which is
unnecessary — PostgreSQL widens int32 → int64 in place without
data loss). The schema file uses `bigint("…", { mode: "number" })`
so JS-side values stay as plain numbers (safe up to 2^53;
GitHub ids are not approaching that). Commit
`82d6489 fix(db): widen GitHub numeric ids to bigint`.

**Why this matters for future slices.**

1. **On Vercel, "fire-and-forget" is a lie.** Always use `after`,
   `waitUntil`, or an explicit queue when triggering work after a
   response. The unit tests passed because they `await`ed the
   dispatch; production didn't.
2. **GitHub numeric ids are bigint.** Anywhere we store GitHub
   comment, issue, repo, user, installation, account, or
   workflow-run ids, use `bigint`, not `integer`. Future slices
   touching GitHub state should default to bigint.

**Smoke test result after fixes.** Two `POST /api/runs` calls
against the same PR — the first one created a comment, the
second one PATCHed the same comment with a fresh delta row. PR #1
ended with exactly one `agentlint-ci[bot]` comment showing
`score: 99 / previous: 95 / Δ: +4`. Smoke artifacts cleaned up
afterward (PR closed, branch deleted, runs + tokens + pr_comment
rows all empty).

## ADR-0018 — v2 org-centric multi-tenant model

**Date:** 2026-05-10.

**Status:** Accepted. Implemented in `feat/v2-org-model` on both repos.

**Context.** The slice-1-through-7 design treated the agentlint user as the
unit of identity, ownership, and billing. Runs FK'd to `user.id`. Subscriptions
FK'd to `user.id`. API tokens were minted per user (`agl_…`). The GitHub App
`installation` table grafted a parallel notion of "GitHub org" on top, but it
was a side-channel — there was no first-class agentlint organization that owned
projects and paid the bill. Users in multiple GitHub orgs had no way to model
that, and the personal vs. org distinction was driven entirely by whether the
App happened to be installed.

**Decision.** Adopt a first-class organization model. Every business table FKs
to `organization.id`. The user signs in, a personal org is created on the fly,
and the user can create more orgs or be invited into one. Projects (linked
GitHub repos) live under an org. Tokens are minted per project, not per user.
Runs FK to (organizationId, projectId). Stripe customer + subscription live on
the org, not the user.

Implementation choice: use the official Better-Auth `organization` plugin
rather than hand-rolling org/member/invitation tables. The plugin already
ships:

- `organization` table (id, name, slug, logo, metadata)
- `member` table (id, organizationId, userId, role)
- `invitation` table (with status + expiresAt)
- `session.activeOrganizationId` for current-org cookie
- Client-side helpers via `better-auth/client/plugins → organizationClient`

A `databaseHooks.user.create.after` callback in `lib/auth.ts` creates a default
"Personal" org on every new sign-up so the user always has an active org to
write into.

The agentlint `stripeCustomerId` moved from `user` to `organization`. The
checkout, portal, and webhook routes now take `{orgSlug, plan}` and resolve
the customer via the org row.

**Schema changes.** The DB was reset (single user with empty data — see the
2026-05-10 11pm snapshot below). The fresh `0000_init_v2.sql` migration
introduces:

- `organization`, `member`, `invitation` (Better-Auth plugin tables)
- `project` (orgId, name, repoOwner, repoName, prodBranch, githubRepoId,
  installationId)
- `project_token` (projectId, name, tokenHash, prefix, createdBy)
- `run` widened with `organizationId`, `projectId`, `branch`, `commitSha`,
  `source` (`ci` | `local`), `provenance` (`oidc-verified` | `unverified`)
- `subscription` (org-scoped — `organizationId` not `userId`)
- `installation` and `pr_comment` retained unchanged (GitHub App still mints
  installation tokens for PR-comment writes)

The legacy user-scoped `apiToken` (`agl_…`, 56 chars) is dropped. The new
project token uses prefix `agl_proj_` (61 chars). Tokens never live in the
checked-in `.agentlint.json` config — they belong in `AGENTLINT_TOKEN` env
secrets.

**Public/breaking impact.** Any consumer of the v1 `/api/runs` ingest with a
user-scoped `agl_…` token must rotate: revoke the old token, link the repo as
a project, mint an `agl_proj_…` token, set it as `AGENTLINT_TOKEN`. The badge
endpoint still works (resolves project by repoOwner/repoName) but it only
returns scores for runs marked `public=true`.

**Consequences.**

- Multi-tenant safety becomes a query-shape rule: every business query MUST
  include an `organizationId` predicate (or a join through `project`).
  Forgetting it is a privacy bug.
- The Better-Auth `databaseHooks` API is the integration point for "always
  ensure an org exists for this user." If Better-Auth ever changes the hook
  signature, default-org creation is the canary.
- Cancelling `GitHub App` install no longer auto-suspends runs — the org
  retains its data and its projects. A separate explicit "delete project"
  flow handles cleanup.

**Why not a custom org model?** Three weeks of plumbing we'd ship slowly.
Better-Auth's plugin is battle-tested, includes the invitation flow, and
exposes a clean client surface (`organization.create`, `organization.invite`,
etc.). The cost is one extra dependency; the win is shipping in one session
instead of three.

## ADR-0019 — CLI runs in CI; no server-side scans

**Date:** 2026-05-10.

**Status:** Accepted. Server-side scan code removed from the web repo
(`lib/scan/run-scan.ts` and `handlePushEvent` deleted, including the tarball
extraction path that ADR-0017 patched).

**Context.** Slice 8 (commits `c503a3e…b98cd69`) shipped a server-side scan
path: on a `push` webhook, the web server cloned the repo, ran agentlint in
a Vercel function, and wrote the run with the GitHub org attribution. The
goal was zero-config — install the App and runs just appear.

Three problems:

1. **Hot-path infrastructure cost.** Cloning + scanning runs on Vercel
   serverless. Slow (8+ seconds), expensive (function memory + bundle), and
   limited by the platform's `outputFileTracingIncludes` machinery. We
   shipped four `next.config.ts` workarounds in a row to keep the function
   bundle resolvable (ADR-0017's tarball fallback was the last).
2. **Trust model.** Server-side scans rely on the agentlint binary in the
   function bundle. Pinning a CLI version inside the web bundle means
   every CLI release requires a coordinated web redeploy.
3. **Customer impedance.** Real teams want to plug agentlint into their
   *existing* CI (Actions, CircleCI, GitHub Actions matrix) where they
   already have caches, secrets, and environment parity. Running scans on
   our infra duplicates that work.

**Decision.** Stop scanning on the server. The CLI runs wherever the team
prefers (CI or laptop) and POSTs scan results to `/api/runs` with a project
token. Provenance is a separate signal:

- If `GITHUB_ACTIONS=true`, the CLI fetches the workflow's OIDC ID token
  from `$ACTIONS_ID_TOKEN_REQUEST_URL` + `$ACTIONS_ID_TOKEN_REQUEST_TOKEN`,
  audience `agentlint`. The server verifies the JWT against GitHub's JWKS
  and checks `claims.repository == projectRow.repoOwner/repoName`. If
  valid: `source = ci`, `provenance = oidc-verified`.
- If no OIDC token is presented (local laptop, or CI without the
  `id-token: write` permission), the server stores `source = local`,
  `provenance = unverified`. The dashboard renders the badge.

Local runs are accepted as-is. We do not gate ingest on provenance. The
dashboard shows the provenance label so consumers can decide.

**What stays on the App webhook.** The `installation`, `installation_repositories`,
and `installation.suspend`/`unsuspend` events still update the `installation`
table — we need installation IDs to mint short-lived tokens for posting PR
comments. PR comments themselves still trigger from `/api/runs` ingest when
the project has a connected installation. The `push` event handler is now a
no-op.

**Consequences.**

- Vercel function bundles shrink dramatically (no `@agentlinthq/cli` in
  `dependencies`, no `tar`, no `outputFileTracingIncludes` complexity).
- `next.config.ts` returns to the default. ADR-0014's `serverExternalPackages`
  workaround is no longer needed.
- CLI bumps to v2.0.0 with a new payload shape and the `init` subcommand.
- Customers see a clear setup path: install App on the org (for PR comments)
  → link a project → mint a token → drop it into CI.

## ADR-0020 — `.agentlint.json` is checked in; tokens are not

**Date:** 2026-05-10.

**Status:** Accepted.

**Context.** With per-project tokens, we need a way for the CLI to know
"this checkout is project X under org Y." Options: command-line flags every
time, a CI-only env var, or a checked-in config file.

**Decision.** Use a checked-in `.agentlint.json` at repo root.

```json
{
  "version": 1,
  "projectId": "01J…",
  "orgSlug": "agentlint",
  "repoOwner": "agentlint",
  "repoName": "agentlint",
  "prodBranch": "main"
}
```

- `projectId` and `orgSlug` identify which dashboard the run lands in.
- `repoOwner` / `repoName` echo GitHub identity (useful for offline reports
  and for human readers).
- `prodBranch` lets the CLI default `--branch` resolution.
- The file is human-editable and reviewable in PRs.

**Crucially: the token is NOT in this file.** Tokens come from
`AGENTLINT_TOKEN` env. In CI: a GitHub Actions secret. Locally: a developer's
shell env. Leaking the config file is fine; leaking the token is not.

**Why a JSON file, not `.env`?** Two reasons. (1) JSON forces structured
values that the CLI validates with Zod-equivalent shape checks. (2) `.env` is
gitignored by convention; `.agentlint.json` is meant to be checked in.

## ADR-0021 — Branch protection: PR-only main on agentlint-sh

**Date:** 2026-05-10.

**Status:** Accepted, partial enforcement (see below).

**Context.** The CLI repo (public) and the website repo (private) had
identical loose policies: any push to main was accepted. As the project moves
toward paying customers, mainline integrity matters more, and Vercel preview
deployments give us a free pre-merge verification step.

**Decision.** All changes land on `main` only through a pull request from
either `dev` (long-lived integration branch) or `feat/*` (short-lived
feature branches). Direct pushes to main are forbidden.

Enforcement on the **CLI repo** (public): GitHub branch protection on
`main` requiring (a) PR, (b) status check `ci` green, (c) up-to-date with
base. Force-push and deletion blocked. Configured via `gh api PUT
/repos/agentlint/agentlint/branches/main/protection` — public repos on
GitHub Free can use branch protection.

Enforcement on the **website repo** (private): GitHub Free does NOT permit
branch protection or rulesets on private repos (HTTP 403 from the API). As
a fallback we run two belt-and-suspenders checks:

1. **Local `pre-push` hook** at `.githooks/pre-push` — refuses to push to
   `main`. Enable per clone: `git config core.hooksPath .githooks`.
2. **CI workflow** `.github/workflows/branch-policy.yml` — fails when a push
   lands on `main` whose head commit message doesn't include `(#NN)` (the
   GitHub squash/merge-commit marker). Cannot revert the push, but flags
   the breach in the actions tab and via email.

If the website repo flips to public, or we upgrade to GitHub Pro, swap the
fallback for first-class branch protection. The husky hook and workflow can
stay — they're cheap redundancy.

**Consequence.** All future website work goes `feat/x → dev → main`. Vercel
preview deploys give us the pre-merge gate. The branch policy notebook in
PLAYBOOK.md walks through the flow.

## ADR-0022 — Two GitHub Apps: one per environment

**Date:** 2026-05-10.

**Status:** Accepted. `agentlint-ci` continues to serve production
(`agentlint.sh`). New `agentlint-ci-preview` serves `preview.agentlint.sh`
(and local development via the same App).

**Context.** After v2 shipped, the dashboard exposes the GitHub App
installation flow (Vercel-style repo picker on the new-project page).
That flow needs:

1. The agentlint-ci webhook to fire on `installation.created` so we can
   cache the repos in `installation.repos`.
2. The webhook handler at `/api/github/webhook` to be reachable from
   GitHub at a URL configured on the App.
3. The webhook signature to verify against `GITHUB_APP_WEBHOOK_SECRET`.

The slice-7 App `agentlint-ci` was set up with **one** webhook URL —
`https://agentlint.sh/api/github/webhook`. Preview deployments at
`https://preview.agentlint.sh` never received any webhook events, so
their `installation` table stayed empty even after a user installed the
App. The repo picker showed the "no repos found, install the App" CTA
on preview indefinitely.

Three options considered:

- **Share one App, route webhooks to prod only.** Simplest; matches what
  slice 7 did. But preview cannot test webhook handling at all, and any
  schema change touching the install table must ship to prod before
  we can test it on a preview deploy.
- **Share one App, multiplex webhooks** (e.g., via a proxy or duplicate
  delivery to both URLs). GitHub doesn't support multi-URL webhook
  delivery; would need a relay service. Operational overhead not
  justified at our scale.
- **Two Apps, one per environment.** Each App points at its own webhook
  URL. Each environment's `installation` table is populated only from
  that App's deliveries. Users install whichever App matches the
  environment they're operating in.

**Decision.** Two Apps.

| App | Webhook URL | Used by |
|---|---|---|
| `agentlint-ci` (App ID 3668343) | `https://agentlint.sh/api/github/webhook` | production |
| `agentlint-ci-preview` (App ID 3670537) | `https://preview.agentlint.sh/api/github/webhook` | preview + development |

The App slug, webhook secret, and private key live in environment-scoped
env vars:

- `GITHUB_APP_SLUG` — used to build the install URL the dashboard
  surfaces (`https://github.com/apps/<slug>/installations/new`).
- `GITHUB_APP_ID` — for JWT minting.
- `GITHUB_APP_WEBHOOK_SECRET` — for verifying webhook signatures.
- `GITHUB_APP_PRIVATE_KEY_B64` — base64-encoded PEM, decoded at runtime.

The dashboard code reads `process.env.GITHUB_APP_SLUG` to decide which
App to link the user to. Falls back to `agentlint-ci` if unset.

**Setup URL** on each App must point at
`https://<env>.agentlint.sh/api/github/post-install`. The repo picker
appends `?state=<orgSlug>` to the install URL; GitHub forwards `state`
to the Setup URL after install; our `/api/github/post-install` reads
state, sanitizes the slug, and redirects to
`/dashboard/orgs/<slug>/projects/new?installed=1` so the user lands
back where they came from instead of a generic `/dashboard`.

**Consequences.**

- Users installing on production install `agentlint-ci`; users
  installing from a preview install `agentlint-ci-preview`. A user
  testing both sees two `installation` rows in the two databases
  (Neon production branch vs dev branch).
- Local development (`pnpm dev` against the dev Neon branch with the
  preview env vars pulled via `vercel env pull`) uses the same
  preview App. No third App needed.
- When iterating on webhook handling logic, preview is now a real test
  surface — `installation.created/deleted/suspend/repositories` events
  flow through the preview deploy first.
- Charter §3 (local-first, no telemetry on the CLI) is unaffected: the
  CLI never talks to either App. The Apps are a dashboard / web
  concern.

**Edge cases.**

- Users without the App installed see the empty-state CTA on the
  new-project form pointing at the correct env's App.
- Users with the App on one org but not another see a
  `+ Add another GitHub account` button that re-opens the install flow
  with `state=<orgSlug>` preserved.
- The CLI ingest path (`POST /api/runs`) does NOT depend on App
  installations — project tokens are sufficient. Apps exist only for
  the dashboard repo picker and for posting PR comments. A repo can
  ingest scores without ever installing the App; PR comments simply
  won't be posted in that case.

## ADR-0023 — CLI device-flow OAuth (RFC 8628) for `agentlint login`

**Date:** 2026-05-10.

**Context.** v2.0.0 made the user copy a project token out of the
dashboard and paste it into `AGENTLINT_TOKEN`. Every onboarding session
since cutover has had at least one paste-error or "where do I put this"
moment. The hosted product is meant to feel like a developer tool, not
a config-file scavenger hunt.

**Decision.** `agentlint login` runs the IETF RFC 8628 OAuth 2.0 Device
Authorization Grant against `agentlint.sh`. The CLI calls
`POST /api/cli/auth/device`, gets a short `user_code` (formatted
`XXXX-XXXX`) and a long `device_code`, prints the verification URL,
polls `POST /api/cli/auth/poll` every `interval` seconds, and on
approval receives a project token (`agl_proj_…`) which it writes to
`~/.config/agentlint/token` with mode `0600`.

The user's flow on the web side is a new `/cli/auth` page that
auto-fills the `user_code` from the query string, asks them to pick an
org, and posts approval to `POST /api/cli/auth/approve` which mints
the token server-side.

**Alternatives considered.**

- **Custom setup-link flow** (CLI generates a nonce, opens browser,
  user signs in and confirms, CLI polls a setup endpoint). Same UX
  but a private protocol shape — no off-the-shelf documentation, no
  spec test fixtures, harder for third-party clients later.
- **GitHub OAuth exchange directly.** CLI opens browser to GitHub's
  OAuth, gets a code back, exchanges it server-side for a project
  token. Adds a third-party hop and surfaces the wrong identity model
  (GitHub user, not agentlint org). Rejected.
- **Personal-access-token paste** (status quo). Works but loses the
  whole point of this slice.

**Consequences.**

- New table `cli_auth_grant` lives at the web layer (Drizzle in
  `db/schema.ts`). Migration `db/migrations/0001_cli_auth_grant.sql`.
- Token resolver in the CLI now reads from `~/.config/agentlint/token`
  as a fallback after `--token` flag and `AGENTLINT_TOKEN` env.
- Charter §3 (local-first, no telemetry) is honored: `agentlint
  login` is an explicit opt-in subcommand. The default `agentlint .`
  code path still does not phone home.
- Grant TTL is 10 minutes. Once-redeemable. `token_plaintext` is
  cleared on first successful poll.
- Rate limits: 10/min/IP on `/device`, 30/min/device_code on `/poll`,
  5/min/user on `/approve`.

**Out of scope (follow-up).**

- Auto-uploading `AGENTLINT_TOKEN` as a GitHub Actions repo secret via
  the App API requires the `secrets:write` permission, which would
  force every existing install to re-consent. Tracked in
  `docs/prds/cli-secret-autoupload.md` (TBD).

## ADR-0024 — `agentlint-feature-pipeline` skill rewritten generic

**Date:** 2026-05-10.

**Context.** The original `.claude/skills/agentlint-feature-pipeline/`
skill was hard-coded to "pick the next unfinished P1 vertical slice
from `docs/PROJECT_STATE.md`." That made sense while items 4–9 were the
queue; it's brittle now that the P1 list is mostly done and new
features come from user requests that don't fit any pre-existing slot.

**Decision.** The skill now accepts two input modes:

- **Mode A — explicit feature.** The user supplied a feature
  description in the prompt; the skill restates it, then runs the
  pipeline against it.
- **Mode B — no feature specified.** The skill opens
  `docs/PROJECT_STATE.md` and picks the lowest-numbered unfinished
  item across P0, P1 (paid-tier track), P1 (leaderboard track), P1
  (hygiene), then P2.

The pipeline order is unchanged: `RESTATE → grill-me → to-prd →
to-issues → tdd → close-out → summary`. Charter constraints are
unchanged.

**Consequences.**

- Any agent running `/agentlint-feature-pipeline` with a custom feature
  description now follows the same shape and produces the same
  artefacts (PRD in `docs/prds/`, ADR if needed, issues, TDD
  commits, PROJECT_STATE update).
- Parallel sub-agent dispatch is now a first-class step in the skill,
  with explicit rules for when issues are independent and when to
  fall back to sequential.
- The skill is also clearer about the repo split — every PRD lives in
  the CLI repo regardless of where the code lands.

## ADR-0025 — Auto-upload `AGENTLINT_TOKEN` as a repo Actions secret

**Date:** 2026-05-10.

**Context.** `dashboard-ux-cli-autoconnect` (ADR-0023) removed the
manual paste of the token into the CLI environment. But every user
still had to open
`https://github.com/<owner>/<repo>/settings/secrets/actions/new` and
paste the token into a GitHub Actions repo secret named
`AGENTLINT_TOKEN`. The agentlint GitHub App is already installed on
those repos for PR-comment posting — it has every credential it
needs to push the secret programmatically.

**Decision.** Add a server route `POST /api/projects/:id/install-secret`
that mints a fresh project token, encrypts it with libsodium
sealed-box against the repo's Actions public key, and PUTs to
`/repos/:owner/:repo/actions/secrets/AGENTLINT_TOKEN` using the App's
installation token. The CLI calls this route during `agentlint init`
(default on, `--no-install-secret` opts out) and via the new
`agentlint install-secret` subcommand.

**Alternatives considered.**

- **Pass-through of the local token.** The route accepts the user's
  existing token and writes it back as the secret. Simpler, but ties
  the CI lifecycle to the local-dev token — `agentlint logout` would
  silently break CI. Rejected.
- **Encrypt on the client.** CLI fetches the public key and encrypts
  locally. Adds libsodium to the CLI bundle (~30KB) and requires a
  GitHub API call from the CLI, which crosses the local-first
  boundary harder than the route call does. Rejected — server-side
  encryption is also where the App's install token lives.
- **A separate `project_secret_installation` table.** Cleaner audit
  trail but no extra requirements yet justify it. Use two columns on
  `project` (`actions_secret_installed_at`, `actions_secret_last_error`).

**Consequences.**

- **The agentlint GitHub Apps need a permission bump:** add
  `Secrets: Read & write` on Actions to both `agentlint-ci` (prod App
  ID 3668343) and `agentlint-ci-preview` (preview App ID 3670537).
  This is a manual step on each App's Settings page in GitHub UI;
  existing installations will see a re-consent prompt on their next
  App-aware interaction. Documented in PROJECT_STATE under "Pending —
  human action."
- Migration `db/migrations/0002_project_actions_secret.sql` is
  additive and reversible.
- The dashboard project page gains a "GitHub Actions secret" panel
  showing the install state.
- The CLI is still local-first: the new network call only happens on
  subcommand invocation or as the closing step of `agentlint init`,
  both of which are explicit user actions.
- A fresh token is minted at install-time, not passed through. The
  user's local token file (`~/.config/agentlint/token`) remains a
  separate credential. Effect: revoking either does not affect the
  other.

**Out of scope (followups).**

- Org-level Actions secrets. Would need different permissions and a
  different UI.
- Other CI providers (GitLab, CircleCI). No demand yet.

## ADR-0026 — OIDC-only CI auth supersedes ADR-0025

**Date:** 2026-05-10.

**Context.** ADR-0025 added auto-upload of `AGENTLINT_TOKEN` as a
repo Actions secret via the agentlint GitHub App. Shipping that
required bumping the App permissions to include
`Secrets: Read & write`, which lets the App enumerate every Actions
secret name on the installed repo. The encrypted values stay private,
but the *list* of secret names is readable, and overwrites are
possible — a substantial trust ask for a "lint" tool that the user
adopted to run on push.

The maintainer pushed back: most modern CI integrations either
(a) require a manual paste, (b) use OIDC federation and need no
secret at all, or (c) run on their own infrastructure. Vercel,
Cloudflare Workers, AWS / GCP / Azure CLIs, Codecov for public
repos — none of them ask for `Secrets: write`.

We already trust GitHub Actions OIDC for run-level provenance
(ADR-0019). The same JWT carries the repo identifier in its
`repository` claim; we can use it as the auth credential itself, not
just a supplementary provenance signal.

**Decision.** `POST /api/runs` now accepts OIDC **alone** as the auth
credential. The flow:

1. CI step calls the CLI with no `AGENTLINT_TOKEN` env.
2. The CLI fetches a GitHub Actions OIDC JWT with `audience=agentlint`
   and POSTs it in the `x-github-oidc` header.
3. The server verifies the JWT signature against GitHub's JWKS,
   confirms `iss = https://token.actions.githubusercontent.com`,
   extracts the `repository` claim, and looks up the matching
   `project` row by `(repoOwner, repoName)`.
4. On match, the run is inserted with `tokenId = null`,
   `source = "ci"`, `provenance = "oidc-verified"`.

The install-secret feature from ADR-0025 is deleted:

- Web: `POST /api/projects/:id/install-secret` route, the
  libsodium-based helper, the `secret-panel` component, and the
  `project.actions_secret_installed_at` / `actions_secret_last_error`
  columns are gone. Migration
  `0003_drop_actions_secret_columns.sql` rolls them back.
- CLI: the `install-secret` subcommand and its integration with
  `agentlint init` are removed. The generated workflow drops the
  `env: AGENTLINT_TOKEN: ${{ secrets.AGENTLINT_TOKEN }}` block.
- The `libsodium-wrappers` dependency is removed from the web app.

**Consequences.**

- The agentlint GitHub Apps stay on their existing permission set
  (`Pull requests: R/W`, `Contents: R`, `Checks: R/W`,
  `Metadata: R`). **No re-consent ask on existing installs.**
- A fresh GitHub user setting up CI for the first time runs:

      $ agentlint login           # one device-flow login (local-dev)
      $ agentlint init            # writes config + workflow file
      $ git push                  # CI runs, OIDC-verified, no secret

  Zero paste, zero secret on the repo, zero App permission bump.
- Local-dev pushes (the `agentlint --push` invocation outside of
  GitHub Actions) still use the `agl_proj_…` token resolved from
  `--token` flag → `AGENTLINT_TOKEN` env → `~/.config/agentlint/token`
  file. Local-first invariant unchanged.
- A bearer-token presented with an invalid token now hard-fails 401
  rather than falling back to OIDC. The fallthrough would have
  allowed a probe for project IDs; the secure default is to reject
  any presented credential that doesn't validate.

**Rollback.** Both pivots are reversible. `git revert` on the two
merge commits restores the install-secret feature and the bearer-only
auth gate. The dropped `libsodium-wrappers` package can be re-added
in the same revert.

**Out of scope.**

- **Server-side scan on push.** ADR-0019 deferred this and the
  maintainer flagged it as the natural next step ("how does Vercel do
  it?"). The path is documented but not implemented: install the App
  → on `push` webhook, server fetches files via GitHub Contents API
  (preferred, no clone, no Actions, no compute beyond an API call) or
  shallow-clones the repo (fallback for large repos), runs agentlint,
  inserts the run row, posts the PR comment. Tracked as the next
  `/agentlint-feature-pipeline` slice with slug
  `server-side-scan-on-push`. This ADR is the necessary pre-requisite
  — without OIDC-only ingest, the CLI vs. server distinction was
  muddled by the token expectation.

## ADR-0027 — Server-side scan on push supersedes ADR-0019

**Date:** 2026-05-10.

**Context.** ADR-0019 removed server-side scans when v2 cut over to the
project-token model. The argument was: cost of cloning every push for
~30 lint rules is unclear, the CLI's `--push` from the user's CI gives
the same signal, and we'd prefer a clean trust boundary (OIDC
provenance) over server-executed scans.

The maintainer revisited this after the OIDC-only pivot (ADR-0026):
"how does Vercel do it?" The honest answer was — Vercel clones in
their own infrastructure on every push and the user writes nothing.
With a paid hosted tier we should be doing the same. ADR-0019's
deferral was the right call at v2 cutover; it isn't anymore now that
the dashboard is real.

**Decision.** `POST /api/github/webhook` now handles `push` events
end-to-end:

1. Verify HMAC signature (existing).
2. Filter to default-branch pushes + open-PR-head pushes; tag pushes
   and other branches are ignored.
3. Look up the `installation` row + the `project` row by
   `(repoOwner, repoName)`. No project for this repo → 200 +
   `{ status: "no_project" }`. The user installed the App but
   hasn't created a project yet.
4. Idempotency check against `(project_id, commit_sha,
   source="server")`. Duplicate → 200 + `{ status: "duplicate" }`.
5. Schedule the scan via Next.js `after()` so the webhook returns
   inside GitHub's 10s budget.

The scan worker:

- Mints an installation token (existing `lib/github-app/auth.ts`).
- Validates `owner/repo/branch/sha` against
  `^[a-zA-Z0-9._/-]+$` before any shell call.
- `git clone --depth=1 -b <branch> -- <safe_url> <tmpdir>` with the
  `--` separator as belt-and-braces against URL-injected options.
- 30s clone timeout, 200MB max repo size (post-clone walk via
  `readdir` + `stat`).
- Imports the agentlint scanner programmatically via
  `@agentlinthq/cli/dist/rules/index.js` + `@agentlinthq/cli/dist/scan-context.js` +
  `@agentlinthq/core` (the CLI's `main` is an executable entry, so a
  proper `runScan` export is a follow-up).
- Inserts the `run` row with `source = "server"`, `provenance =
  "server-scanned"`.
- On a push to an open-PR head, calls the existing
  `postOrUpdatePrComment` helper.
- `rm -rf` of the temp dir runs in `finally`; the URL with the
  embedded token is overwritten in memory before return.

**Alternatives considered.**

- **GitHub Contents API instead of clone.** Faster (no disk, no
  spawned git process) but requires every rule to learn a
  remote-read interface — half the rules use globs and recursive
  reads that don't trivially map to `GET /repos/.../contents/...`.
  Rejected for now; revisit when a specific cost bottleneck
  appears.
- **`npx @agentlinthq/cli` as a subprocess.** Cold-start cost on
  every push is real (npm fetch the first time, ~5-10s). In-process
  import is faster and keeps the dep version pinned.
- **Vercel KV / Upstash queue.** Overkill for the current scale.
  `after()` is the smallest credible footprint. If we lose a scan
  to a function eviction, GitHub's webhook retry settings (built-in
  to the App) will redeliver and our idempotency key absorbs it.

**Consequences.**

- **No new App permission required.** Existing perms (`Contents: R`,
  `Pull requests: R/W`, `Checks: R/W`, `Metadata: R`) are enough.
  The Apps don't need re-consent.
- **Zero user-side config.** Install the App → push → row appears.
  Vercel-like UX.
- **CLI workflow path stays as a fallback.** `agentlint init` still
  works; OIDC-only Actions (ADR-0026) is still valid. Server-side
  scan is now the default; Actions is for huge repos or users who
  want CI control.
- **Compute cost** lives on our side (Vercel functions). Cap is
  `maxDuration: 60` + 200MB repo + 30s clone. Larger repos abort
  with a logged reason.
- **Trust boundary.** Server is now the trusted scanner — same
  posture as Vercel's "we built it on our infra." Score-of-100 on
  the CLI repo's self-audit is unaffected (CLI code untouched).

**Rollback.** Feature flag `SERVER_SIDE_SCAN_ENABLED` (env var). Set
to `false` on Vercel to disable the path without a revert. Full
revert: `git revert` on the merge commit; `@agentlinthq/cli` dep can
stay idle in `package.json`.

**Out of scope (followups, none blocking).**

- A `runScan` programmatic export on `@agentlinthq/cli` to replace
  the deep imports.
- A logs table for failed scans (currently `console.error` only).
- Per-org compute budget + warning before throttling.
- Selective rule execution (e.g. skip documentation rules on every
  push, run them weekly).

## ADR-0028 — Dashboard UX overhaul: nav, manual scan, run detail, filters, charts

**Date:** 2026-05-10.

**Context.** The hosted dashboard shipped functional but the UX was a
mess: no global nav (browser back-button only), the marketing header
always rendered "Sign in" even for signed-in users (clicking it
looped them through `/login`), no way to trigger a scan on demand,
no first-run scan on project creation, the runs list had zero
filtering/sorting, and clicking a row did nothing — even though the
per-rule report was already stored on `run.report_json`. Per-project
charts were also missing.

**Decision.** One large, additive PR fixes all seven gaps in six
commits on `feat/dashboard-ux-overhaul`:

1. `<SiteHeader />` becomes a server component that reads the
   Better-Auth session and renders "Open dashboard" or "Sign in"
   accordingly. `/login` redirects signed-in users to
   `/dashboard`.
2. `<DashboardNav />` renders on every `/dashboard/*` page —
   breadcrumbs, org switcher (visible when the user has >1 org),
   account menu with email + Sign out. Nav is rendered per-page
   (passed context from the page's already-loaded params); Next.js
   nested layouts would either double-render or force every page
   to re-implement context propagation.
3. `POST /api/projects/:id/scan-now` invokes the existing
   `runServerScan` worker against the project's `prodBranch` HEAD.
   Rate-limited 5/min/project. Returns 202 + `runId`. The same
   helper (`lib/server-scan/schedule.ts`) is invoked from
   `POST /api/projects` after a new project row commits — when the
   App is installed, the first scan happens automatically without
   waiting for the user to push.
4. `GET /api/projects/:id/runs?branch=&source=&from=&to=&sort=&limit=&offset=`
   — zod-validated filters and sort, 60/min/session rate limit.
5. `/dashboard/orgs/[slug]/projects/[projectId]/runs/[runId]`
   renders the full `report_json` grouped by category (Discoverability,
   Buildability, Convention clarity, Documentation surface, Safety &
   guardrails). Defensive against malformed shapes.
6. Project page gains a "Run scan now" button (client component),
   a 220×60 server-rendered SVG score-over-time line chart, a
   server-rendered SVG top-failing-rules bar chart, the filter
   GET-form, and runs-table row links to the new detail page.

**Alternatives considered.**

- **Nested Next.js layouts for the dashboard nav.** Cleaner in
  theory but requires every nested route to thread params via
  React context, and the org-switcher needs the current org slug
  from the URL — easier and faster to pass per-page. Reconsider
  when a global state store is needed.
- **A charts library (`recharts`, `d3`, `victory`).** Each adds
  ~30-100KB to the dashboard bundle; the existing sparkline
  helper (`lib/dashboard/trend.ts`) and the badge SVG renderer
  already prove hand-rolled SVG is sufficient. Reuse the
  pattern; ship no new deps.
- **Polling for new run rows after `scan-now`.** WebSockets or
  SSE would feel snappier but introduces a long-lived connection
  + reconnect logic. For this slice the user clicks → toast
  appears → row appears on the next `router.refresh()` (within
  ~5s). Good enough.
- **Saved filters / shareable URLs.** The query-string-driven
  filter form is already shareable by URL copy; saving on the
  user record is a follow-up.

**Consequences.**

- 66 new tests on the web repo (170 → 236). All commits pass
  `pnpm test` and `pnpm run typecheck`.
- No schema migration. Everything renders from existing columns.
- No new external dependency.
- The push-webhook handler is **not** touched — `runServerScan`
  is the shared work primitive; the new
  `lib/server-scan/schedule.ts` helper extracts the scheduling
  pattern so `scan-now` and project-create-auto-scan share it
  without disturbing the webhook path.
- The CLI is **not** touched at all (charter §3 honored).

**Rollback.** Single `git revert` on the merge commit. No
migration to roll back. The CLI is unaffected.

**Out of scope (followups).**

- Org-level dashboard rollups across all projects (PROJECT_STATE
  item 8).
- Policy thresholds — CLI exits non-zero when a project's
  threshold is breached (PROJECT_STATE item 9).
- Saved filters on the user record.
- Real-time updates (polling/SSE/websockets).
- Run-vs-run comparison view.

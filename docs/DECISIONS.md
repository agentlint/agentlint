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

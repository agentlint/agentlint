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

**Why.** The first run is almost always a human running `npx agentlint`.
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
(critical for `agentlint` shipping a real `@agentlint/core` dep). bun
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

## ADR-0008 — Monorepo split: `@agentlint/core` (pure, no IO) and `agentlint` (CLI)

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

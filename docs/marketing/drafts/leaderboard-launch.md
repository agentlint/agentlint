# DRAFT — Leaderboard launch post

**Status:** Draft only. Charter §3.2 forbids public publishing tonight.
Do not post until the maintainer reviews.

**Target channels (in priority order):**

1. agentlint.sh blog
2. HN (Show HN)
3. X / Twitter
4. GitHub Discussions announcement

## TL;DR

We just launched a public leaderboard of the top 100 most-starred GitHub
repos, ranked by `@agentlinthq/cli`. Same rubric your repo will be scored
by. Updated weekly. Source code and weights are open.

- **Page:** https://agentlint.sh/leaderboard
- **Methodology:** https://agentlint.sh/leaderboard/methodology
- **Source + weights:** https://github.com/agentlint/agentlint
- **Aggregated JSON:** committed to the public CLI repo under
  `tools/leaderboard/data/aggregated/`

## Why now

agentlint's whole pitch is "an objective score for how agent-ready a repo
is." A pitch like that needs a public scoreboard, not just a CLI. The top
100 GitHub repos are the obvious first cohort — they're already public,
they're the references agents are most likely to crawl, and they cover the
full range of project shapes (frameworks, languages, dev tools, OS
projects, demo repos).

## What we're not doing

- We're not weighting, reweighting, or curating the ranking. The score is
  what the score is.
- We're not running a leaderboard of "best maintained" or "most active"
  repos. agentlint scores agent-readiness, not project health.
- We're not gating any of this behind a paywall.

## How it works

1. Every Monday at 06:00 UTC, a GitHub Action runs the leaderboard tool.
2. The tool fetches the top 100 most-starred public GitHub repos, shallow-
   clones each, runs `@agentlinthq/cli` against it, and aggregates results.
3. The JSON is committed back to the public CLI repo
   (`tools/leaderboard/data/aggregated/<YYYY-MM-DD>.json`).
4. agentlint.sh reads the latest JSON via a 24-hour edge cache.

## Anti-gaming clause

A high score means the repo's signals look agent-ready. It does not mean
the code is good, the project is healthy, or the maintainers are
responsive. Don't read more into the ranking than that.

## Open suggestions

- Should we publish a "biggest movers" diff each week once we have two
  weeks of data?
- Should we let repo owners opt out? (Default position: no — the data is
  derived from public code.)
- Should we add a "language leaderboard" view? (Probably yes once we hit
  cadence.)

---

**Charter check (do not skip):**

- §3.1 — internal tooling + public page: ✅ shipped tonight.
- §3.2 — public-facing post: ❌ escalated, awaiting maintainer review.
- Score-of-100 invariant: ✅ self-audit still 100/100.
- Public scoring API: untouched.

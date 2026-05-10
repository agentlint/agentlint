# Leaderboard launch asset

> Spec for the "State of agent-readiness 2026" launch asset. The biggest
> SEO/GEO play in the launch plan: a static, sortable leaderboard scoring
> the top-N most-starred public GitHub repos with agentlint, paired with a
> blog post analyzing the results.

## Why this asset

1. **Backlink magnet.** Every developer whose repo lands in the top 100
   has a reason to share it. Every developer whose repo lands at the
   bottom has a reason to argue with it.
2. **GEO bait.** When somebody asks an AI assistant "what's the most
   agent-ready open-source project?", we want this page to be the
   citation source.
3. **Self-validating use case.** The leaderboard exists *because*
   agentlint exists. It's the most credible demo of the tool we can
   build.

## Scope of v1

- **Sample size:** top 1,000 public GitHub repos by star count, English
  primary language, filtered to remove archived and forked repos.
- **Output:** a static HTML page hosted at `agentlint.sh/leaderboard`,
  rebuilt weekly via a GitHub Action.
- **Data shape:** one row per repo with score, category breakdown,
  language, stars, last-commit-date, badge link.
- **Companion artifact:** a blog post at `agentlint.sh/blog/state-of-agent-readiness-2026`
  with the methodology, top 10 callouts, the histogram of scores, and
  the funniest fails (with permission or anonymized).

## Out of scope for v1

- Trends over time (need at least four weeks of weekly snapshots first).
- Per-language sub-leaderboards (ship after v1 if traffic justifies).
- "Submit your repo" form (lives in the hosted dashboard, not here).
- Badges that pull live data (stays static; static badge per row is
  fine).

## Architecture

```
tools/leaderboard/
  src/
    fetch-repos.ts        Pull top-N repos from GitHub Search API
    clone-and-scan.ts     Shallow-clone each repo, run agentlint, capture report
    aggregate.ts          Read all reports, write one consolidated JSON file
    render-page.ts        Render JSON → static HTML
    render-blog.ts        Render JSON → Markdown blog post draft
  data/
    raw/<date>/<owner>--<repo>.json
    aggregated/<date>.json
  out/
    leaderboard.html
    leaderboard.json
    blog-draft.md
  README.md
  package.json
```

**Runner:** standalone Node script under `tools/leaderboard/`. Not part
of the published `@agentlinthq/cli` package; not part of the self-audit.
Lives in the same monorepo because it depends on
`@agentlinthq/core` and the same rule definitions, and we want it to
break loudly if the rule set changes shape.

## Pipeline

```
1. fetch-repos.ts
   - GET https://api.github.com/search/repositories
   - q: stars:>1000 fork:false archived:false
   - sort: stars, order: desc
   - paginate: 10 pages × 100 = 1,000 results (GitHub's search ceiling)
   - write: data/raw/<date>/index.json with [{owner, repo, stars, default_branch, language}]

2. clone-and-scan.ts
   - for each entry:
     - shallow clone: `git clone --depth=1 https://github.com/<owner>/<repo>`
     - run: `node packages/cli/dist/index.js --json . > data/raw/<date>/<owner>--<repo>.json`
     - rm -rf the clone
   - parallelism: 8 concurrent clones, abort on any single repo timeout (60s)
   - log failures separately so the aggregator knows what to skip

3. aggregate.ts
   - read every *.json in data/raw/<date>/
   - merge with the index metadata (stars, language, etc.)
   - write data/aggregated/<date>.json with one entry per scanned repo

4. render-page.ts
   - read data/aggregated/<date>.json
   - emit static HTML with: sortable table (vanilla JS + ARIA), one card per top-10 repo
   - inline all CSS, inline minimal JS for client-side sort
   - target page weight < 200 KB total

5. render-blog.ts
   - read data/aggregated/<date>.json
   - emit Markdown: top-10 commentary, score histogram, methodology, callouts
   - human reviews + edits before publishing (the agent drafts; the human approves the framing)
```

## Rate-limit and ToS hygiene

- **GitHub Search API** is 30 req/min unauthenticated, 30 req/min
  authenticated. Use a fine-grained read-only PAT with `metadata:read`
  to lift the rate limit. Wait between paginations.
- **Clone load:** 1,000 shallow clones at 8 concurrent ≈ 5–15 minutes.
  Acceptable. Run from a single CI machine, not in parallel jobs, so
  GitHub's abuse-detector doesn't flag the spike.
- **Storage:** raw scans for one date ≈ ~50 MB. Keep the latest 4 weeks
  in-repo; archive older snapshots to a separate `agentlint/archive`
  repo or to S3.
- **Identification:** set `User-Agent: agentlint-leaderboard/1.0
  (+https://agentlint.sh/leaderboard)` so anyone reviewing logs can
  match the traffic to a public, contactable project.

## Page design

Two stacked sections.

### Section 1: Top 10 cards

Each card: rank, repo name + stars, score in big type, the three lowest
categories, link to the full report (`agentlint-report.html` for that
repo, hosted alongside on Vercel).

### Section 2: Full table (rank 1–1000)

Columns:

| Rank | Repo | Stars | Language | Score | Discoverability | Buildability | Conventions | Documentation | Safety |
|---|---|---|---|---|---|---|---|---|---|

Client-side sortable on every column. Default sort: score descending
(unscored / errored repos at the bottom).

Each row: anchor on the rank so individual rows have a permalink
(`#rank-42`).

## Methodology section (always visible)

Plain prose, on the page itself, not buried in a footer:

> The leaderboard scores the 1,000 most-starred public GitHub repos that
> are not archived and not forks. Each repo is shallow-cloned, scanned
> by `@agentlinthq/cli` at the version pinned at the top of this page,
> and scored by the same rubric used everywhere else. We do not weight,
> reweight, or curate the rankings. The full per-repo JSON report is
> linked from each row. Run date and CLI version are stamped at the top
> of the page. If your repo's score looks wrong, the report is the
> source of truth — open an issue with the JSON attached.

## Anti-gaming clause

> A high agentlint score means the repo's signals look agent-ready.
> It does not mean the code is good, the project is healthy, or the
> maintainers are responsive. It does not mean an AI agent will succeed
> in the repo. We will not de-rank or curate based on subjective
> judgments about quality, popularity, or politics. The score is what
> the score is.

## Blog post outline (draft)

```
# State of agent-readiness 2026

## The setup
- 1,000 public repos by stars
- Scanned with @agentlinthq/cli vX.Y.Z on YYYY-MM-DD
- Methodology link
- Caveats: stars != quality, sample skews to popular languages, etc.

## The headline numbers
- Median score across the sample
- % above 80, % above 50, % below 30
- Best category, worst category

## Top 10
- Highlight each, with a one-line "what they did right"

## Bottom 10
- Anonymized OR, where the project signals it's fine, named
- Pattern of what tends to fail

## Surprising patterns
- E.g. repos with > 50k stars but no AGENTS.md
- E.g. monorepos vs. single-package skew
- E.g. language-by-language average

## What we'll do next
- Weekly snapshot, watch the trend line
- Per-language leaderboards if there's demand
- Publish the raw data so others can replicate
```

## Schedule

- **Week of launch:** publish the leaderboard and the blog post on the
  same day as the HN/X launch.
- **Then:** rebuild weekly via cron-triggered GitHub Action; only
  publish a *fresh* blog post when the headline numbers move
  meaningfully.

## Definition of done for v1

- [ ] `tools/leaderboard/` package builds.
- [ ] One full pipeline run completes against the live top-1000 in under
      30 minutes, end to end, on a clean machine.
- [ ] Output HTML weighs < 200 KB gzipped.
- [ ] Output table is keyboard-navigable and screen-reader-readable.
- [ ] Page has correct OG tags.
- [ ] Blog post draft exists at `agentlint.sh/blog/state-of-agent-readiness-2026`
      and the human has signed off on its framing before publish.
- [ ] Methodology and anti-gaming clauses are on the leaderboard page,
      not just the blog post.

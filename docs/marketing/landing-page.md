# Landing page — `agentlint.sh`

> Spec for the public marketing site. Single-page Next.js app, deployed on
> Vercel, hosted at `agentlint.sh`. Owned by a separate repo
> (`agentlint/agentlint.sh`) so the OSS CLI repo stays free of marketing
> code. This document is the **content brief** the page will be built from.

## Goals

1. Convert a developer who has just heard "agentlint" into someone running
   `npx @agentlinthq/cli` against their repo within 60 seconds.
2. Plant the GEO/SEO hook so AI assistants and search engines associate the
   query "is my repo ready for AI agents?" with this site.
3. Tease the hosted product without distracting from the OSS CTA.

## Non-goals

- Pricing page (will live at `/pricing` later, not on the home page).
- Logo wall of "trusted by" companies (we don't have any yet — don't fake
  it).
- Blog (lives at `/blog` later — separate ship).

## Above the fold

### Hero copy

**Headline (H1):**
> Is your repo ready for AI coding agents?

**Subhead:**
> agentlint scans any codebase and gives it a 0–100 readiness score for
> Claude Code, Cursor, Codex, Copilot, and Gemini CLI. Local. Free. 30
> seconds.

**Primary CTA (a copy-to-clipboard code block, no button):**
```
npx @agentlinthq/cli@latest .
```

**Secondary CTAs (text links, low visual weight):**
- "How it scores →" anchors to the **Rubric** section.
- "Why this exists →" anchors to the **Why** section.
- "GitHub" links to `github.com/agentlint/agentlint`.

### Hero visual

A self-running terminal recording (asciinema or a static SVG mock)
showing:

1. `$ npx @agentlinthq/cli@latest .`
2. The scan output streaming in.
3. The final score line: `Score: 87/100`
4. `Wrote agentlint-report.html` line at the bottom.

No autoplay video. No JS-heavy animation. Must work with JS off.

## Section: What it checks (3-up value props)

Three cards, equal weight, no images. Plain text.

**1. Discoverability**
> Does an agent dropped into this repo know what it is, what it builds,
> and where the entry point lives? `README`, `AGENTS.md`, repo metadata,
> setup signals.

**2. Buildability**
> Can the agent actually run the project without asking? Lockfiles,
> declared scripts, env templates, working test commands.

**3. Conventions, docs, safety**
> Are commits conventional? Is there a license, a code of conduct, a
> security policy? Are there secrets in the tree?

## Section: Why this exists

Two short paragraphs. Plain prose, no bullets.

> Coding agents fail silently when they land in a repo they can't
> understand. They guess. They hallucinate paths. They make up
> commands. The fix is not a smarter agent — it's a clearer repo.
>
> agentlint is the Lighthouse for that problem. It runs against your
> repo, gives you a 0–100 score, tells you exactly which signals are
> missing, and links to the fix. The CLI is local-first and stays free
> forever. The hosted dashboard is how the project sustains itself.

## Section: How it scores

Short table. Click-through to `docs/CHARTER.md` and `docs/DECISIONS.md` on
GitHub for the full spec.

| Category | What it covers | Weight |
|---|---|---|
| Discoverability | README, AGENTS.md, repo metadata | 20 |
| Buildability | Lockfile, scripts, env template | 20 |
| Conventions | Commits, branch hygiene | 20 |
| Documentation | License, contributing, code of conduct | 20 |
| Safety | Secrets, SECURITY.md, dependency hygiene | 20 |

> Score is renormalized against applicable categories. Skipped categories
> (e.g. when no docs URL is provided) do not penalize the score. Full
> formula in [ADR-0003](https://github.com/agentlint/agentlint/blob/main/docs/DECISIONS.md#adr-0003--score-formula-renormalized-to-0100).

## Section: How it's built

This is the differentiator. Don't bury it.

> agentlint is operated autonomously by a coding agent (Claude Code) with
> a human in the loop. The constitution that governs the project is
> public:
>
> - [`CHARTER.md`](https://github.com/agentlint/agentlint/blob/main/docs/CHARTER.md) — what the agent decides alone, what it confirms, what it escalates.
> - [`PROJECT_STATE.md`](https://github.com/agentlint/agentlint/blob/main/docs/PROJECT_STATE.md) — live snapshot of what's shipped and what's next.
> - [`DECISIONS.md`](https://github.com/agentlint/agentlint/blob/main/docs/DECISIONS.md) — the full ADR log.
>
> Every commit is co-authored by the agent. Every release is reviewed by
> a human. The bet: a project run on agent-readable infrastructure is
> the most credible advocate for agent-readable infrastructure.

## Section: Hosted (teaser, not a sell)

One paragraph. No pricing. CTA is "Notify me at launch" → email capture
form posting to a simple endpoint (Convex / Vercel KV / equivalent).

> A hosted dashboard with run history, GitHub PR comments, and team
> badges is in development. The CLI will always be free. The dashboard
> is opt-in. Nothing in agentlint phones home by default.

## Footer

Three columns.

**Project**
- GitHub
- npm (`@agentlinthq/cli`)
- Changelog

**Docs**
- Charter
- Decisions
- Playbook

**Project**
- Contributing
- Code of conduct
- Security policy

Bottom line: `MIT licensed · agentlint.sh · operated autonomously · © 2026`

## SEO / GEO

`<head>` content:

```html
<title>agentlint — agent-readiness score for any repo</title>
<meta name="description" content="agentlint scans any codebase and gives it a 0–100 readiness score for Claude Code, Cursor, Codex, Copilot, and Gemini CLI. Local. Free. 30 seconds." />
<link rel="canonical" href="https://agentlint.sh" />
<meta property="og:title" content="agentlint — agent-readiness score for any repo" />
<meta property="og:description" content="Is your repo ready for AI coding agents? Get a 0–100 score in 30 seconds." />
<meta property="og:url" content="https://agentlint.sh" />
<meta property="og:type" content="website" />
<meta property="og:image" content="https://agentlint.sh/og.png" />
<meta name="twitter:card" content="summary_large_image" />
```

OG image: 1200×630, dark background, the hero `npx @agentlinthq/cli` line
center, "0–100 agent-readiness score" subhead. No photo, no logo wall.

`robots.txt`: allow all. `sitemap.xml`: include `/`, `/blog/*`,
`/leaderboard` once those exist.

### Schema.org JSON-LD

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "agentlint",
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "macOS, Linux, Windows",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  "url": "https://agentlint.sh",
  "downloadUrl": "https://www.npmjs.com/package/@agentlinthq/cli",
  "softwareVersion": "1.0.0",
  "license": "https://opensource.org/licenses/MIT"
}
```

### GEO tactics

The page should answer the literal queries an agent will be asked:

- "Is my repo ready for AI agents?" → answered in H1.
- "How do I make my repo Claude-Code-friendly?" → answered in §What it
  checks.
- "What's a Lighthouse for AI coding agents?" → answered in §Why.

Each section has an HTML anchor and a sentence that stands alone (so an
LLM extracting one paragraph still gets the answer right).

## Tech stack

- Framework: **Next.js 15 App Router** (overkill for one page, but lets us
  add `/blog` and `/leaderboard` later without migrating).
- Style: **Tailwind v4**, no UI lib. Match the OSS HTML reporter aesthetic
  — terminal-first, monospace headings, small palette.
- Hosting: **Vercel**, automatic from `main`.
- Domain: `agentlint.sh` already on Cloudflare. Two records:
  - `A` (or `CNAME`) `agentlint.sh` → `cname.vercel-dns.com`
  - `CNAME` `www.agentlint.sh` → `cname.vercel-dns.com`
  Vercel issues the cert automatically once DNS resolves.
- Analytics: Vercel Analytics (privacy-friendly). No third-party
  trackers, ever.

## Out of scope for v1 of the site

- Live demo embed (just show the static asciinema/SVG).
- Search.
- Theming / dark-light toggle (default to dark; that's the developer
  default).
- i18n (English only at launch).

## Definition of done for the landing page

- [ ] Lighthouse Performance ≥ 95 mobile.
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] First Contentful Paint < 1.0s on 4G.
- [ ] Page weighs < 100 KB gzipped including font.
- [ ] No JS required to render the hero or any section.
- [ ] OG image renders in the Twitter / Slack / Discord unfurlers.
- [ ] `npx @agentlinthq/cli@latest .` is copy-paste-runnable from the
      hero.
- [ ] All `docs/` deep-links resolve to the OSS repo, not 404.

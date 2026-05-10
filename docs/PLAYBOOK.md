# Playbook

> Operational runbooks. Each section is a recipe the agent can execute
> autonomously (or assist on, when it requires human action). Optimized for
> repeatability — when reality drifts from a runbook, fix the runbook.
>
> See [`CHARTER.md`](./CHARTER.md) for what requires confirmation vs. what is
> autonomous.

## Table of contents

1. [Closing a session](#closing-a-session)
2. [Adding a new rule to the rubric](#adding-a-new-rule-to-the-rubric)
3. [Cutting a release and publishing to npm](#publishing-to-npm)
4. [Publishing a blog post or changelog entry](#publishing-a-blog-post-or-changelog-entry)
5. [Marketing a release (Twitter / HN / Reddit / Product Hunt)](#marketing-a-release)
6. [Triaging GitHub issues](#triaging-github-issues)
7. [Responding to community support](#responding-to-community-support)
8. [Handling a security disclosure](#handling-a-security-disclosure)
9. [Bumping a major version](#bumping-a-major-version)
10. [Creating a new package in the monorepo](#creating-a-new-package-in-the-monorepo)

---

## Closing a session

Every session ends with this. Non-negotiable.

```bash
pnpm run ci          # must pass
pnpm run agentlint . # must report 100/100
```

If either fails, do not push. Diagnose, fix, then close.

Then:

1. Update `docs/PROJECT_STATE.md`: snapshot, done, in flight, pending.
2. Append to `docs/DECISIONS.md` if any non-obvious decisions were made.
3. Commit any doc updates: `docs: update PROJECT_STATE` (and a separate
   commit for `DECISIONS` if applicable).
4. `git push origin main`.
5. Send the human a 3-bullet summary: **shipped / pending / next**.

## Adding a new rule to the rubric

A "rule" is one of the ~30 checks that produce the agent-readiness score.
Each rule lives in `packages/cli/src/rules/<category>.ts`.

### Step-by-step

1. Decide which category the rule belongs to: `discoverability`,
   `buildability`, `conventions`, `documentation`, or `safety`.
2. Open `packages/cli/src/rules/<category>.ts`. Copy the shape of an
   existing rule (look at `discoverability.ts` for the canonical pattern).
3. Pick a stable `id`: kebab-case, prefixed by category, e.g.
   `discoverability/has-readme`. Once shipped, `id` is part of the public
   API and cannot change.
4. Write the rule:
   - Implement `check(ctx: ScanContext): Promise<Result>`. Use
     `ctx.read`, `ctx.exists`, `ctx.glob`, `ctx.meta`. Never use raw `fs`.
   - Catch all errors inside `check` and return a `fail` result. Rules
     never throw.
   - Use `pass`, `fail`, `warn`, `skip` helpers from `_helpers.ts`.
   - Set `weight` thoughtfully: rules in the same category share the
     category cap. Adding a rule with `weight: N` to a category effectively
     raises that category's max by `N` and renormalizes everyone's score
     down. This is a soft breaking change. Discuss with the human in
     `DECISIONS.md` before shipping.
5. Add the rule to the category's `*Rules` array at the bottom of the
   file.
6. Add tests in `packages/cli/src/rules/rules.test.ts` covering at least
   `pass`, `fail`, and `skip` scenarios.
7. Run the full pipeline:
   ```bash
   pnpm run build
   pnpm run agentlint .
   ```
8. Confirm the new rule appears in the report and that this repo still
   scores 100/100. If the new rule fails on this repo, either fix this
   repo to satisfy the rule (preferred — eat your own dog food) or
   reconsider whether the rule belongs.
9. Document the rule in the category's section of `README.md` if user-
   facing. Otherwise, the rule's `description` and `remediation` fields
   are the docs.
10. Commit: `feat(rules): add <category>/<rule-id>`.

### When a new rule changes the public scoring API

If the rule's weight raises the category cap, this is a "soft breaking"
change because pre-existing 100/100 reports may now drop a few points. In
that case:

- Bump the **minor** version, not patch.
- Add a "Scoring change" note to the changelog.
- Mention the rule by id in the release notes.
- Do **not** alter weights of existing rules to compensate. The score
  formula is intentionally additive.

## Publishing to npm

agentlint is published from this monorepo as two packages:

- `@agentlint/core` (public)
- `@agentlint/cli` (public, the CLI; binary is still named `agentlint`)

`pnpm publish` rewrites `workspace:*` to resolved versions automatically,
so consumers of `@agentlint/cli` get a normal published `@agentlint/core`
dependency.

> **Why scoped names.** The unscoped `agentlint` was already taken on npm by
> an unrelated package when we went to publish; see ADR-0011. The brand,
> the bin, the docs site, and the GitHub org all stay `agentlint`.

### Pre-flight

```bash
pnpm install
pnpm run ci             # all green
pnpm run agentlint .    # 100/100
git status              # clean tree
git pull --ff-only
```

### Cut the release

The agent prepares; the human runs `npm login` and pastes the 2FA OTP
when prompted.

1. Decide the version bump. Conventional commits since the last tag:
   - `feat:` → minor
   - `fix:` / `perf:` / `refactor:` → patch
   - `feat!:` or `BREAKING CHANGE:` → major (requires confirmation per
     CHARTER §3.2)
2. Update versions in both packages **and** any internal `workspace:*`
   versions if they were pinned. The agent uses `pnpm -r exec npm version`
   to keep them in lockstep.
3. Update `CHANGELOG.md` (top of file). Format:
   ```
   ## [X.Y.Z] - YYYY-MM-DD
   ### Added / Changed / Fixed / Removed
   - one bullet per user-visible change, linking the PR if any
   ```
4. Commit: `chore(release): vX.Y.Z`.
5. Tag: `git tag -a vX.Y.Z -m "vX.Y.Z"`.
6. Push: `git push && git push --tags`.

### Publish

The human is at the keyboard for this step (npm 2FA OTP).

```bash
# Authenticate (first time per machine, or if the token expired)
pnpm exec npm login                   # human enters credentials + OTP

# Publish core first — cli depends on it
cd packages/core
pnpm publish --access public          # human pastes OTP if prompted

cd ../cli
pnpm publish --access public          # human pastes OTP if prompted

cd ../..
```

### Post-publish

1. Verify install:
   ```bash
   cd /tmp && mkdir agentlint-smoke && cd agentlint-smoke
   pnpm dlx @agentlint/cli@X.Y.Z --version
   ```
2. Create a GitHub Release for `vX.Y.Z` with the changelog section as the
   body. The agent uses `gh release create`.
3. Update `docs/PROJECT_STATE.md` snapshot with the new published version.
4. Drop the announcement into the marketing runbook if the release
   warrants public communication.

## Publishing a blog post or changelog entry

Blog posts live at `agentlint.dev/blog/<slug>` (separate repo,
`agentlint/agentlint.dev`, once it exists). Changelog entries live in
`CHANGELOG.md` in this repo.

### Drafting

1. Write the draft in `docs/drafts/<YYYY-MM-DD>-<slug>.md` first. Honest
   voice. Lead with what changed and why someone should care, not who
   built it.
2. If the post mentions agentlint's "agent-built" nature, link to
   `CHARTER.md` once and move on. Don't make every post about the agent.
3. Run the draft through:
   - Spell check (Biome doesn't lint markdown content, agent reads
     critically).
   - Link check: every external URL must resolve at time of writing.
4. Confirm with the human before merging the post into the public site
   repo (CHARTER §3.2: public communications).

### Publishing

1. Once approved, move the file from `docs/drafts/` to the site repo
   (`apps/web/content/blog/<slug>.md` or equivalent — TBD when the site
   exists).
2. Open a PR on the site repo. CI deploys preview to Vercel. Human
   reviews preview. Agent merges once approved.
3. Production deploys on merge.

## Marketing a release

For a release worth announcing publicly. Patch releases usually aren't.
Minor releases with new rules, the leaderboard, or a major rubric change
are.

### Drafts the agent prepares

The agent prepares all of the following in `docs/drafts/release-vX.Y.Z/`:

1. **Tweet / X thread.** 1 hook tweet, 3–5 follow-ups. Lead with the
   command (`npx @agentlint/cli`), show a screenshot or terminal recording of
   a fresh report.
2. **HN submission.** Title under 80 chars. URL: agentlint.dev or the
   relevant blog post. First comment as the OP, written in the project's
   voice — say agent-built once, link the charter, then talk about the
   technical interesting bits (rubric design, score formula, why JSON
   output for other agents to consume).
3. **Reddit posts.** r/programming for technical readers, r/MachineLearning
   only if there's a meaty technical post about how agents consume the
   output, r/javascript for the package itself. Each subreddit needs
   tailored framing — don't cross-post identical text.
4. **Product Hunt listing.** Tagline under 60 chars, description under
   260 chars, gallery: 3 screenshots of the report in different formats
   (terminal, HTML, JSON). Schedule for Tuesday or Wednesday at 12:01 AM
   PT.
5. **LinkedIn post** (long-form, optional). For releases with a B2B
   angle — the hosted dashboard, an integration with a known IDE.

### Approval and posting

CHARTER §3.2: the agent does not post these autonomously. The agent
presents drafts in chat, the human edits or signs off, the human posts
(or pastes the agent's text into the channel and posts).

After posting, the agent monitors:

- HN comments: prepare reply drafts within the first 2 hours, paste to
  human for approval.
- X replies: same.
- GitHub issues that show up because of the launch: triage per the
  triage runbook below.

## Triaging GitHub issues

Run `gh issue list --state open` or the Issues tab. For each new issue:

### Classify

| Class | Action |
|---|---|
| Bug, with repro | Label `bug`. Acknowledge within 24h. Reproduce locally. Fix or schedule. |
| Bug, without repro | Label `needs-repro`. Ask for: agentlint version, Node version, OS, exact command, full output. Close after 14 days of no response with `not-actionable`. |
| Feature request | Label `enhancement`. Cross-reference `PROJECT_STATE.md` pending. If aligned, link to it. If not, write a short rationale and label `wontfix` or `later`. |
| Rubric proposal | Label `rule-proposal`. Treat as a discussion. Apply the "adding a new rule" runbook if accepted. |
| Question / support | Label `question`. Answer if the answer is short and lives in the docs. Otherwise, redirect to the relevant doc and close. |
| Spam / off-topic | Close, lock, no comment. |
| Security report | **Stop.** Do not engage in public. Move to the security disclosure runbook below. |

### Acknowledgment template

```
Thanks for filing this — the project is operated autonomously by an agent
(see docs/CHARTER.md), so triage happens within 24h on weekdays. I'll
[reproduce locally / discuss with the maintainer / open a PR] and update
this issue.
```

The agent never says "I'm an AI" defensively, but does not pretend to be
human if asked directly. Honest.

## Responding to community support

Channels: GitHub Discussions, GitHub Issues with the `question` label,
Twitter/X mentions, eventual Discord.

### Tone

- Direct. No "Sure! Happy to help." pleasantries.
- Respect the asker's level: if they're new, link the relevant doc; if
  they're advanced, jump to the technical answer.
- If the answer is "this is a docs gap," fix the docs in the same session
  and link the PR in the reply.
- If the answer is "this is a feature we should add," open an issue,
  label `enhancement`, link it back to the asker.

### Things the agent does NOT do

- Promise timelines beyond what `PROJECT_STATE.md` already commits to.
- Speak for the human's personal opinions or roadmap.
- Engage in flame wars. If a thread turns hostile, ask the human to take
  it over or walk away.

## Handling a security disclosure

If anyone reports a vulnerability — via email, an issue, a DM, anywhere
— **do not engage in public**.

1. **Stop.** Do not comment publicly. Do not confirm or deny on a public
   issue.
2. Move the conversation to private email (security@agentlint.dev once
   provisioned, or directly to the human's email until then).
3. Acknowledge receipt within 24h.
4. The agent prepares an analysis: severity (CVSS-ish), affected
   versions, reproduction, fix candidate, disclosure timeline (default
   90 days, faster if exploited).
5. The human approves the disclosure plan and any CVE filing.
6. Fix in a private branch, release a patch, then publish a security
   advisory via `gh advisory create`.
7. Credit the reporter in the advisory if they consent.

The agent does not unilaterally publish security info per CHARTER §3.3.

## Bumping a major version

A major version bump is a public commitment to a breaking change. CHARTER
§3.2 requires human sign-off.

### When required

- Removing a CLI flag or changing its semantics.
- Changing the JSON or Markdown report shape.
- Changing exit codes for the same outcome.
- Removing a rule (the rule's id disappearing from reports breaks
  consumers tracking specific ids).
- Changing the score formula or `CATEGORY_MAX`.
- Bumping the minimum Node version above the current support floor.

### Process

1. Open a tracking issue: `RFC: agentlint vN.0`. Lay out every breaking
   change. Get human sign-off in the issue.
2. Implement on a `vN` branch. CI must stay green.
3. Write a migration guide in `docs/migrations/vN.md`: every break, every
   replacement.
4. Publish a release candidate first: `pnpm publish --tag next`.
5. Solicit feedback for at least one week.
6. Merge to `main`, tag `vN.0.0`, publish per the release runbook,
   announce per the marketing runbook.

## Creating a new package in the monorepo

Sometimes the project needs a new package (e.g., `@agentlint/dashboard`,
`@agentlint/badge-svg`).

1. `mkdir packages/<name> && cd packages/<name>`.
2. Create `package.json` with `name: "@agentlint/<name>"`,
   `version: "0.0.0"`, `private: true` initially (flip to public when
   ready to publish).
3. Add a `tsconfig.json` extending `../../tsconfig.base.json`.
4. Add `src/index.ts` and a `src/index.test.ts` with at least one test.
5. Add `build`, `test`, `typecheck` scripts mirroring the other packages.
6. Run `pnpm install` from the repo root to wire it into the workspace.
7. Run `pnpm run ci`. Must pass before commit.
8. Commit: `chore: scaffold @agentlint/<name>`.

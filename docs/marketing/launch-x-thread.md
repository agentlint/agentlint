# X (Twitter) launch thread

> Tone: dry, dev-first, no emojis, no hype, no "🚀". Each tweet ≤ 280
> chars. Numbered for clarity (do not paste numbers).

## 1 / Hook

agentlint: a 0–100 agent-readiness score for any repo.

  npx @agentlinthq/cli@latest .

30 checks across 5 categories. Local. Free. 30 seconds.

If your repo isn't ready for Claude Code, Cursor, Codex, Copilot, or Gemini CLI, this tells you exactly what's missing — and exactly how to fix it.

## 2 / The premise

Coding agents fail silently when they land in a repo they don't understand.

They guess paths. Hallucinate scripts. Invent commands.

The fix isn't a smarter agent. It's a clearer repo.

agentlint is the Lighthouse for that.

## 3 / What it checks

5 categories, 30 rules:

— Discoverability (README, AGENTS.md, repo metadata)
— Buildability (lockfile, scripts, env template)
— Conventions (commits, branch hygiene)
— Documentation (license, contributing, code of conduct)
— Safety (secrets, SECURITY.md, deps)

## 4 / The output

One score. One number. 0–100.

A self-contained HTML report you can open offline. Terminal output. JSON for CI. Markdown for PRs.

Exit code 1 below 80 by default, so you can drop it in a GitHub Action and it gates merges out of the box.

## 5 / Local-first, by charter

No telemetry. No opt-out flag — because there's nothing to opt out of.

The HTML report has no external CSS, fonts, or scripts. Designed to work after you email it to a teammate or commit it as a PR artifact.

Network calls only with `--url`, behind safeFetch + timeout.

## 6 / The unusual part

agentlint is operated by an agent.

A coding agent (Claude Code) ships every line, with a human in the loop. The constitution is public:

— CHARTER.md
— PROJECT_STATE.md
— DECISIONS.md

Every commit is co-authored. Every release is human-approved.

## 7 / Score-of-100 invariant

The repo self-audits at 100/100 on its own rubric on every push to main.

If a change drops the score, CI fails. Fix in the same change or revert.

The bet: a project run on agent-readable infrastructure is the most credible advocate for agent-readable infrastructure.

## 8 / Hosted dashboard (optional)

CLI is MIT and free forever. The hosted dashboard pays the bills so the CLI never has to phone home:

— Run history per repo
— GitHub PR comments on every push
— Public score badge for your README
— $19/mo Pro · $99/mo Team

agentlint.sh/pricing

## 9 / Where to start

Source: github.com/agentlint/agentlint
Site: agentlint.sh

Run it on your repo right now:

  npx @agentlinthq/cli@latest .

If a rule is missing or weighted wrong, open an RFC. The rubric is the public API.

## Notes (do not post)

- Schedule for the same morning as the HN post (8–10 AM Pacific Tue/Wed).
- Pin tweet 1 for 7 days.
- Reply with a screenshot of the terminal output 5 minutes after the thread lands.
- Quote-tweet 1 framework maintainer per day for the first 5 days, asking what the score looks like on their repo. Don't be obsequious — ask the question, post the score, link the report. They will engage or they won't.
- Do not buy followers. Do not pay for amplification. The leaderboard is the amplifier.

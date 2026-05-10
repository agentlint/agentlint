# Product Hunt launch listing

> PH allows: a tagline (≤ 60 chars), a description (≤ 260 chars), and a
> first-comment with the longer pitch. Schedule the launch for a Tuesday
> 12:01 AM Pacific (PH day starts at midnight Pacific).

## Tagline (≤ 60 chars)

`Lighthouse for AI coding agents — a 0-100 readiness score.`

## Description (≤ 260 chars)

`agentlint scans any repo and gives it a 0-100 readiness score for Claude Code, Cursor, Codex, Copilot, and Gemini CLI. 30 checks. Local. Free. 30 seconds. The CLI is MIT; the hosted dashboard pays the bills so the CLI never has to phone home.`

## Topics

`Developer Tools`, `Open Source`, `Artificial Intelligence`, `GitHub`, `Productivity`

## Maker comment (first comment in the thread)

Hi everyone, maker here.

agentlint comes from a frustration. Coding agents are getting really good — Claude Code, Cursor, Codex, Copilot, Gemini CLI all work shockingly well *when* the repo gives them what they need. And really badly when it doesn't. They hallucinate paths, guess at scripts, and invent commands that don't exist.

The fix isn't a smarter agent. It's a clearer repo.

agentlint is a single CLI that scans your repository and gives it a 0-100 score across five categories: discoverability, buildability, conventions, documentation, and safety. Thirty rules. The output is a self-contained HTML report (works offline), plus JSON / Markdown / terminal so you can drop it into CI. Default exit code is 1 below 80, so it works as a merge gate the moment you install it.

Try it now (no install needed):

  `npx @agentlinthq/cli@latest .`

A few things people on PH might find interesting:

- **Local-first by charter.** No telemetry. No opt-out flag because there's nothing to opt out of. The CLI never phones home by default.
- **The CLI stays free forever.** MIT-licensed. The hosted dashboard pays the bills — run history, GitHub PR comments, public score badge. Pro $19/mo, Team $99/mo. We deliberately did not put a free tier on the dashboard, because the CLI *is* the free tier.
- **The project itself is operated by an AI agent.** A coding agent (Claude Code) ships every line, with a human in the loop. The constitution is public — see `docs/CHARTER.md` for what the agent decides alone, what it confirms, and what it escalates. Every commit is co-authored.
- **The repo self-audits at 100/100 on its own rubric.** Every push to main runs the same rubric you'd run on your repo. If the score drops, CI fails. We eat our own dog food at the byte level.

We also built a leaderboard — coming this week — that scores the top 1,000 most-starred public GitHub repos on the same rubric. No curation, no weighting, no bias toward repos we like. The score is what the score is.

Things we'd love feedback on:

- Is the rubric right? The public list is in `packages/cli/src/rules/`. Open an RFC issue if a check is missing or weighted wrong. The rules are the public API.
- Would you actually use this as a CI gate, or is the score for humans? Tell us how you ran it.
- The "AI agent runs the project" framing — does it land, or does it feel like a gimmick? We genuinely don't know yet.

Source: https://github.com/agentlint/agentlint
Site: https://agentlint.sh
npm: https://www.npmjs.com/package/@agentlinthq/cli

Thanks to anyone who tries it. We'll be in the comments all day.

## Notes (do not paste)

- PH bans link-bait images and animated GIFs in the gallery. Use real screenshots from the HTML report and the terminal.
- Submit 5 gallery images: hero shot of the report, terminal output with score, the score table, the "score < 80 means CI fail" panel, and the leaderboard preview.
- Tag the post with `developer-tools`, `open-source`, `artificial-intelligence`, `github`, `productivity`.
- Hunters: do NOT ask a hunter to "boost" the launch. PH algorithm penalizes inorganic activity. Self-launch is fine.
- Reply to every comment within 30 minutes for the first 6 hours.
- Do not crosspost to PH on the same day as the HN post. Stagger by 1 day so you can give each crowd full attention.

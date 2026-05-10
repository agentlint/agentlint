# Hacker News — Show HN draft

> **Title (max 80 chars, no clickbait):**
>
> `Show HN: agentlint – Lighthouse-style readiness score for AI coding agents`

## Body (no formatting allowed; HN strips it)

agentlint scans any repository and gives it a 0–100 readiness score for AI coding agents (Claude Code, Cursor, Codex, Copilot, Gemini CLI). It is a single CLI you run locally:

  npx @agentlinthq/cli@latest .

Thirty checks across five categories (discoverability, buildability, conventions, documentation, safety). It writes a self-contained HTML report you can open offline, plus terminal/JSON/Markdown outputs for CI. The default exit code is 1 below 80, which makes it usable as a CI gate.

The premise: coding agents fail silently when they land in a repo they cannot understand. They guess paths, hallucinate scripts, and invent commands. The fix is not a smarter agent — it is a clearer repo. agentlint tells you which signals are missing.

A few things that may interest this crowd:

- The CLI is local-first by design. No telemetry, no opt-out flag because there is nothing to opt out of. Network calls only happen if you pass a docs URL with `--url`, and those go through a `safeFetch` with `AbortSignal.timeout`.
- The HTML report is fully self-contained: no external CSS, no fonts, no scripts. Designed to work after you email it to a teammate or commit it as a PR artifact.
- The score formula is renormalized so skipped categories do not penalize you. Documented as ADR-0003.
- The repo itself scores 100/100 on its own rubric. Self-audit gates every push to main; if it drops below 100, the build fails.

The unusual part: the project is operated by a coding agent (Claude Code) with a human in the loop. Every commit is co-authored. The constitution that governs the agent is public — see CHARTER.md, PROJECT_STATE.md, DECISIONS.md in the repo. The bet: a project run on agent-readable infrastructure is the most credible advocate for agent-readable infrastructure.

There is a hosted dashboard on the way (run history, GitHub PR comments, public score badge). The CLI stays free forever. Pricing is at https://agentlint.sh/pricing.

Source: https://github.com/agentlint/agentlint
npm: https://www.npmjs.com/package/@agentlinthq/cli
Site: https://agentlint.sh

Curious whether the rubric matches what you actually want from a repo when you drop an agent into it. The list of rules is in `packages/cli/src/rules/`. Open an RFC issue if a check is missing or weighted wrong.

## Notes for the poster (do not paste into HN)

- Post Tuesday or Wednesday at 8–10 AM Pacific (HN traffic peaks).
- Do not edit the title after posting; it cannot be changed without losing position.
- Do not ask for upvotes. Do not announce on X first asking for HN votes — HN flagging is fast.
- Be online for the first 4 hours to answer comments. Treat every reply as a potential rules issue or RFC.
- If a thread asks about pricing, the canonical answer is: CLI is MIT and free forever; hosted is $19/mo Pro, $99/mo Team; tax/business decisions are human-side, not agent-side.
- If the "AI agent runs the repo" angle gets attacked, do not be defensive. Link CHARTER.md and DECISIONS.md and let them speak.
- Top-of-thread comment from the maintainer with the elevator pitch + link to the leaderboard the moment it goes live.

## Likely objections + canned answers

- "Yet another linter." → It's a Lighthouse, not a linter. The output is a score, not a wall of warnings; the audience is agents, not the linter team.
- "Why a score, not a checklist?" → Because the absence of a single signal rarely matters; the *combined density* of signals is what changes agent behavior. ADR-0003 explains the renormalization.
- "Why is the org name agentlinthq on npm?" → Because `agentlint` (unscoped) and the org name `agentlint` were both held when we went to publish. ADR-0011.
- "How is this different from CodeRabbit / Copilot Workspace / etc?" → Those review code. agentlint reviews repos. Different unit of work; complementary tools.
- "Is the agent really writing the code?" → Yes, with a human in the loop. The commit log is public. The CHARTER lists exactly what the agent decides alone, what it confirms, and what it escalates.

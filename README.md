# agentlint

> The Lighthouse for AI coding agents. Audit any repo for how ready it is for Claude Code, Cursor, Codex, Copilot, and Gemini CLI. Get a 0–100 score and a fix list in 30 seconds.

## Quick start

```bash
npx @agentlinthq/cli
```

That's it. No install, no signup. Drop the command into any repo and you'll get a colored report in your terminal plus a full HTML report on disk.

```bash
# Scan the current directory
npx @agentlinthq/cli

# Scan a different path
npx @agentlinthq/cli ./packages/api

# Machine-readable output for CI or for AI agents to parse
npx @agentlinthq/cli --json > report.json

# Markdown report for AI agents to consume directly
npx @agentlinthq/cli --markdown

# Also audit the docs site
npx @agentlinthq/cli --url https://docs.example.com
```

Or install once and use the short command:

```bash
npm i -g @agentlinthq/cli
agentlint
```

End-users invoke it via `npx`/`pnpm dlx`/`bunx` regardless of what package manager their project uses — the published `@agentlinthq/cli` package is universal.

> **Note on the name.** The unscoped `agentlint` name on npm is held by an unrelated package, and the matching org name was not available either, so the npm org is `agentlinthq`. The CLI is published as `@agentlinthq/cli`; the binary it installs is still `agentlint`. See [ADR-0011](./docs/DECISIONS.md#adr-0011--publish-under-agentlinthq-org-scope-the-unscoped-agentlint-and-the-org-name-agentlint-are-both-taken).

## Why this exists

Every AI coding tool now reads project context from a config file:

| Tool | File it reads |
|---|---|
| Claude Code | `CLAUDE.md` (or `AGENTS.md`) |
| OpenAI Codex CLI | `AGENTS.md` |
| Cursor | `.cursor/rules/` |
| GitHub Copilot | `.github/copilot-instructions.md` |
| Gemini CLI | `GEMINI.md` (or `AGENTS.md`) |

If you don't have any of these, the agent guesses. It guesses badly. The fix is simple: write the right files. agentlint tells you which ones are missing and what's in them.

## What it checks

Five categories, 30 checks, 0–100 score. See [AGENTS.md](./AGENTS.md) for project conventions.

For agent integration: `agentlint --json` and `agentlint --markdown` produce structured reports. Tell Claude Code or Cursor "run agentlint and fix what's failing" and it'll do the work.

## Optional: push reports to a dashboard (`--push`)

Off by default — the CLI is local-first and never phones home unless you opt in.

If you want a history of runs at <https://agentlint.sh/dashboard>:

```bash
# Generate a token at https://agentlint.sh/dashboard/tokens
export AGENTLINT_TOKEN=agl_...

agentlint --push
# → Pushed: https://agentlint.sh/dashboard
```

The token is read from `AGENTLINT_TOKEN` first, then from `~/.config/agentlint/token` (one line, `chmod 600` recommended). The token is never read from `argv`. Push failures (auth, rate limit, network) print one line and exit 0 — the local audit still succeeds. The CLI refuses to send to non-HTTPS URLs (except `localhost` / `127.0.0.1`).

See [`packages/cli/README.md`](./packages/cli/README.md) for the full security model.

## How this project is built

agentlint is **agent-built, open to everyone.**

The first version of this codebase — the rubric of 30 checks, the score
formula, the architecture, the docs, the launch plan — was designed and
written by Claude (Anthropic's chat web product) in collaboration with a
human product owner. Ongoing maintenance is operated autonomously by Claude
Code with a human in the loop for things an agent cannot do: domain
purchases, npm 2FA, signing off on public communications, and decisions
with legal or financial weight.

This is not a stunt. It's the project's working hypothesis: an AI agent
can ship and operate a real piece of developer tooling end-to-end, with
real users, real CI, and a public quality bar. agentlint is the test of
that hypothesis. It scores 100/100 on its own rubric, ships clean
releases, and runs its own CI — the same things it checks in everyone
else's repo.

The full operating model is public:

- **[`docs/CHARTER.md`](./docs/CHARTER.md)** — the constitution. What the
  agent decides alone, what it confirms, what it escalates.
- **[`docs/PROJECT_STATE.md`](./docs/PROJECT_STATE.md)** — what's done,
  what's next, updated at the close of every session.
- **[`docs/PLAYBOOK.md`](./docs/PLAYBOOK.md)** — operational runbooks.
- **[`docs/DECISIONS.md`](./docs/DECISIONS.md)** — append-only log of
  architectural and product decisions with rationale.

This project is open under MIT to human and agent contributors equally.
Open a PR, file an issue, propose a rule — there is no enforcement on
who or what wrote the code, only on whether the code passes the bar.
The agent reviews and merges contributions like any maintainer.

## Development

This repo uses **pnpm** workspaces. Install pnpm first: `npm i -g pnpm` or `corepack enable`.

```bash
pnpm install
pnpm run ci          # build + typecheck + lint + test + self-audit
pnpm run agentlint . # run agentlint on this repo (eat our own dog food)
```

Commits in this repo are co-authored by Claude via a
`prepare-commit-msg` hook. See
[`CHARTER.md` § 6](./docs/CHARTER.md#6-co-authorship-convention) for the
rationale.

## License

MIT.

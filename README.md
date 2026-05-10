# agentlint

> The Lighthouse for AI coding agents. Audit any repo for how ready it is for Claude Code, Cursor, Codex, Copilot, and Gemini CLI. Get a 0–100 score and a fix list in 30 seconds.

## Quick start

```bash
npx agentlint
```

That's it. No install, no signup. Drop the command into any repo and you'll get a colored report in your terminal plus a full HTML report on disk.

```bash
# Scan the current directory
npx agentlint

# Scan a different path
npx agentlint ./packages/api

# Machine-readable output for CI or for AI agents to parse
npx agentlint --json > report.json

# Markdown report for AI agents to consume directly
npx agentlint --markdown

# Also audit the docs site
npx agentlint --url https://docs.example.com
```

End-users invoke it via `npx`/`pnpm dlx`/`bunx` regardless of what package manager their project uses — the published `agentlint` package is universal.

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

## Development

This repo uses **pnpm** workspaces. Install pnpm first: `npm i -g pnpm` or `corepack enable`.

```bash
pnpm install
pnpm run ci          # build + typecheck + lint + test + self-audit
pnpm run agentlint . # run agentlint on this repo (eat our own dog food)
```

## License

MIT.

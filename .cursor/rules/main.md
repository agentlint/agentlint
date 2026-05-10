# Cursor rules — agentlint

Project instructions are in [AGENTS.md](../../AGENTS.md). Read that for build commands, conventions, architecture, and gotchas before making changes.

Key rules:
- TypeScript strict mode, no `any` without comment
- Tests required for new rules
- pnpm only (not npm) — `workspace:*` deps don't resolve under npm
- Run `pnpm run agentlint .` after any change — the score must stay at 100

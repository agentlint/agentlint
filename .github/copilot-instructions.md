# Copilot instructions — agentlint

See [AGENTS.md](../AGENTS.md) for project conventions.

Quick reminders:
- TypeScript strict; no `any` without a comment.
- Tests live next to the file under test (`*.test.ts`).
- Use pnpm, not npm (`workspace:*` deps).
- Run `pnpm run ci` and confirm score is 100 before finishing.

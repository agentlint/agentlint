# AGENTS.md — @agentlinthq/core

This package is **pure** — no IO, no fetch, no fs. Just types and pure functions.

## Build, test

```bash
pnpm --filter @agentlinthq/core build
pnpm --filter @agentlinthq/core test
```

## Conventions

- Every type or function exported from `index.ts` is part of the public API. Treat additions as additive, removals as breaking.
- Score weights live in `src/score.ts` as `CATEGORY_MAX`. Changing them changes everyone's score — do not modify without explicit approval.
- No imports from `node:*` modules. This package must be safe to bundle into any environment.

## Off-limits

- `CATEGORY_MAX` in `src/score.ts` — score-affecting public API.

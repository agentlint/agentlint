# `@agentlinthq/leaderboard`

Internal tool. Not published. Generates the agentlint leaderboard
(top-N most-starred public GitHub repos, scored against the same
rubric as the published CLI).

Spec: [`docs/marketing/leaderboard.md`](../../docs/marketing/leaderboard.md).

## Status

Skeleton. v1 of this session implements only `fetch-repos` — pulling
the top-N candidates from the GitHub Search API. The full pipeline
(`clone-and-scan`, `aggregate`, `render-page`, `render-blog`) is
deferred to subsequent sessions per the spec.

## Run

```bash
GITHUB_TOKEN=ghp_xxx pnpm --filter @agentlinthq/leaderboard run test
```

## Notes

- `tools/*` workspaces are typecheck- and test-covered by the root
  `pnpm run ci` pipeline. Biome lint coverage is currently scoped to
  `packages/*` only; that may change in a follow-up. Keep code in
  this directory hand-formatted to the repo's existing style
  (`indentStyle: space`, `indentWidth: 2`, double quotes,
  semicolons).

# PRD — Programmatic `runScan` export on `@agentlinthq/cli`

**Status:** approved by the autonomous pipeline (2026-05-11).
**Repo split:** CLI only (`agentlint`). Web consumer-side commit follows.
**Slug:** `cli-runscan-export`.

## Problem

The web app's scan-worker currently reaches into `@agentlinthq/cli` via
deep imports — pulling `rules/index.js`, `scan-context.js`, and re-doing
the rule-runner loop on its own. That couples the worker to internal
file layout: any rename in `packages/cli/src/` breaks the worker even
though the public CLI behavior is unchanged. There is no stable
programmatic entry today.

## Non-goals

- **Score formula change.** Untouched. Public scoring API stays sacred.
- **Web-side migration in this slice.** The web repo update is a
  consumer-side follow-up commit handled by the `failed-scans-log` tier.
- **Version bump.** Handled by the `cli-release-2-2-0` tier.
- **Streaming / incremental results API.** Single `Promise<Report>`.
- **New CLI surface.** No new flag, no new subcommand.

## Success metric

A consumer (the web scan-worker) can write exactly:

```ts
import { runScan, type Report } from "@agentlinthq/cli";
const report = await runScan({ cwd: "/tmp/repo-checkout" });
console.log(report.score); // 0..100
```

…and:

1. `tsc --noEmit` resolves the import against published `.d.ts` files.
2. The returned `Report` is identical to what the CLI computes for the
   same `cwd` (same `score`, same `results.length`, same `byCategory`).
3. The CLI binary (`agentlint`) keeps working unchanged.

## Schema diff

No schema change.

## API surface

No HTTP route change.

New programmatic surface on `@agentlinthq/cli`:

```ts
export interface ScanOptions {
  /** absolute path to the repo to scan. */
  cwd: string;
  /** optional docs-site URL — plumbed through to documentation rules. */
  url?: string;
}

export declare function runScan(opts: ScanOptions): Promise<Report>;
export type { Report } from "@agentlinthq/core";
export declare const VERSION: string;
```

Package `exports` map gains `.`:

```json
{
  "main": "./dist/api.js",
  "types": "./dist/api.d.ts",
  "exports": {
    ".": {
      "types": "./dist/api.d.ts",
      "import": "./dist/api.js"
    }
  },
  "bin": { "agentlint": "./dist/index.js" }
}
```

## CLI surface

No new flag. `packages/cli/src/index.ts` is refactored so its scan loop
delegates to `runScan` — exactly one implementation lives in the repo.

## UI surface

No UI change.

## Security

`runScan` is local-first. No network call in its hot path. The optional
`url` field is passed to documentation rules, which already use
`safeFetch` with a bounded timeout. The exported function never reads
env vars, never reads tokens, never writes files.

## Rollback

Revert is one commit. Consumers using the deep imports are unaffected
because we are adding a new entry, not removing the existing layout.

## Open questions

- **RESOLVED:** Re-export `Report` from `@agentlinthq/core` directly
  rather than expose a narrower shape. Consumers can drill deeper if
  they want and the type stays in lock-step with score-calc.
- **RESOLVED:** `ScanOptions` lives in `packages/cli/src/api.ts`, not
  in `packages/core/src/types.ts`. The `url` plumbing is CLI-side
  concern; `core` stays IO-free and option-free.
- **RESOLVED:** `VERSION` becomes a named export on the API module
  (and re-exported into `index.ts` for the `--version` flag) so
  consumers can log which CLI version ran a scan.

## Issues

1. `feat(cli): programmatic runScan export on @agentlinthq/cli` —
   single PR. Adds `packages/cli/src/api.ts`, refactors `index.ts` to
   consume it, updates the `exports` map, adds `api.test.ts`, updates
   `AGENTS.md`. DoD: `pnpm run ci` green, score 100/100, ≥5 new tests
   pass.

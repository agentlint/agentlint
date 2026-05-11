# Brief — cli-runscan-export

## One-line goal

Promote `runScan` to a stable programmatic export on `@agentlinthq/cli` so the
web scan-worker can `import { runScan } from "@agentlinthq/cli"` instead of
deep-importing internal modules.

## Repo

`agentlint/agentlint` (CLI repo) — this repo, `~/Code/agentlint`.

## Definition of done

A reviewer can verify all five:

1. `import { runScan } from "@agentlinthq/cli"` resolves and is typed.
2. `runScan({ cwd, url? })` returns `Promise<Report>` from `@agentlinthq/core`.
3. Existing CLI entrypoint `packages/cli/src/index.ts` re-uses the new
   exported function — no duplication.
4. The web repo's `lib/server-scan/runner.ts` is updated in the same loop
   tier (or follow-up commit) to drop the deep imports.
5. `pnpm run ci` green; `pnpm run agentlint .` reports 100/100; 5+ new
   tests covering programmatic-mode invocation (empty repo, repo with
   failures, `url` plumbed through to documentation rules).

## In scope

- New file `packages/cli/src/api.ts` exporting `runScan` + the option/result types.
- `packages/cli/src/index.ts` refactored to call into `runScan` for its scan
  path so there is exactly one implementation.
- `packages/cli/package.json` `exports` map adds the `.` entry pointing at
  the new ESM API.
- Programmatic API tests in `packages/cli/src/api.test.ts`.
- `AGENTS.md` "Architecture" section gains a one-line bullet about the
  programmatic export.

## Out of scope

- Any change to scoring weights, `CATEGORY_MAX`, or rule shape.
- Updating the web repo's `lib/server-scan/runner.ts` — that's a follow-up
  consumer-side commit and the failing-scans-log slice will pick it up.
- A version bump — that happens in tier 6 (`cli-release-2-2-0`).

## Charter check

- Local-first invariant intact (programmatic API still runs offline).
- Score-of-100 invariant intact.
- Public scoring API untouched.
- Rules-never-throw contract unchanged.

## Open decisions you may resolve

- Type-export style: re-export `Report` from `@agentlinthq/core` vs. expose a
  narrower shape? **RESOLVED:** re-export from core; consumers can drill
  deeper if they want.
- Where the `ScanOptions` type lives. **RESOLVED:** `packages/cli/src/api.ts`,
  not `packages/core/src/types.ts`, because options are CLI-side concerns
  (URL flag, etc.).

## Notes for the agent

- Start by writing `packages/cli/src/api.test.ts` (RED), then the export,
  then refactor `index.ts` last.
- Keep the `index.ts` argv parsing intact — only the scan-loop body moves.

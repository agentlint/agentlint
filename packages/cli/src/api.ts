// Programmatic API for @agentlinthq/cli.
//
// Consumers (today: the agentlint.sh scan-worker) import `runScan` here
// instead of deep-importing internal modules. The CLI binary delegates to
// the same function so there is exactly one scan implementation.
//
// This module is local-first: no network call in its hot path (the only
// network use is via documentation rules when `url` is provided, which
// is the same behavior as the CLI's `--url` flag).
import { resolve } from "node:path";
import {
  buildReport,
  type Report,
  registerRuleCategory,
} from "@agentlinthq/core";
import { attachPrompts } from "./prompts/compose.js";
import { allRules } from "./rules/index.js";
import { createScanContext } from "./scan-context.js";

/** CLI version. Kept in sync with packages/cli/package.json. */
export const VERSION = "2.2.0";

export interface ScanOptions {
  /** Path to the repo to scan. Resolved against process.cwd(). */
  cwd: string;
  /** Optional docs-site URL — plumbed through to documentation rules. */
  url?: string;
}

export type { Report } from "@agentlinthq/core";

/**
 * Run a full agentlint scan against `cwd` and return the report.
 *
 * Same behavior as the CLI's default scan path: every rule runs once
 * against a shared, cached `ScanContext`. Rule crashes are caught and
 * surfaced as `fail` results — `runScan` itself does not throw on rule
 * errors (rules-never-throw contract).
 */
export async function runScan(opts: ScanOptions): Promise<Report> {
  const root = resolve(opts.cwd);
  const ctx = await createScanContext({ root, url: opts.url });

  for (const r of allRules) registerRuleCategory(r.meta.id, r.meta.category);

  const results = await Promise.all(
    allRules.map(async (rule) => {
      try {
        return await rule.check(ctx);
      } catch (err) {
        return {
          ruleId: rule.meta.id,
          status: "fail" as const,
          points: 0,
          message: `Rule crashed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }),
  );

  // Enrich actionable results with predefined fix prompts (static
  // templates — no LLM). Returns new result objects; never mutates.
  const enriched = attachPrompts(results, ctx.meta);

  return buildReport({
    version: VERSION,
    root,
    url: opts.url,
    results: enriched,
  });
}

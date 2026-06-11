// `agentlint prompt` — scan, then print one consolidated, copy-pasteable
// fix prompt for any AI coding agent. Pure orchestration with injected
// deps so the command is unit-testable without spawning a process.

import type { Report } from "@agentlinthq/core";
import { composeFixPrompt } from "../prompts/compose.js";
import { allRules } from "../rules/index.js";

export interface PromptCmdOptions {
  /** Repo path to scan (already resolved by the caller). */
  path: string;
  /** Optional docs-site URL, same semantics as `agentlint --url`. */
  url?: string;
  /** Restrict output to these rule ids. */
  rules?: string[];
}

export interface PromptCmdDeps {
  scan(opts: { cwd: string; url?: string }): Promise<Report>;
  /** Write prompt output (stdout). */
  write(text: string): void;
  /** Write informational messages. */
  log(line: string): void;
}

export type PromptCmdOutcome =
  | { kind: "printed"; score: number }
  | { kind: "nothing-to-fix"; score: number }
  | { kind: "unknown-rules"; unknown: string[] };

export async function runPromptCmd(
  opts: PromptCmdOptions,
  deps: PromptCmdDeps,
): Promise<PromptCmdOutcome> {
  if (opts.rules && opts.rules.length > 0) {
    const known = new Set(allRules.map((r) => r.meta.id));
    const unknown = opts.rules.filter((id) => !known.has(id));
    if (unknown.length > 0) {
      deps.log(`Unknown rule id(s): ${unknown.join(", ")}`);
      deps.log(`Valid ids: ${[...known].sort().join(", ")}`);
      return { kind: "unknown-rules", unknown };
    }
  }

  const report = await deps.scan({ cwd: opts.path, url: opts.url });
  const prompt = composeFixPrompt(report, opts.rules);

  if (prompt === null) {
    deps.log(
      `Nothing to fix${opts.rules?.length ? " for the requested rule(s)" : ""} — score ${report.score}/100.`,
    );
    return { kind: "nothing-to-fix", score: report.score };
  }

  deps.write(prompt);
  return { kind: "printed", score: report.score };
}

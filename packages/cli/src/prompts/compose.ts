// Composition of fix prompts into agent-ready output.
//
// `attachPrompts` enriches scan results with per-rule prompts (called once
// by runScan). `composeFixPrompt` assembles one consolidated, copy-pasteable
// markdown prompt from an enriched report — used by `agentlint prompt`.

import type { ProjectMeta, Report, Result } from "@agentlinthq/core";
import { allRules } from "../rules/index.js";
import { buildRulePrompt } from "./registry.js";

const weightById = new Map(allRules.map((r) => [r.meta.id, r.meta.weight]));

/**
 * A result is actionable when it failed outright, or warned with a fix
 * recipe attached. Warns without a fix are informational — no prompt.
 */
function isActionable(r: Result): boolean {
  return r.status === "fail" || (r.status === "warn" && r.fix !== undefined);
}

/**
 * Return a new results array where every actionable result carries a
 * predefined `fix.prompt`. Never mutates the input. Results without a fix
 * envelope get one with the finding message as summary.
 */
export function attachPrompts(results: Result[], meta: ProjectMeta): Result[] {
  return results.map((r) => {
    if (!isActionable(r)) return r;
    const prompt = buildRulePrompt(r, meta);
    if (!prompt) return r;
    return {
      ...r,
      fix: { summary: r.message, ...r.fix, prompt },
    };
  });
}

/** Actionable results that carry a prompt, fails first, weight descending. */
function promptedResults(report: Report, ruleIds?: string[]): Result[] {
  const wanted = ruleIds && ruleIds.length > 0 ? new Set(ruleIds) : null;
  return report.results
    .filter((r) => isActionable(r) && r.fix?.prompt)
    .filter((r) => (wanted ? wanted.has(r.ruleId) : true))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "fail" ? -1 : 1;
      return (weightById.get(b.ruleId) ?? 0) - (weightById.get(a.ruleId) ?? 0);
    });
}

export interface RulePrompt {
  ruleId: string;
  prompt: string;
}

/** Per-rule prompts for the requested ids (unknown ids are dropped). */
export function composeRulePrompts(
  report: Report,
  ruleIds?: string[],
): RulePrompt[] {
  return promptedResults(report, ruleIds).map((r) => ({
    ruleId: r.ruleId,
    // promptedResults guarantees fix.prompt exists.
    prompt: r.fix?.prompt as string,
  }));
}

/**
 * One consolidated markdown prompt covering every actionable finding,
 * ready to paste into any AI coding agent. Returns null when there is
 * nothing to fix.
 */
export function composeFixPrompt(
  report: Report,
  ruleIds?: string[],
): string | null {
  const items = promptedResults(report, ruleIds);
  if (items.length === 0) return null;

  const lines: string[] = [];
  lines.push("# Fix agentlint findings");
  lines.push("");
  lines.push(
    `You are an AI coding agent working in the repository at ${report.root}.`,
  );
  lines.push(
    `agentlint (https://agentlint.sh) scored this repository **${report.score}/100** for AI-agent readiness. Apply the fixes below, in order.`,
  );
  lines.push("");
  lines.push("## Ground rules");
  lines.push("");
  lines.push(
    "- Derive every command, path, and convention from the actual repository — never invent commands that don't exist.",
  );
  lines.push(
    "- Keep changes minimal and scoped to these fixes. Do not refactor unrelated code.",
  );
  lines.push(
    "- Do not game the checks: the goal is genuinely useful agent context, not merely passing the linter.",
  );
  lines.push(
    "- If a fix requires a decision only the repository owner can make (e.g. choosing a license), stop and ask instead of guessing.",
  );
  lines.push("");
  lines.push("## Fixes (priority order)");

  items.forEach((r, i) => {
    const weight = weightById.get(r.ruleId);
    const tag = r.status === "fail" ? "FAIL" : "WARN";
    lines.push("");
    lines.push(
      `### ${i + 1}. \`${r.ruleId}\` (${tag}${weight ? `, ${weight} pts` : ""})`,
    );
    lines.push("");
    lines.push(`Finding: ${r.message}`);
    lines.push("");
    lines.push(r.fix?.prompt as string);
  });

  lines.push("");
  lines.push("## Verify");
  lines.push("");
  lines.push(
    "When done, run `npx @agentlinthq/cli@latest .` (or `agentlint .` if installed) and confirm the rules above now pass and the score improved.",
  );
  lines.push("");
  return lines.join("\n");
}

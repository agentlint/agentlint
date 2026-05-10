import type { Result, ScanContext } from "@agentlint/core";

/** Quick result builders to keep rule files compact. */
export const pass = (
  ruleId: string,
  points: number,
  message: string,
): Result => ({
  ruleId,
  status: "pass",
  points,
  message,
});

export const fail = (
  ruleId: string,
  message: string,
  fix?: Result["fix"],
): Result => ({
  ruleId,
  status: "fail",
  points: 0,
  message,
  fix,
});

export const warn = (
  ruleId: string,
  points: number,
  message: string,
  fix?: Result["fix"],
): Result => ({
  ruleId,
  status: "warn",
  points,
  message,
  fix,
});

export const skip = (ruleId: string, message: string): Result => ({
  ruleId,
  status: "skip",
  points: null,
  message,
});

/** Find AGENTS.md (or its case variants) at the repo root. */
export async function findAgentsMd(
  ctx: ScanContext,
): Promise<{ name: string; content: string } | null> {
  for (const name of ["AGENTS.md", "agents.md", "Agents.md"]) {
    const content = await ctx.read(name);
    if (content !== null) return { name, content };
  }
  return null;
}

/** Get a script value from package.json's scripts object, if any. */
export function getNpmScript(
  ctx: ScanContext,
  name: string,
): string | undefined {
  const m = ctx.meta.manifest;
  if (!m || typeof m !== "object") return undefined;
  const scripts = m.scripts as Record<string, string> | undefined;
  if (!scripts || typeof scripts !== "object") return undefined;
  return scripts[name];
}

/**
 * Scan AGENTS.md for sections — case-insensitive, looks for ## or ###
 * headings whose text contains the given keyword.
 */
export function hasSection(content: string, keyword: string): boolean {
  const re = new RegExp(`^#{1,6}\\s+.*${keyword}.*$`, "im");
  return re.test(content);
}

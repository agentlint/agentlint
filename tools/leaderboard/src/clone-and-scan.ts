import { rm } from "node:fs/promises";
import { join } from "node:path";

export type ExecFn = (
  cmd: string,
  args: string[],
  opts?: { cwd?: string; timeoutMs?: number },
) => Promise<{ stdout: string; stderr: string }>;

export interface ScanRepoOptions {
  owner: string;
  repo: string;
  defaultBranch: string;
  cliPath: string;
  workDir: string;
  cloneTimeoutMs?: number;
  scanTimeoutMs?: number;
  execFn?: ExecFn;
  cleanup?: boolean;
}

export interface AgentlintResult {
  ruleId: string;
  status: "pass" | "fail" | "skip" | string;
  points: number;
  message?: string;
}

export interface AgentlintReport {
  version: string;
  score: number;
  results: AgentlintResult[];
  passes: number;
  fails: number;
  skips: number;
}

export type ScanRepoResult =
  | (AgentlintReport & { ok: true; owner: string; repo: string })
  | { ok: false; owner: string; repo: string; error: string };

export function parseAgentlintReport(jsonText: string): AgentlintReport {
  const parsed = JSON.parse(jsonText) as Record<string, unknown>;
  if (typeof parsed.score !== "number") {
    throw new Error("agentlint JSON missing numeric `score` field");
  }
  const results = Array.isArray(parsed.results)
    ? (parsed.results as AgentlintResult[])
    : [];
  const passes = results.filter((r) => r.status === "pass").length;
  const fails = results.filter((r) => r.status === "fail").length;
  const skips = results.filter((r) => r.status === "skip").length;
  return {
    version: typeof parsed.version === "string" ? parsed.version : "unknown",
    score: parsed.score,
    results,
    passes,
    fails,
    skips,
  };
}

const DEFAULT_CLONE_TIMEOUT = 60_000;
const DEFAULT_SCAN_TIMEOUT = 90_000;

export async function scanRepo(opts: ScanRepoOptions): Promise<ScanRepoResult> {
  const {
    owner,
    repo,
    defaultBranch,
    cliPath,
    workDir,
    cloneTimeoutMs = DEFAULT_CLONE_TIMEOUT,
    scanTimeoutMs = DEFAULT_SCAN_TIMEOUT,
    execFn,
    cleanup = true,
  } = opts;

  if (!execFn) {
    throw new Error("scanRepo requires execFn (use spawnExec from runtime)");
  }

  const dest = join(workDir, `${owner}--${repo}`);
  const cloneUrl = `https://github.com/${owner}/${repo}.git`;

  try {
    await execFn(
      "git",
      ["clone", "--depth=1", "--branch", defaultBranch, cloneUrl, dest],
      { timeoutMs: cloneTimeoutMs },
    );
  } catch (err) {
    return {
      ok: false,
      owner,
      repo,
      error: `clone failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  let report: AgentlintReport;
  try {
    const { stdout } = await execFn(cliPath, ["--json", dest], {
      timeoutMs: scanTimeoutMs,
    });
    report = parseAgentlintReport(stdout);
  } catch (err) {
    if (cleanup) {
      await rm(dest, { recursive: true, force: true }).catch(() => {});
    }
    return {
      ok: false,
      owner,
      repo,
      error: `scan failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (cleanup) {
    await rm(dest, { recursive: true, force: true }).catch(() => {});
  }

  return { ok: true, owner, repo, ...report };
}

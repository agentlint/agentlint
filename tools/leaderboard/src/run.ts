#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { aggregate, type LeaderboardRow } from "./aggregate.js";
import { type ExecFn, scanRepo, type ScanRepoResult } from "./clone-and-scan.js";
import { type FetchFn, fetchTopRepos } from "./fetch-repos.js";
import { renderJson, renderTable } from "./render.js";

export interface RunOptions {
  token: string;
  limit: number;
  cliPath: string;
  outDir: string;
  htmlDir: string;
  workDir: string;
  cliVersion?: string;
  fetchFn?: FetchFn;
  execFn?: ExecFn;
  clock?: () => Date;
  logger?: (msg: string) => void;
}

export interface RunResult {
  ok: boolean;
  jsonPath: string;
  latestPath: string;
  htmlPath: string;
  rows: LeaderboardRow[];
  successCount: number;
  failureCount: number;
  generatedAt: string;
}

const noop = (_msg: string): void => {};

export async function runLeaderboard(opts: RunOptions): Promise<RunResult> {
  if (!opts.token) {
    throw new Error("GITHUB_TOKEN is required");
  }
  if (!Number.isFinite(opts.limit) || opts.limit <= 0) {
    throw new Error("limit must be a positive integer");
  }

  const clock = opts.clock ?? (() => new Date());
  const log = opts.logger ?? noop;
  const execFn = opts.execFn ?? defaultExec;
  const cliVersion = opts.cliVersion ?? "unknown";

  log(`leaderboard: fetching top ${opts.limit} repos from GitHub`);
  const repos = await fetchTopRepos({
    token: opts.token,
    limit: opts.limit,
    fetchFn: opts.fetchFn,
  });
  log(`leaderboard: fetched ${repos.length} repo entries`);

  await mkdir(opts.workDir, { recursive: true });

  const scanResults: ScanRepoResult[] = [];
  for (let i = 0; i < repos.length; i += 1) {
    const repo = repos[i];
    if (!repo) continue;
    log(
      `leaderboard: scanning ${i + 1}/${repos.length} ${repo.owner}/${repo.repo}`,
    );
    const result = await scanRepo({
      owner: repo.owner,
      repo: repo.repo,
      defaultBranch: repo.defaultBranch,
      cliPath: opts.cliPath,
      workDir: opts.workDir,
      execFn,
    });
    scanResults.push(result);
  }

  const rows = aggregate({ repos, scanResults });
  const successCount = rows.filter((r) => r.score !== null).length;
  const failureCount = rows.length - successCount;
  const generatedAt = clock().toISOString();
  const datestamp = generatedAt.slice(0, 10);

  await mkdir(opts.outDir, { recursive: true });
  await mkdir(opts.htmlDir, { recursive: true });

  const jsonPath = join(opts.outDir, `${datestamp}.json`);
  const latestPath = join(opts.outDir, "latest.json");
  const htmlPath = join(opts.htmlDir, "leaderboard.html");

  const jsonText = renderJson({ generatedAt, cliVersion, rows });
  const htmlText = renderTable({ generatedAt, cliVersion, rows });

  await writeFile(jsonPath, jsonText, "utf8");
  await writeFile(latestPath, jsonText, "utf8");
  await writeFile(htmlPath, htmlText, "utf8");

  log(
    `leaderboard: wrote ${jsonPath} (success=${successCount}, fail=${failureCount})`,
  );

  return {
    ok: successCount > 0,
    jsonPath,
    latestPath,
    htmlPath,
    rows,
    successCount,
    failureCount,
    generatedAt,
  };
}

const defaultExec: ExecFn = (cmd, args, opts) =>
  new Promise((resolveExec, rejectExec) => {
    const child = spawn(cmd, args, {
      cwd: opts?.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    const timeout = opts?.timeoutMs
      ? setTimeout(() => {
          child.kill("SIGKILL");
          rejectExec(new Error(`${cmd} timed out after ${opts.timeoutMs}ms`));
        }, opts.timeoutMs)
      : null;
    child.on("error", (err) => {
      if (timeout) clearTimeout(timeout);
      rejectExec(err);
    });
    child.on("close", (code) => {
      if (timeout) clearTimeout(timeout);
      if (code === 0) {
        resolveExec({ stdout, stderr });
        return;
      }
      rejectExec(
        new Error(`${cmd} exited with code ${code}: ${stderr.trim() || "no stderr"}`),
      );
    });
  });

interface EnvLike {
  GITHUB_TOKEN?: string;
  LEADERBOARD_LIMIT?: string;
  LEADERBOARD_OUTDIR?: string;
  LEADERBOARD_HTMLDIR?: string;
  LEADERBOARD_WORKDIR?: string;
  AGENTLINT_CLI_PATH?: string;
  AGENTLINT_CLI_VERSION?: string;
}

export interface EntryOptions {
  env: EnvLike;
  cwd: string;
  logger?: (msg: string) => void;
}

export function resolveEntryOptions(opts: EntryOptions): RunOptions {
  const env = opts.env;
  const cwd = opts.cwd;
  const limit = env.LEADERBOARD_LIMIT
    ? Number.parseInt(env.LEADERBOARD_LIMIT, 10)
    : 100;
  return {
    token: env.GITHUB_TOKEN ?? "",
    limit,
    cliPath: resolve(
      cwd,
      env.AGENTLINT_CLI_PATH ?? "packages/cli/dist/index.js",
    ),
    outDir: resolve(
      cwd,
      env.LEADERBOARD_OUTDIR ?? "tools/leaderboard/data/aggregated",
    ),
    htmlDir: resolve(cwd, env.LEADERBOARD_HTMLDIR ?? "tools/leaderboard/out"),
    workDir: env.LEADERBOARD_WORKDIR ?? tmpdir(),
    cliVersion: env.AGENTLINT_CLI_VERSION ?? "unknown",
    logger: opts.logger,
  };
}

export async function main(): Promise<number> {
  try {
    const options = resolveEntryOptions({
      env: process.env,
      cwd: process.cwd(),
      logger: (msg) => process.stderr.write(`${msg}\n`),
    });
    const result = await runLeaderboard(options);
    process.stdout.write(`${result.jsonPath}\n`);
    return result.ok ? 0 : 1;
  } catch (err) {
    process.stderr.write(
      `leaderboard run failed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return 1;
  }
}

const isEntrypoint =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    },
  );
}

#!/usr/bin/env node
import { exec } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import type { Report } from "@agentlinthq/core";
import { runScan, VERSION } from "./api.js";
import { runInit } from "./init/index.js";
import { runLogin } from "./login/index.js";
import { writeTokenFile } from "./login/token-file.js";
import { runLogout } from "./logout/index.js";
import { pushReport } from "./push/client.js";
import { loadConfig } from "./push/config.js";
import { detectPrContext, type PrContext } from "./push/pr-detect.js";
import { detectRepo } from "./push/repo-detect.js";
import { missingTokenMessage, resolveToken } from "./push/token.js";
import { renderHtml } from "./report/html.js";
import { renderJson } from "./report/json.js";
import { renderMarkdown } from "./report/markdown.js";
import { renderTerminal } from "./report/terminal.js";

const DEFAULT_PUSH_URL = "https://agentlint.sh";

async function main() {
  // Handle subcommands first. v2 introduces `init`; v2.1 adds `login`/`logout`.
  const rawArgs = process.argv.slice(2);
  if (rawArgs[0] === "init") {
    await runInitCommand(rawArgs.slice(1));
    return;
  }
  if (rawArgs[0] === "login") {
    await runLoginCommand(rawArgs.slice(1));
    return;
  }
  if (rawArgs[0] === "logout") {
    await runLogoutCommand(rawArgs.slice(1));
    return;
  }

  const { values, positionals } = parseArgs({
    args: rawArgs,
    options: {
      json: { type: "boolean" },
      markdown: { type: "boolean" },
      url: { type: "string" },
      output: { type: "string", short: "o" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
      "no-html": { type: "boolean" },
      push: { type: "boolean" },
      public: { type: "boolean" },
      pr: { type: "string" },
      project: { type: "string" },
      branch: { type: "string" },
      commit: { type: "string" },
    },
    allowPositionals: true,
    strict: true,
  });

  if (values.help) {
    printHelp();
    return;
  }
  if (values.version) {
    console.log(VERSION);
    return;
  }

  const root = resolve(positionals[0] ?? ".");

  // The --url flag is overloaded:
  //   - on its own it means "audit this docs site"
  //   - with --push it ALSO selects the upload endpoint
  // To disambiguate, --push uses (in order): an explicit --url that looks
  // like an endpoint, AGENTLINT_URL, or the default. The docs URL passed
  // to the scan is whatever --url was, regardless.
  const report = await runScan({ cwd: root, url: values.url });

  // Resolve PR context once. The `--pr <n>` flag is a manual override that
  // surfaces through the same detector via the AGENTLINT_PR env path.
  const prCliOverride = parsePrFlag(values.pr);
  const prContext = resolvePrContext(prCliOverride);

  const pushArgs: PushArgs = {
    flagUrl: values.url,
    cwd: root,
    isPublic: !!values.public,
    prContext,
    projectIdFlag: values.project,
    branchFlag: values.branch,
    commitFlag: values.commit,
  };

  let policyExit = 0;
  if (values.json) {
    process.stdout.write(renderJson(report));
    if (values.push) policyExit = await runPush(report, pushArgs);
    process.exit(resolveExitCode(report.score, policyExit));
  }
  if (values.markdown) {
    process.stdout.write(renderMarkdown(report));
    if (values.push) policyExit = await runPush(report, pushArgs);
    process.exit(resolveExitCode(report.score, policyExit));
  }

  // Default: pretty terminal + write HTML to disk.
  process.stdout.write(renderTerminal(report));

  if (!values["no-html"]) {
    const htmlPath = values.output ?? "agentlint-report.html";
    writeFileSync(htmlPath, renderHtml(report));
    console.log(`  Full report:    ${htmlPath}`);
    console.log("");
  }

  if (values.push) policyExit = await runPush(report, pushArgs);

  process.exit(resolveExitCode(report.score, policyExit));
}

/**
 * Resolve the final CLI exit code. Score-of-80 fails take exit 1; policy
 * fails take exit 2. When both fail, policy wins so CI users see the most
 * actionable signal (and can distinguish "score regression" from "policy
 * change" via the exit code).
 */
export function resolveExitCode(score: number, policyExit: number): number {
  if (policyExit !== 0) return policyExit;
  return score < 80 ? 1 : 0;
}

interface InitCliFlags {
  token?: string;
  repo?: string;
  endpoint?: string;
  yes?: boolean;
  "no-workflow"?: boolean;
  "force-workflow"?: boolean;
  help?: boolean;
}

/**
 * Dispatch for `agentlint init`. Owns its own parseArgs config because the
 * top-level command-flag schema doesn't include init-only flags.
 */
async function runInitCommand(initArgs: string[]): Promise<void> {
  const parsed = parseArgs({
    args: initArgs,
    options: {
      token: { type: "string" },
      repo: { type: "string" },
      endpoint: { type: "string" },
      yes: { type: "boolean", short: "y" },
      "no-workflow": { type: "boolean" },
      "force-workflow": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
  });
  const flags = parsed.values as InitCliFlags;

  if (flags.help) {
    printInitHelp();
    return;
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const log = (line: string) => console.log(line);

  const outcome = await runInit(
    {
      token: flags.token,
      repo: flags.repo,
      endpoint: flags.endpoint,
      yes: flags.yes,
      noWorkflow: flags["no-workflow"],
      forceWorkflow: flags["force-workflow"],
    },
    {
      cwd: process.cwd(),
      log,
      prompt: (q) => rl.question(q),
    },
  );
  rl.close();

  if (outcome.kind === "wrote-config") {
    process.exit(0);
  }
  process.exit(1);
}

interface LoginCliFlags {
  endpoint?: string;
  "no-browser"?: boolean;
  help?: boolean;
}

/**
 * Dispatch for `agentlint login`. Runs the device flow and writes the
 * token to ~/.config/agentlint/token on success.
 */
async function runLoginCommand(loginArgs: string[]): Promise<void> {
  const parsed = parseArgs({
    args: loginArgs,
    options: {
      endpoint: { type: "string" },
      "no-browser": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
  });
  const flags = parsed.values as LoginCliFlags;

  if (flags.help) {
    printLoginHelp();
    return;
  }

  const log = (line: string) => console.log(line);
  const outcome = await runLogin(
    {
      endpoint: flags.endpoint,
      noBrowser: flags["no-browser"],
    },
    {
      log,
      writeTokenFile: (t) => writeTokenFile(t),
      openBrowser: (u) => openBrowserUrl(u),
    },
  );

  if (outcome.kind === "success") {
    process.exit(0);
  }
  if (outcome.kind === "expired") {
    console.log("");
    console.log("Authorization expired. Run `agentlint login` again.");
    process.exit(2);
  }
  if (outcome.kind === "denied") {
    console.log("");
    console.log("Authorization was denied.");
    process.exit(3);
  }
  // network-error
  console.log("");
  console.log(`Login failed: ${outcome.reason}`);
  process.exit(4);
}

interface LogoutCliFlags {
  help?: boolean;
}

async function runLogoutCommand(logoutArgs: string[]): Promise<void> {
  const parsed = parseArgs({
    args: logoutArgs,
    options: {
      help: { type: "boolean", short: "h" },
    },
    strict: true,
  });
  const flags = parsed.values as LogoutCliFlags;
  if (flags.help) {
    printLogoutHelp();
    return;
  }
  const log = (line: string) => console.log(line);
  await runLogout({ log });
  process.exit(0);
}

/**
 * Open a URL in the user's default browser. Best-effort: failures are
 * swallowed because the CLI already printed the URL.
 */
function openBrowserUrl(url: string): Promise<void> {
  return new Promise((resolveFn) => {
    const platform = process.platform;
    let cmd: string;
    if (platform === "darwin") cmd = `open ${quoteShell(url)}`;
    else if (platform === "win32") cmd = `start "" ${quoteShell(url)}`;
    else cmd = `xdg-open ${quoteShell(url)}`;
    exec(cmd, { timeout: 5_000, windowsHide: true }, () => resolveFn());
  });
}

function quoteShell(s: string): string {
  return `"${s.replace(/"/g, '\\"')}"`;
}

/**
 * Parse the `--pr <n>` CLI flag. Empty / non-numeric values resolve to null
 * (we never want a typo to silently disable PR detection — the env-var path
 * still runs when the override is null).
 */
function parsePrFlag(raw: string | undefined): number | null {
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Resolve the PR context with optional CLI flag override. The override
 * temporarily injects `AGENTLINT_PR` into the env so the detector's existing
 * precedence rules apply; this keeps a single source of truth for "what
 * counts as a PR run".
 */
function resolvePrContext(cliOverride: number | null): PrContext | null {
  if (cliOverride !== null) {
    const merged: Record<string, string | undefined> = {
      ...process.env,
      AGENTLINT_PR: String(cliOverride),
    };
    return detectPrContext((name) => merged[name]);
  }
  return detectPrContext();
}

interface PushArgs {
  flagUrl: string | undefined;
  cwd: string;
  isPublic: boolean;
  prContext: PrContext | null;
  projectIdFlag: string | undefined;
  branchFlag: string | undefined;
  commitFlag: string | undefined;
}

/**
 * Run a single `git <args>` command and return trimmed stdout, or null on
 * any failure. Used to derive branch/commit when no flag or CI var is set.
 */
function runGit(args: string, cwd: string): Promise<string | null> {
  return new Promise((resolveFn) => {
    exec(
      `git ${args}`,
      { cwd, timeout: 2_000, windowsHide: true },
      (err, stdout) => {
        if (err) {
          resolveFn(null);
          return;
        }
        // Node's `exec` typings narrow stdout to `string | Buffer`, but the
        // runtime shape is well-defined and we just want a UTF-8 string out.
        // biome-ignore lint/suspicious/noExplicitAny: see comment above
        const out = stdout as any;
        const text: string =
          typeof out === "string"
            ? out
            : out && typeof out.toString === "function"
              ? String(out)
              : "";
        const trimmed = text.trim();
        resolveFn(trimmed.length > 0 ? trimmed : null);
      },
    );
  });
}

async function resolveBranch(
  flag: string | undefined,
  cwd: string,
): Promise<string | null> {
  if (flag && flag.length > 0) return flag;
  const env = process.env.GITHUB_REF_NAME;
  if (env && env.length > 0) return env;
  return runGit("rev-parse --abbrev-ref HEAD", cwd);
}

async function resolveCommitSha(
  flag: string | undefined,
  cwd: string,
): Promise<string | null> {
  if (flag && flag.length > 0) return flag;
  const env = process.env.GITHUB_SHA;
  if (env && env.length > 0) return env;
  return runGit("rev-parse HEAD", cwd);
}

/**
 * Resolve token, detect repo, POST the report. Returns the exit code the
 * caller should use: 0 for everything except an enforced policy failure,
 * which returns 2. Push transport failures stay at 0 — the local audit
 * already succeeded; push is a side effect (CHARTER §3, PRD §CLI surface).
 */
async function runPush(report: Report, args: PushArgs): Promise<number> {
  const endpoint =
    pickEndpoint(args.flagUrl) ?? process.env.AGENTLINT_URL ?? DEFAULT_PUSH_URL;

  const token = await resolveToken();
  if (!token) {
    console.log(`Push failed: ${missingTokenMessage()}`);
    return 0;
  }

  const config = await loadConfig(args.cwd);
  const projectId =
    args.projectIdFlag && args.projectIdFlag.length > 0
      ? args.projectIdFlag
      : (config?.projectId ?? null);
  if (!projectId) {
    console.log(
      "Push failed: no projectId (run `agentlint init` or pass --project <id>).",
    );
    return 0;
  }

  const repo = await detectRepo(args.cwd);
  const branch = await resolveBranch(args.branchFlag, args.cwd);
  const commitSha = await resolveCommitSha(args.commitFlag, args.cwd);

  const result = await pushReport({
    url: endpoint,
    token,
    report,
    metadata: {
      repo,
      branch,
      commitSha,
      projectId,
      isPublic: args.isPublic,
      prContext: args.prContext,
    },
  });

  if (!result.ok) {
    console.log(`Push failed: ${result.reason}`);
    return 0;
  }
  console.log(`Pushed: ${result.runUrl}`);
  if (result.policy && result.policy.enforce && !result.policy.passed) {
    console.log(
      `Policy failed: score ${report.score} is below minimum ${result.policy.minScore}`,
    );
    return 2;
  }
  return 0;
}

/**
 * The --url flag is primarily a docs-site URL for the documentation rules.
 * If the user passed --push --url <something>, we treat that --url as the
 * push endpoint only when it looks like a bare origin (no path beyond /).
 * Otherwise we fall back to AGENTLINT_URL / the default. This keeps the
 * existing single-flag use case unchanged while letting `--push --url` work.
 */
function pickEndpoint(flagUrl: string | undefined): string | null {
  if (!flagUrl) return null;
  try {
    const u = new URL(flagUrl);
    if (u.pathname === "/" || u.pathname === "") return flagUrl;
    return null;
  } catch {
    return null;
  }
}

function printHelp() {
  console.log(`
agentlint v${VERSION}  —  Lighthouse for AI coding agents

Usage:
  agentlint [path]           Scan the given path (default: cwd)
  agentlint init             Set up .agentlint.json for --push
  agentlint login            Authorize the CLI via the device flow
  agentlint logout           Delete the local token file

Options:
  --json                     Machine-readable JSON to stdout
  --markdown                 Markdown report to stdout (for AI agents)
  --url <docs-url>           Also audit the docs site at this URL
  --output, -o <path>        Where to write the HTML report
  --no-html                  Don't write an HTML report
  --push                     Upload the report to your agentlint.sh dashboard.
                             Requires AGENTLINT_TOKEN env (a project token)
                             and either a .agentlint.json config file at the
                             repo root or --project <id>.
  --project <id>             With --push, override the projectId from
                             .agentlint.json.
  --branch <name>            With --push, override the branch name. Defaults
                             to GITHUB_REF_NAME, then \`git rev-parse
                             --abbrev-ref HEAD\`.
  --commit <sha>             With --push, override the commit SHA. Defaults
                             to GITHUB_SHA, then \`git rev-parse HEAD\`.
  --public                   With --push, mark the run public so the score
                             badge at /badge/<owner>/<repo>.svg renders this
                             repo's score. No effect without --push.
  --pr <number>              With --push, override PR detection (CI usually
                             handles this automatically via GITHUB_REF /
                             AGENTLINT_PR). When the run is associated with
                             a PR, the agentlint GitHub App posts (or
                             updates) a score comment on the PR.
  --version, -v              Print version
  --help, -h                 Show this message

Exit codes:
  0   success (score >= 80)
  1   score regression (score < 80)
  2   policy failure (--push: org policy enforced and run scored below
      the configured minimum). Reserved so CI can tell policy from score.

Use these to gate CI.

Docs: https://agentlint.sh
`);
}

function printInitHelp() {
  console.log(`
agentlint init  —  set up .agentlint.json for --push

Usage:
  agentlint init [options]

Options:
  --token <value>            Project token (overrides AGENTLINT_TOKEN env).
                             Generate one at https://agentlint.sh/cli/auth.
  --repo <owner/name>        Override the git remote-derived repo name.
  --endpoint <url>           API base URL (default: https://agentlint.sh).
  --no-workflow              Skip writing .github/workflows/agentlint.yml.
  --force-workflow           Overwrite an existing workflow file.
  --yes, -y                  Non-interactive: fail rather than prompting.
  --help, -h                 Show this message
`);
}

function printLoginHelp() {
  console.log(`
agentlint login  —  authorize the CLI via the device flow

Usage:
  agentlint login [options]

Options:
  --endpoint <url>           API base URL (default: https://agentlint.sh).
  --no-browser               Don't auto-open the verification URL.
  --help, -h                 Show this message

Exit codes:
  0  success
  2  expired
  3  denied
  4  network error
`);
}

function printLogoutHelp() {
  console.log(`
agentlint logout  —  delete the local token file

Usage:
  agentlint logout
`);
}

main().catch((err) => {
  console.error("agentlint crashed:", err);
  process.exit(2);
});

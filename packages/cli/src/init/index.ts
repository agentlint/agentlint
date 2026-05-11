// `agentlint init` — interactive (or scripted) project setup.
//
// Goals (see CHANGELOG 2.0.0):
//   1. Confirm the project token is available (env or --token flag, or read
//      one interactively from stdin).
//   2. Detect the GitHub repo from `git config --get remote.origin.url`.
//      Fall back to asking the user when no remote is configured.
//   3. Call GET /api/cli/projects?repoOwner=&repoName= to discover the
//      project linked to this repo for the calling org. On 200, write
//      `.agentlint.json`. On 404, print a help message.
//   4. Print a CI snippet for GitHub Actions.
//
// The flow is split into a pure `runInit` that takes injectable IO + the
// thin `bin` entrypoint. Tests only exercise `runInit`.

import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  InstallSecretDeps,
  InstallSecretFlags,
  InstallSecretOutcome,
} from "../install-secret/index.js";
import { runInstallSecret } from "../install-secret/index.js";
import type { LoginDeps, LoginFlags, LoginOutcome } from "../login/index.js";
import { runLogin } from "../login/index.js";
import { readTokenFile as realReadTokenFile } from "../login/token-file.js";
import {
  type AgentlintConfig,
  CONFIG_FILENAME,
  stringifyConfig,
} from "../push/config.js";
import {
  type FetchFn as LookupFetchFn,
  lookupProject,
} from "../push/project-lookup.js";
import { detectRepo, type ExecFn } from "../push/repo-detect.js";
import { TOKEN_ENV_VAR } from "../push/token.js";
import { WORKFLOW_PATH, workflowYaml } from "./workflow-template.js";

export const DEFAULT_PUSH_URL = "https://agentlint.sh";

export type Logger = (line: string) => void;

export type PromptFn = (question: string) => Promise<string>;

export type WriteFileFn = (path: string, contents: string) => Promise<void>;

export type GetEnvFn = (name: string) => string | undefined;

export interface InitFlags {
  /** `--token <value>` — overrides AGENTLINT_TOKEN env when present. */
  token?: string;
  /** `--repo <owner/name>` — overrides git remote detection. */
  repo?: string;
  /** `--endpoint <url>` — overrides AGENTLINT_URL/default. */
  endpoint?: string;
  /** `--yes` — don't prompt; fail if we'd need to. */
  yes?: boolean;
  /** `--no-workflow` — skip writing .github/workflows/agentlint.yml. */
  noWorkflow?: boolean;
  /** `--force-workflow` — overwrite an existing workflow file. */
  forceWorkflow?: boolean;
  /**
   * `--no-install-secret` — skip the post-init call to `install-secret`.
   * Also implicitly skipped when `noWorkflow` is true (no Actions, no
   * secret needed).
   */
  noInstallSecret?: boolean;
}

export type MkdirFn = (path: string) => Promise<void>;

export type StatFn = (path: string) => Promise<{ isFile: boolean } | null>;

export type ReadTokenFileFn = () => Promise<string | null>;

export type RunLoginInlineFn = (
  flags: LoginFlags,
  deps: LoginDeps,
) => Promise<LoginOutcome>;

export type RunInstallSecretInlineFn = (
  flags: InstallSecretFlags,
  deps: InstallSecretDeps,
) => Promise<InstallSecretOutcome>;

export interface InitDeps {
  cwd: string;
  log: Logger;
  prompt: PromptFn;
  writeFileFn?: WriteFileFn;
  mkdirFn?: MkdirFn;
  statFn?: StatFn;
  getEnv?: GetEnvFn;
  execFn?: ExecFn;
  fetchFn?: LookupFetchFn;
  endpoint?: string;
  /** Read the on-disk token file. Override for tests. */
  readTokenFile?: ReadTokenFileFn;
  /** Run the device-flow login inline. Override for tests. */
  runLoginFn?: RunLoginInlineFn;
  /** Run install-secret inline. Override for tests. */
  runInstallSecretFn?: RunInstallSecretInlineFn;
}

export type InitOutcome =
  | { kind: "wrote-config"; configPath: string; config: AgentlintConfig }
  | { kind: "no-token" }
  | { kind: "no-repo" }
  | { kind: "no-project"; repoOwner: string; repoName: string }
  | { kind: "unauthorized" }
  | { kind: "error"; reason: string };

const SIGN_UP_HINT = `${DEFAULT_PUSH_URL}/cli/auth`;

/**
 * Resolve the project token. Precedence:
 *   1. `--token` flag
 *   2. `AGENTLINT_TOKEN` env var
 *   3. `~/.config/agentlint/token` (written by `agentlint login`)
 *   4. Offer to run `agentlint login` inline; on success, use that token.
 *   5. Interactive paste as a final fallback.
 *
 * Returns null if no token was obtained.
 */
async function resolveInitToken(
  flags: InitFlags,
  deps: InitDeps,
): Promise<string | null> {
  if (flags.token && flags.token.trim().length > 0) return flags.token.trim();

  const getEnv = deps.getEnv ?? ((n: string) => process.env[n]);
  const fromEnv = getEnv(TOKEN_ENV_VAR);
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }

  const readTokenFile = deps.readTokenFile ?? (() => realReadTokenFile());
  const fromFile = await readTokenFile();
  if (typeof fromFile === "string" && fromFile.trim().length > 0) {
    return fromFile.trim();
  }

  if (flags.yes) return null;

  // Offer to run the device flow inline. The user can decline and paste a
  // token instead — the flow used to be paste-only and we keep that path.
  deps.log("");
  deps.log(`No ${TOKEN_ENV_VAR} env var or token file found.`);
  const loginAnswer = await deps.prompt(`Run 'agentlint login' first? (Y/n) `);
  const wantsLogin = !/^n/i.test(loginAnswer.trim());
  if (wantsLogin) {
    const runLoginFn = deps.runLoginFn ?? runLogin;
    const outcome = await runLoginFn(
      { endpoint: flags.endpoint },
      { log: deps.log },
    );
    if (outcome.kind === "success") return outcome.token;
    deps.log("");
    if (outcome.kind === "denied") deps.log("Login denied.");
    else if (outcome.kind === "expired") deps.log("Login expired.");
    else deps.log(`Login failed: ${outcome.reason}`);
    deps.log(`  Open ${SIGN_UP_HINT} to generate a token manually.`);
    return null;
  }

  deps.log(`  Open ${SIGN_UP_HINT} to generate a project token.`);
  const answer = await deps.prompt(`Paste your token: `);
  const trimmed = answer.trim();
  if (trimmed.length === 0) return null;
  return trimmed;
}

interface ParsedRepo {
  owner: string;
  name: string;
}

function parseRepoFlag(raw: string | undefined): ParsedRepo | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const m = /^([^/\s]+)\/([^/\s]+)$/.exec(trimmed);
  if (!m) return null;
  return { owner: m[1] ?? "", name: m[2] ?? "" };
}

async function resolveRepo(
  flags: InitFlags,
  deps: InitDeps,
): Promise<ParsedRepo | null> {
  const fromFlag = parseRepoFlag(flags.repo);
  if (fromFlag) return fromFlag;

  const detected = await detectRepo(deps.cwd, deps.execFn);
  if (detected) return { owner: detected.owner, name: detected.name };

  if (flags.yes) return null;
  deps.log("");
  deps.log(
    "Could not detect a GitHub remote (`git config remote.origin.url`).",
  );
  const answer = await deps.prompt(`Enter repo as owner/name: `);
  return parseRepoFlag(answer);
}

function resolveEndpoint(flags: InitFlags, deps: InitDeps): string {
  if (flags.endpoint && flags.endpoint.length > 0) return flags.endpoint;
  if (deps.endpoint && deps.endpoint.length > 0) return deps.endpoint;
  const getEnv = deps.getEnv ?? ((n: string) => process.env[n]);
  const fromEnv = getEnv("AGENTLINT_URL");
  if (typeof fromEnv === "string" && fromEnv.length > 0) return fromEnv;
  return DEFAULT_PUSH_URL;
}

/**
 * Run `agentlint init`. Returns an outcome that the caller can format.
 *
 * Side effects (writes / prompts / network) all go through injected
 * dependencies so tests are deterministic and offline.
 */
export async function runInit(
  flags: InitFlags,
  deps: InitDeps,
): Promise<InitOutcome> {
  const token = await resolveInitToken(flags, deps);
  if (!token) {
    deps.log("");
    deps.log("No token provided. Run `agentlint init` again with a token.");
    return { kind: "no-token" };
  }

  const repo = await resolveRepo(flags, deps);
  if (!repo) {
    deps.log("");
    deps.log("Could not determine repo. Re-run with --repo <owner>/<name>.");
    return { kind: "no-repo" };
  }

  const endpoint = resolveEndpoint(flags, deps);

  const lookup = await lookupProject({
    url: endpoint,
    token,
    repoOwner: repo.owner,
    repoName: repo.name,
    fetchFn: deps.fetchFn,
  });

  if (lookup.kind === "unauthorized") {
    deps.log("");
    deps.log("Token was rejected by the server.");
    deps.log(`  Generate a new token at ${SIGN_UP_HINT}.`);
    return { kind: "unauthorized" };
  }
  if (lookup.kind === "error") {
    deps.log("");
    deps.log(`Project lookup failed: ${lookup.reason}`);
    return { kind: "error", reason: lookup.reason };
  }
  if (lookup.kind === "not-found") {
    deps.log("");
    deps.log(`No project linked to ${repo.owner}/${repo.name} for this token.`);
    deps.log(
      "  Create one at https://agentlint.sh/dashboard/projects/new and try again.",
    );
    return { kind: "no-project", repoOwner: repo.owner, repoName: repo.name };
  }

  const project = lookup.project;
  const config: AgentlintConfig = {
    projectId: project.projectId,
    orgSlug: project.orgSlug ?? null,
    repoOwner: repo.owner,
    repoName: repo.name,
    prodBranch:
      project.prodBranch && project.prodBranch.length > 0
        ? project.prodBranch
        : "main",
    version: 1,
  };

  const configPath = join(deps.cwd, CONFIG_FILENAME);
  const contents = stringifyConfig(config);
  const writeFileFn = deps.writeFileFn ?? ((p, c) => writeFile(p, c, "utf-8"));
  try {
    await writeFileFn(configPath, contents);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    deps.log("");
    deps.log(`Failed to write ${CONFIG_FILENAME}: ${reason}`);
    return { kind: "error", reason };
  }

  deps.log("");
  deps.log(`Wrote ${CONFIG_FILENAME}:`);
  deps.log(`  projectId: ${config.projectId}`);
  if (config.orgSlug) deps.log(`  orgSlug:   ${config.orgSlug}`);
  deps.log(`  repo:      ${config.repoOwner}/${config.repoName}`);
  deps.log(`  branch:    ${config.prodBranch}`);

  await maybeWriteWorkflow(flags, deps);

  // Best-effort: ask the server to install AGENTLINT_TOKEN as a repo secret
  // via the agentlint GitHub App's installation token. This removes the
  // browser-paste step. Non-fatal — `init` already succeeded by writing the
  // config + workflow. The user can re-run `agentlint install-secret` later.
  const installed = await maybeRunInstallSecret(flags, deps);

  // Fall back to the manual hint when install-secret didn't actually set
  // the secret (skipped, failed, app not installed, etc.).
  if (!installed) {
    deps.log("");
    deps.log("Next: store your token as the AGENTLINT_TOKEN repo secret:");
    deps.log(
      `  https://github.com/${config.repoOwner}/${config.repoName}/settings/secrets/actions/new`,
    );
    deps.log("  Name:   AGENTLINT_TOKEN");
    deps.log("  Secret: (the token written to ~/.config/agentlint/token)");
  }

  return { kind: "wrote-config", configPath, config };
}

/**
 * Optionally call the install-secret route after `init` writes the workflow.
 * Returns true when the secret was actually installed; false when the step
 * was skipped or failed (the caller falls back to the manual hint).
 *
 * Non-fatal in all branches: any failure here is rendered via the logger
 * and the overall init outcome remains `wrote-config`.
 */
async function maybeRunInstallSecret(
  flags: InitFlags,
  deps: InitDeps,
): Promise<boolean> {
  if (flags.noInstallSecret) return false;
  // If the user opted out of the workflow file, they're not using GHA — no
  // secret to install.
  if (flags.noWorkflow) return false;

  const runFn = deps.runInstallSecretFn ?? runInstallSecret;
  const outcome = await runFn(
    { endpoint: flags.endpoint },
    {
      cwd: deps.cwd,
      log: deps.log,
      getEnv: deps.getEnv,
    },
  );
  return outcome.kind === "installed";
}

/**
 * Write `.github/workflows/agentlint.yml` unless `--no-workflow` is set.
 * Refuses to overwrite an existing file unless `--force-workflow` is set.
 *
 * Failures here are logged but don't fail `init` — the user can hand-add
 * the workflow file (we still print a hint).
 */
async function maybeWriteWorkflow(
  flags: InitFlags,
  deps: InitDeps,
): Promise<void> {
  if (flags.noWorkflow) {
    deps.log("");
    deps.log(`Skipped ${WORKFLOW_PATH} (--no-workflow).`);
    return;
  }

  const target = join(deps.cwd, WORKFLOW_PATH);
  const statFn =
    deps.statFn ??
    (async (p: string) => {
      try {
        const st = await stat(p);
        return { isFile: st.isFile() };
      } catch {
        return null;
      }
    });

  const existing = await statFn(target);
  if (existing?.isFile && !flags.forceWorkflow) {
    deps.log("");
    deps.log(`${WORKFLOW_PATH} already exists — leaving it alone.`);
    deps.log("  Re-run with --force-workflow to overwrite.");
    return;
  }

  const mkdirFn =
    deps.mkdirFn ??
    ((p: string) => mkdir(p, { recursive: true }).then(() => {}));
  const writeFileFn = deps.writeFileFn ?? ((p, c) => writeFile(p, c, "utf-8"));

  try {
    await mkdirFn(dirname(target));
    await writeFileFn(target, workflowYaml());
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    deps.log("");
    deps.log(`Failed to write ${WORKFLOW_PATH}: ${reason}`);
    return;
  }

  deps.log("");
  deps.log(`Wrote ${WORKFLOW_PATH}.`);
}

/**
 * Suggested GitHub Actions snippet. Exposed so tests can assert on it.
 */
export function githubActionsSnippet(): string {
  return [
    "  permissions:",
    "    id-token: write    # required for OIDC-verified provenance",
    "    contents: read",
    "  steps:",
    "    - uses: actions/checkout@v4",
    "    - uses: actions/setup-node@v4",
    "      with:",
    "        node-version: 20",
    "    - run: npx @agentlinthq/cli --push",
    "      env:",
    // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions interpolation syntax, not a JS template literal.
    "        AGENTLINT_TOKEN: ${{ secrets.AGENTLINT_TOKEN }}",
  ].join("\n");
}

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

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
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
}

export interface InitDeps {
  cwd: string;
  log: Logger;
  prompt: PromptFn;
  writeFileFn?: WriteFileFn;
  getEnv?: GetEnvFn;
  execFn?: ExecFn;
  fetchFn?: LookupFetchFn;
  endpoint?: string;
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
 * Resolve the project token. Precedence: `--token` flag → AGENTLINT_TOKEN
 * env → interactive prompt. Returns null if no token was obtained.
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

  if (flags.yes) return null;
  deps.log("");
  deps.log(`No ${TOKEN_ENV_VAR} env var set.`);
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
  deps.log("");
  deps.log("Next: store your token as the AGENTLINT_TOKEN repo secret, then");
  deps.log("add this step to your GitHub Actions workflow:");
  deps.log("");
  deps.log(githubActionsSnippet());

  return { kind: "wrote-config", configPath, config };
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

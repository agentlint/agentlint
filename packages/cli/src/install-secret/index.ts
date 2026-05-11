// `agentlint install-secret` — push AGENTLINT_TOKEN as a repo secret via the
// agentlint GitHub App installation token, without the user opening the
// GitHub Settings page.
//
// The CLI never sees the secret value itself: it just POSTs to
// `/api/projects/:id/install-secret`. The server (web app) mints a fresh
// project token and PUTs it through the GitHub Actions secret API using
// libsodium sealing.
//
// Local-first invariant (CHARTER §3): this command is opt-in via subcommand,
// or run inline from `agentlint init` (which itself is opt-in). Default
// `agentlint .` never calls this. Never throws — always returns a
// discriminated outcome.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CONFIG_FILENAME, normalizeConfig } from "../push/config.js";
import { resolveToken } from "../push/token.js";

export const DEFAULT_PUSH_URL = "https://agentlint.sh";
export const INSTALL_SECRET_TIMEOUT_MS = 15_000;

export type FetchFn = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  },
) => Promise<Response>;

export interface InstallSecretFlags {
  /** `--endpoint <url>` — overrides AGENTLINT_URL/default. */
  endpoint?: string;
  /** Override the config path (mostly for tests). */
  configPath?: string;
}

export interface InstallSecretDeps {
  cwd: string;
  log: (line: string) => void;
  fetchFn?: FetchFn;
  getEnv?: (name: string) => string | undefined;
  readConfigFn?: (path: string) => Promise<string>;
}

export type InstallSecretOutcome =
  | { kind: "installed"; repo: string; installedAt: string }
  | { kind: "no-token" }
  | { kind: "no-config" }
  | { kind: "no-project-id" }
  | { kind: "app-not-installed"; installUrl: string }
  | { kind: "app-lacks-permission"; reAuthorizeUrl: string }
  | { kind: "github-api-failed"; status: number }
  | { kind: "network-error"; reason: string }
  | { kind: "unauthorized" };

interface ServerErrorBody {
  error?: string;
  install_url?: string;
  re_authorize_url?: string;
}

interface ServerSuccessBody {
  installed?: boolean;
  installedAt?: string;
  repo?: string;
}

/**
 * Resolve the API endpoint. Precedence:
 *   1. `--endpoint` flag
 *   2. `AGENTLINT_URL` env var
 *   3. Default (`https://agentlint.sh`)
 */
function resolveEndpoint(
  flags: InstallSecretFlags,
  deps: InstallSecretDeps,
): string {
  if (flags.endpoint && flags.endpoint.length > 0) return flags.endpoint;
  const getEnv = deps.getEnv ?? ((n: string) => process.env[n]);
  const fromEnv = getEnv("AGENTLINT_URL");
  if (typeof fromEnv === "string" && fromEnv.length > 0) return fromEnv;
  return DEFAULT_PUSH_URL;
}

/**
 * Best-effort JSON body parser. The server may return a non-JSON body on
 * 5xx; we never throw on a bad shape, just return null.
 */
async function readJsonBody(
  res: Response,
): Promise<(ServerErrorBody & ServerSuccessBody) | null> {
  try {
    return (await res.json()) as ServerErrorBody & ServerSuccessBody;
  } catch {
    return null;
  }
}

/**
 * Run `agentlint install-secret`. Returns a discriminated outcome the caller
 * formats into an exit code. Side effects (network, fs, env) all flow
 * through injected deps so tests stay deterministic.
 */
export async function runInstallSecret(
  flags: InstallSecretFlags,
  deps: InstallSecretDeps,
): Promise<InstallSecretOutcome> {
  // 1. Token.
  const getEnv = deps.getEnv ?? ((n: string) => process.env[n]);
  const token = await resolveToken({ getEnv });
  if (!token) {
    deps.log("No AGENTLINT_TOKEN. Run 'agentlint login' first.");
    return { kind: "no-token" };
  }

  // 2. Config — read directly. We don't walk-up here because the user is
  // expected to have just run `agentlint init` in this directory.
  const configPath = flags.configPath ?? join(deps.cwd, CONFIG_FILENAME);
  const readConfigFn =
    deps.readConfigFn ?? ((p: string) => readFile(p, "utf-8"));
  let raw: string;
  try {
    raw = await readConfigFn(configPath);
  } catch {
    deps.log("No .agentlint.json. Run 'agentlint init' first.");
    return { kind: "no-config" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    deps.log(".agentlint.json missing projectId. Run 'agentlint init' again.");
    return { kind: "no-project-id" };
  }

  const config = normalizeConfig(parsed);
  if (!config) {
    deps.log(".agentlint.json missing projectId. Run 'agentlint init' again.");
    return { kind: "no-project-id" };
  }

  // 3. Endpoint + URL.
  const endpoint = resolveEndpoint(flags, deps);
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(endpoint);
  } catch {
    const reason = `invalid endpoint URL: ${endpoint}`;
    deps.log(`Network error: ${reason}`);
    return { kind: "network-error", reason };
  }
  const target = `${parsedUrl.origin}/api/projects/${config.projectId}/install-secret`;

  // 4. POST.
  const fetchFn = deps.fetchFn ?? (globalThis.fetch as unknown as FetchFn);
  let res: Response;
  try {
    res = await fetchFn(target, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "agentlint-cli/2.0 (+https://agentlint.sh)",
      },
      body: "{}",
      signal: AbortSignal.timeout(INSTALL_SECRET_TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    deps.log(`Network error: ${reason}`);
    return { kind: "network-error", reason };
  }

  // 5. Map status -> outcome.
  if (res.status === 200) {
    const body = await readJsonBody(res);
    const repo = typeof body?.repo === "string" ? body.repo : "your repo";
    const installedAt =
      typeof body?.installedAt === "string"
        ? body.installedAt
        : new Date().toISOString();
    deps.log(`✓ Set AGENTLINT_TOKEN secret on ${repo}`);
    return { kind: "installed", repo, installedAt };
  }

  if (res.status === 401) {
    deps.log("Token rejected. Run 'agentlint login' again.");
    return { kind: "unauthorized" };
  }

  if (res.status === 409) {
    const body = await readJsonBody(res);
    const installUrl =
      typeof body?.install_url === "string"
        ? body.install_url
        : "https://github.com/apps/agentlint-ci/installations/new";
    deps.log(
      `GitHub App not installed on this repo. Install it at:\n  ${installUrl}\nThen run: agentlint install-secret`,
    );
    return { kind: "app-not-installed", installUrl };
  }

  if (res.status === 403) {
    const body = await readJsonBody(res);
    // not_org_admin can come through 403, but should not happen on the
    // project-token path — fall back to generic error rendering when no
    // re_authorize_url is present.
    if (typeof body?.re_authorize_url === "string") {
      const reAuthorizeUrl = body.re_authorize_url;
      deps.log(
        `The agentlint App needs 'Actions secrets: write'. Re-authorize at:\n  ${reAuthorizeUrl}\nThen run: agentlint install-secret`,
      );
      return { kind: "app-lacks-permission", reAuthorizeUrl };
    }
    deps.log(`GitHub API failed (${res.status}). Try again in a minute.`);
    return { kind: "github-api-failed", status: res.status };
  }

  if (res.status === 502) {
    deps.log(`GitHub API failed (${res.status}). Try again in a minute.`);
    return { kind: "github-api-failed", status: res.status };
  }

  // Anything else (incl. 404 project_not_found, 5xx) → generic.
  deps.log(`GitHub API failed (${res.status}). Try again in a minute.`);
  return { kind: "github-api-failed", status: res.status };
}

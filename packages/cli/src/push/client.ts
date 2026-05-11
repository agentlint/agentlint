// Push client for `agentlint --push` (v2).
//
// Posts a report payload to <endpoint>/api/runs with a project-scoped bearer
// token. Optionally forwards a GitHub Actions OIDC JWT in `x-github-oidc`
// so the server can verify provenance.
//
// Local-first invariant (CHARTER §3): only runs when --push is explicit.
// Never throws — always returns a discriminated result.

import type { Report } from "@agentlinthq/core";
import { fetchGithubOidcToken } from "./oidc.js";
import type { PrContext } from "./pr-detect.js";
import type { RepoInfo } from "./repo-detect.js";

const PUSH_TIMEOUT_MS = 15_000;
const RUNS_PATH = "/api/runs";

export type FetchFn = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  },
) => Promise<Response>;

export type GetEnvFn = (name: string) => string | undefined;

export type OidcFetcherFn = (opts: {
  getEnv?: GetEnvFn;
}) => Promise<string | null>;

export interface PushRunMetadata {
  /** Repo owner/name detected from `git config`; null if unavailable. */
  repo: RepoInfo | null;
  /** Current branch — flag → CI env → git → null. */
  branch: string | null;
  /** Current commit sha — flag → CI env → git → null. */
  commitSha: string | null;
  /** Project id from `.agentlint.json` or `--project <id>`; null if neither. */
  projectId: string | null;
  /** Public flag — when true, server exposes the run for the badge. */
  isPublic: boolean;
  /** PR context (auto-detected on GHA or via --pr / AGENTLINT_PR). */
  prContext: PrContext | null;
}

export interface PushReportArgs {
  /** Endpoint base, e.g. "https://agentlint.sh". Trailing slash optional. */
  url: string;
  token: string;
  report: Report;
  metadata: PushRunMetadata;
  fetchFn?: FetchFn;
  getEnv?: GetEnvFn;
  /** Override for testing — fetch the OIDC JWT. Defaults to real fetcher. */
  oidcFetcher?: OidcFetcherFn;
}

/**
 * Optional org policy evaluation returned by the server when the project
 * belongs to a Team-plan org with a policy configured. Added in the
 * `policy-thresholds-team` slice; absent for any other run (additive,
 * minor-version-safe — see CHARTER §4).
 */
export interface PolicyEvaluation {
  minScore: number;
  enforce: boolean;
  passed: boolean;
}

export type PushResult =
  | { ok: true; runUrl: string; policy: PolicyEvaluation | null }
  | { ok: false; reason: string };

/**
 * Defensive parser — coerces an unknown JSON value into a PolicyEvaluation,
 * or returns null if the shape doesn't match. Exported for testing.
 */
export function parsePolicy(raw: unknown): PolicyEvaluation | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.minScore !== "number" || !Number.isFinite(r.minScore))
    return null;
  if (typeof r.enforce !== "boolean") return null;
  if (typeof r.passed !== "boolean") return null;
  return {
    minScore: r.minScore,
    enforce: r.enforce,
    passed: r.passed,
  };
}

interface Counts {
  pass: number;
  fail: number;
  warn: number;
  skip: number;
}

function countByStatus(results: Report["results"]): Counts {
  let pass = 0;
  let fail = 0;
  let warn = 0;
  let skip = 0;
  for (const r of results) {
    if (r.status === "pass") pass += 1;
    else if (r.status === "fail") fail += 1;
    else if (r.status === "warn") warn += 1;
    else if (r.status === "skip") skip += 1;
  }
  return { pass, fail, warn, skip };
}

/**
 * Build the JSON payload posted to `/api/runs`. Exported for tests.
 */
export function buildPushBody(
  report: Report,
  metadata: PushRunMetadata,
): string {
  const counts = countByStatus(report.results);
  return JSON.stringify({
    score: report.score,
    passes: counts.pass,
    fails: counts.fail,
    warnings: counts.warn,
    skipped: counts.skip,
    repo: metadata.repo
      ? { owner: metadata.repo.owner, name: metadata.repo.name }
      : { owner: null, name: null },
    branch: metadata.branch,
    commitSha: metadata.commitSha,
    projectId: metadata.projectId,
    public: metadata.isPublic,
    pr: metadata.prContext,
    report,
  });
}

/**
 * Post the report to `<url>/api/runs`. Refuses non-https URLs unless the
 * URL is `http://localhost` / `http://127.0.0.1` or AGENTLINT_INSECURE=1.
 *
 * On GitHub Actions with `id-token: write`, attaches the runner's OIDC JWT
 * in `x-github-oidc`. OIDC fetch failure is non-fatal — the push proceeds
 * and the server tags it `unverified`.
 */
export async function pushReport(args: PushReportArgs): Promise<PushResult> {
  const fetchFn = args.fetchFn ?? (globalThis.fetch as FetchFn);
  const getEnv = args.getEnv ?? ((name: string) => process.env[name]);
  const oidcFetcher = args.oidcFetcher ?? fetchGithubOidcToken;

  let parsed: URL;
  try {
    parsed = new URL(args.url);
  } catch {
    return { ok: false, reason: `invalid endpoint URL: ${args.url}` };
  }

  const isHttps = parsed.protocol === "https:";
  const isLocalhost =
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
  const insecureAllowed = getEnv("AGENTLINT_INSECURE") === "1";
  if (!isHttps && !isLocalhost && !insecureAllowed) {
    return {
      ok: false,
      reason: `refusing to send token over non-https URL: ${parsed.protocol}//${parsed.host}`,
    };
  }

  const target = `${parsed.origin}${RUNS_PATH}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${args.token}`,
    "Content-Type": "application/json",
    "User-Agent": "agentlint-cli/2.0 (+https://agentlint.sh)",
  };

  // Best-effort OIDC. Anything that goes wrong here is non-fatal: we still
  // push, just without provenance.
  const oidc = await oidcFetcher({ getEnv }).catch(() => null);
  if (oidc) headers["x-github-oidc"] = oidc;

  const body = buildPushBody(args.report, args.metadata);

  let res: Response;
  try {
    res = await fetchFn(target, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `network error: ${msg}` };
  }

  if (res.status === 201) {
    let runUrl = `${parsed.origin}/dashboard`;
    let policy: PolicyEvaluation | null = null;
    try {
      const data = (await res.json()) as {
        url?: unknown;
        id?: unknown;
        policy?: unknown;
      };
      if (typeof data.url === "string" && data.url.length > 0) {
        runUrl = data.url.startsWith("http")
          ? data.url
          : `${parsed.origin}${data.url.startsWith("/") ? "" : "/"}${data.url}`;
      }
      policy = parsePolicy(data.policy);
    } catch {
      // Body wasn't JSON; fall back to the dashboard root, no policy.
    }
    return { ok: true, runUrl, policy };
  }

  if (res.status === 401 || res.status === 403) {
    return { ok: false, reason: "invalid or revoked token" };
  }
  if (res.status === 413) {
    return { ok: false, reason: "report too large (server limit 1 MB)" };
  }
  if (res.status === 429) {
    return { ok: false, reason: "rate limited (try again in a minute)" };
  }
  if (res.status >= 500) {
    return { ok: false, reason: `server error ${res.status}` };
  }
  return { ok: false, reason: `unexpected status ${res.status}` };
}

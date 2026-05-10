// GET /api/cli/projects?repoOwner=&repoName= — used by `agentlint init`.
//
// Returns the project metadata that the server has linked to (owner, name)
// for the calling token's org, or null if no such project exists.
//
// Like the rest of the push layer, this never throws: callers can render a
// one-line message and move on. The fetcher is injectable for tests.

const LOOKUP_TIMEOUT_MS = 10_000;
const LOOKUP_PATH = "/api/cli/projects";

export type FetchFn = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    signal: AbortSignal;
  },
) => Promise<Response>;

export interface ProjectLookupResult {
  projectId: string;
  orgSlug: string | null;
  repoOwner: string;
  repoName: string;
  prodBranch: string | null;
}

export interface LookupArgs {
  url: string;
  token: string;
  repoOwner: string;
  repoName: string;
  fetchFn?: FetchFn;
}

export type LookupOutcome =
  | { kind: "found"; project: ProjectLookupResult }
  | { kind: "not-found" }
  | { kind: "unauthorized" }
  | { kind: "error"; reason: string };

/**
 * Look up the project linked to `repoOwner/repoName` for the given token.
 */
export async function lookupProject(args: LookupArgs): Promise<LookupOutcome> {
  const fetchFn = args.fetchFn ?? (globalThis.fetch as FetchFn);

  let parsed: URL;
  try {
    parsed = new URL(args.url);
  } catch {
    return { kind: "error", reason: `invalid endpoint URL: ${args.url}` };
  }

  const target = new URL(`${parsed.origin}${LOOKUP_PATH}`);
  target.searchParams.set("repoOwner", args.repoOwner);
  target.searchParams.set("repoName", args.repoName);

  let res: Response;
  try {
    res = await fetchFn(target.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${args.token}`,
        Accept: "application/json",
        "User-Agent": "agentlint-cli/2.0 (+https://agentlint.sh)",
      },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { kind: "error", reason: `network error: ${msg}` };
  }

  if (res.status === 404) return { kind: "not-found" };
  if (res.status === 401 || res.status === 403) return { kind: "unauthorized" };
  if (res.status >= 500)
    return { kind: "error", reason: `server error ${res.status}` };
  if (res.status !== 200)
    return { kind: "error", reason: `unexpected status ${res.status}` };

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    return { kind: "error", reason: "response was not valid JSON" };
  }

  const project = normalizeProject(payload);
  if (!project) return { kind: "error", reason: "response missing projectId" };
  return { kind: "found", project };
}

function normalizeProject(payload: unknown): ProjectLookupResult | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  const projectId = typeof obj.projectId === "string" ? obj.projectId : null;
  if (!projectId || projectId.length === 0) return null;
  return {
    projectId,
    orgSlug: typeof obj.orgSlug === "string" ? obj.orgSlug : null,
    repoOwner:
      typeof obj.repoOwner === "string" && obj.repoOwner.length > 0
        ? obj.repoOwner
        : "",
    repoName:
      typeof obj.repoName === "string" && obj.repoName.length > 0
        ? obj.repoName
        : "",
    prodBranch: typeof obj.prodBranch === "string" ? obj.prodBranch : null,
  };
}

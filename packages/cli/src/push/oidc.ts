// GitHub Actions OIDC token fetcher.
//
// On GitHub Actions, if the workflow grants `id-token: write`, the runner
// exposes two env vars (`ACTIONS_ID_TOKEN_REQUEST_URL` and
// `ACTIONS_ID_TOKEN_REQUEST_TOKEN`) that let the job ask the runner for a
// JWT it can present to a third party. agentlint requests one with
// `audience=agentlint` and forwards it as the `x-github-oidc` header so the
// server can verify the run actually came from a GitHub Actions workflow
// associated with the right repo/branch.
//
// Failure is non-fatal at every step: missing env, network errors, malformed
// responses all resolve to null. Push still proceeds — the server will tag
// the run with `provenance: unverified`.

const OIDC_TIMEOUT_MS = 5_000;

export type FetchFn = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    signal: AbortSignal;
  },
) => Promise<Response>;

export type GetEnvFn = (name: string) => string | undefined;

export interface FetchOidcOptions {
  fetchFn?: FetchFn;
  getEnv?: GetEnvFn;
  /** Audience claim requested from the runner. Defaults to "agentlint". */
  audience?: string;
}

/**
 * Request a GitHub Actions OIDC token. Returns the JWT string on success or
 * null if we're not on Actions, if the request fails, or if the response
 * shape is unexpected. Never throws.
 */
export async function fetchGithubOidcToken(
  opts: FetchOidcOptions = {},
): Promise<string | null> {
  const getEnv = opts.getEnv ?? ((name: string) => process.env[name]);
  const fetchFn = opts.fetchFn ?? (globalThis.fetch as FetchFn);
  const audience = opts.audience ?? "agentlint";

  if (getEnv("GITHUB_ACTIONS") !== "true") return null;

  const baseUrl = getEnv("ACTIONS_ID_TOKEN_REQUEST_URL");
  const reqToken = getEnv("ACTIONS_ID_TOKEN_REQUEST_TOKEN");
  if (!baseUrl || !reqToken) return null;

  let target: string;
  try {
    const u = new URL(baseUrl);
    u.searchParams.set("audience", audience);
    target = u.toString();
  } catch {
    return null;
  }

  let res: Response;
  try {
    res = await fetchFn(target, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${reqToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(OIDC_TIMEOUT_MS),
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object") return null;
  const value = (payload as { value?: unknown }).value;
  if (typeof value !== "string" || value.length === 0) return null;
  return value;
}

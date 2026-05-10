// Push client for `agentlint --push`.
//
// Posts a report payload to <endpoint>/api/runs with a bearer token, with a
// 15s timeout. Never throws — always returns a discriminated result so the
// caller can render a one-line message and exit 0 (push is a side effect;
// the local audit already succeeded).
//
// Local-first invariant (CHARTER §3): this code only runs when the user
// passes --push. The HTTPS check below blocks accidental plaintext sends.

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

export interface PushReportArgs {
  /** Endpoint base, e.g. "https://agentlint.sh". Trailing slash optional. */
  url: string;
  token: string;
  /** Pre-serialized JSON body. The caller owns the shape (PRD §API surface). */
  body: string;
  fetchFn?: FetchFn;
  getEnv?: GetEnvFn;
}

export type PushResult =
  | { ok: true; runUrl: string }
  | { ok: false; reason: string };

/**
 * Post the report body to `<url>/api/runs`.
 *
 * Refuses non-https URLs unless the URL begins with `http://localhost` or
 * the env var AGENTLINT_INSECURE=1 is set. This is an undocumented escape
 * hatch for local web-side testing — see PRD §Security.
 */
export async function pushReport(args: PushReportArgs): Promise<PushResult> {
  const fetchFn = args.fetchFn ?? (globalThis.fetch as FetchFn);
  const getEnv = args.getEnv ?? ((name: string) => process.env[name]);

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

  let res: Response;
  try {
    res = await fetchFn(target, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.token}`,
        "Content-Type": "application/json",
        "User-Agent": "agentlint-cli/1.0 (+https://agentlint.sh)",
      },
      body: args.body,
      signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `network error: ${msg}` };
  }

  if (res.status === 201) {
    let runUrl = `${parsed.origin}/dashboard`;
    try {
      const data = (await res.json()) as { url?: unknown; id?: unknown };
      if (typeof data.url === "string" && data.url.length > 0) {
        runUrl = data.url.startsWith("http")
          ? data.url
          : `${parsed.origin}${data.url.startsWith("/") ? "" : "/"}${data.url}`;
      }
    } catch {
      // Body wasn't JSON; fall back to the dashboard root.
    }
    return { ok: true, runUrl };
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

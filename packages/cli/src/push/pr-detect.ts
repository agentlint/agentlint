// Detect a pull-request context from CI environment variables.
//
// Used by `--push` to attach PR metadata to the uploaded run; the server
// uses that metadata to post (or update) a comment on the PR.
//
// Pure function: env access goes through an injectable getter so the same
// code path covers GitHub Actions, manual override, and "not in a PR".
//
// Recognized signals (in order):
//   1. AGENTLINT_PR — manual override for any CI vendor or local testing.
//      Value is parsed as an integer; a non-positive integer is rejected.
//   2. GitHub Actions PR event — GITHUB_EVENT_NAME=pull_request[*],
//      GITHUB_REF=refs/pull/<n>/{merge,head}, plus GITHUB_SHA / GITHUB_BASE_REF
//      where present.
//
// Returns null when nothing is detectable. Never throws.

export type GetEnvFn = (name: string) => string | undefined;

export interface PrContext {
  number: number;
  baseSha: string | null;
  headSha: string | null;
}

const GITHUB_REF_PR_RE = /^refs\/pull\/(\d+)\/(?:merge|head)$/;

function envOrNull(getEnv: GetEnvFn, name: string): string | null {
  const v = getEnv(name);
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolve the PR context, or null when no PR signal is present.
 *
 * @param getEnv  Optional environment-variable getter. Defaults to reading
 *                from `process.env`, but tests pass a deterministic map.
 */
export function detectPrContext(
  getEnv: GetEnvFn = (name: string) => process.env[name],
): PrContext | null {
  // --- 1. Manual override ----------------------------------------------
  // AGENTLINT_PR=<n> works for any CI vendor and is also useful for local
  // testing. We still read GITHUB_SHA / GITHUB_BASE_REF if available so the
  // server has the same base/head info as a real PR build.
  const overrideRaw = envOrNull(getEnv, "AGENTLINT_PR");
  if (overrideRaw) {
    const n = Number.parseInt(overrideRaw, 10);
    if (Number.isFinite(n) && n > 0) {
      return {
        number: n,
        baseSha: resolveBaseSha(getEnv),
        headSha: resolveHeadSha(getEnv),
      };
    }
    return null;
  }

  // --- 2. GitHub Actions PR event --------------------------------------
  const eventName = envOrNull(getEnv, "GITHUB_EVENT_NAME");
  const githubRef = envOrNull(getEnv, "GITHUB_REF");
  if (eventName?.startsWith("pull_request") && githubRef) {
    const m = GITHUB_REF_PR_RE.exec(githubRef);
    if (m) {
      const n = Number.parseInt(m[1], 10);
      if (Number.isFinite(n) && n > 0) {
        return {
          number: n,
          baseSha: resolveBaseSha(getEnv),
          headSha: resolveHeadSha(getEnv),
        };
      }
    }
  }

  return null;
}

/**
 * Best-effort base SHA. GitHub Actions exposes the base ref as a ref name
 * (e.g. `main`), not a SHA. We surface what we have without inventing a
 * lookup; the server only uses the value as metadata, not as a guarantee.
 */
function resolveBaseSha(getEnv: GetEnvFn): string | null {
  // No standard env var holds the resolved base SHA on the GHA `pull_request`
  // event. We pass through the base ref name if present so a future server
  // change can resolve it; this matches what's documented in the slice 7 PRD.
  return envOrNull(getEnv, "GITHUB_BASE_REF");
}

function resolveHeadSha(getEnv: GetEnvFn): string | null {
  return envOrNull(getEnv, "GITHUB_SHA");
}

// Token resolver for `agentlint --push` (v2).
//
// v2 is project-scoped: the token is generated against a specific project on
// the agentlint.sh dashboard and lives only in the user's CI secrets or
// shell env. There is no on-disk fallback any more — see CHANGELOG 2.0.0
// and AGENTS.md for the rationale (project tokens are short, rotated, and
// the file-storage flow encouraged committing secrets into dotfiles).
//
// Tokens are expected to be prefixed `agl_proj_` and 61 chars total, but the
// CLI does not enforce that here: the server is the source of truth, and we
// don't want to break legitimate tokens during a server-side prefix change.
//
// Local-first invariant (CHARTER §3): this function never throws, never logs
// the token, and only reads from explicitly opt-in locations.

export const TOKEN_ENV_VAR = "AGENTLINT_TOKEN";

export type GetEnvFn = (name: string) => string | undefined;

export interface ResolveTokenOptions {
  getEnv?: GetEnvFn;
}

/**
 * Resolve the agentlint project token from `AGENTLINT_TOKEN`. Returns null
 * when the env var is missing or whitespace-only.
 *
 * Never throws. The caller decides how to surface "no token" — usually by
 * printing a one-line message that points at `agentlint init`.
 */
export async function resolveToken(
  opts: ResolveTokenOptions = {},
): Promise<string | null> {
  const getEnv = opts.getEnv ?? ((name: string) => process.env[name]);

  const fromEnv = getEnv(TOKEN_ENV_VAR);
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }

  return null;
}

/**
 * Human-readable hint shown when no token is available. Centralized here so
 * the wording stays consistent between `--push` and `init`.
 */
export function missingTokenMessage(): string {
  return `Set ${TOKEN_ENV_VAR} env var. Run \`agentlint init\` to set up.`;
}

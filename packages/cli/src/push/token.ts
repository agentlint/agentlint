// Token resolver for `agentlint --push` (v2).
//
// v2 is project-scoped: the token is generated against a specific project on
// the agentlint.sh dashboard and lives only in the user's CI secrets, shell
// env, or in the file `~/.config/agentlint/token` that `agentlint login`
// writes (mode 0600). Env still wins so CI overrides interactive logins.
//
// Tokens are expected to be prefixed `agl_proj_` and 61 chars total, but the
// CLI does not enforce that here: the server is the source of truth, and we
// don't want to break legitimate tokens during a server-side prefix change.
//
// Local-first invariant (CHARTER §3): this function never throws, never logs
// the token, and only reads from explicitly opt-in locations.

import { readTokenFile as realReadTokenFile } from "../login/token-file.js";

export const TOKEN_ENV_VAR = "AGENTLINT_TOKEN";

export type GetEnvFn = (name: string) => string | undefined;

export type ReadTokenFileFn = () => Promise<string | null>;

export interface ResolveTokenOptions {
  getEnv?: GetEnvFn;
  /** Explicit override (e.g. `--token <value>` from the CLI). */
  flag?: string;
  /** Override the token-file reader for tests. */
  readTokenFile?: ReadTokenFileFn;
}

/**
 * Resolve the agentlint project token. Precedence:
 *   1. `opts.flag` (the `--token` CLI override)
 *   2. `AGENTLINT_TOKEN` env var
 *   3. `~/.config/agentlint/token` (if mode 0600)
 *
 * Returns null when none of those produce a non-empty token. Never throws.
 */
export async function resolveToken(
  opts: ResolveTokenOptions = {},
): Promise<string | null> {
  if (typeof opts.flag === "string" && opts.flag.trim().length > 0) {
    return opts.flag.trim();
  }

  const getEnv = opts.getEnv ?? ((name: string) => process.env[name]);

  const fromEnv = getEnv(TOKEN_ENV_VAR);
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }

  const readFn = opts.readTokenFile ?? (() => realReadTokenFile());
  const fromFile = await readFn();
  if (typeof fromFile === "string" && fromFile.trim().length > 0) {
    return fromFile.trim();
  }

  return null;
}

/**
 * Human-readable hint shown when no token is available. Centralized here so
 * the wording stays consistent between `--push` and `init`.
 */
export function missingTokenMessage(): string {
  return `Set ${TOKEN_ENV_VAR} env var or run \`agentlint login\` to set up.`;
}

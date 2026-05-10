// Token resolver for `agentlint --push`.
//
// Resolution order:
//   1. AGENTLINT_TOKEN env var
//   2. ~/.config/agentlint/token (single line, trimmed)
//
// Returns null if neither is set. Pure-ish: takes its env getter and file
// reader as parameters so tests can drive both branches deterministically.
// Mirrors the dependency-injection style of tools/leaderboard/src/fetch-repos.ts.
//
// Local-first invariant (CHARTER §3): this function never throws, never logs
// the token, and only reads from explicitly opt-in locations.

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export const TOKEN_ENV_VAR = "AGENTLINT_TOKEN";

export type GetEnvFn = (name: string) => string | undefined;
export type ReadFileFn = (path: string) => Promise<string>;

export interface ResolveTokenOptions {
  getEnv?: GetEnvFn;
  readFileFn?: ReadFileFn;
  homeDir?: string;
}

/**
 * Resolve the agentlint API token. Returns null when no token is configured.
 *
 * Never throws. A missing/unreadable token file is treated as "no token",
 * not as a fatal error.
 */
export async function resolveToken(
  opts: ResolveTokenOptions = {},
): Promise<string | null> {
  const getEnv = opts.getEnv ?? ((name: string) => process.env[name]);
  const readFileFn =
    opts.readFileFn ?? ((path: string) => readFile(path, "utf-8"));
  const home = opts.homeDir ?? homedir();

  const fromEnv = getEnv(TOKEN_ENV_VAR);
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }

  const tokenPath = join(home, ".config", "agentlint", "token");
  try {
    const contents = await readFileFn(tokenPath);
    const trimmed = contents.trim();
    if (trimmed.length > 0) return trimmed;
    return null;
  } catch {
    return null;
  }
}

/**
 * Path the token file is read from. Exposed for documentation / error
 * messages; tests don't need it because they inject `homeDir`.
 */
export function tokenFilePath(home: string = homedir()): string {
  return join(home, ".config", "agentlint", "token");
}

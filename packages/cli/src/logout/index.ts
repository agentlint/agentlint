// `agentlint logout` — delete the local token file at `~/.config/agentlint/token`.
//
// Local-first invariant (CHARTER §3): no network call. Idempotent.

import {
  unlinkTokenFile as realUnlinkTokenFile,
  tokenFilePath,
} from "../login/token-file.js";

export type LogFn = (line: string) => void;

export type UnlinkTokenFileFn = () => Promise<boolean>;

export interface LogoutDeps {
  log: LogFn;
  unlinkTokenFile?: UnlinkTokenFileFn;
  home?: string;
}

export type LogoutOutcome =
  | { kind: "removed"; path: string }
  | { kind: "not-found"; path: string };

/**
 * Delete the local token file. Always succeeds (never throws). Returns
 * "removed" when a file was deleted, "not-found" when it wasn't there.
 */
export async function runLogout(deps: LogoutDeps): Promise<LogoutOutcome> {
  const path = tokenFilePath(deps.home);
  const unlink =
    deps.unlinkTokenFile ?? (() => realUnlinkTokenFile({ home: deps.home }));
  const removed = await unlink();
  if (removed) {
    deps.log(`Removed ${path}.`);
    return { kind: "removed", path };
  }
  deps.log(`No token file at ${path}.`);
  return { kind: "not-found", path };
}

// Detect the current repo's GitHub owner/name from `git config`.
//
// Used by `--push` to attach repo metadata to the uploaded run. Returns null
// on any failure — repo detection is a nice-to-have, never required.
// Tested with a mocked exec function so we never shell out in tests.

import { exec } from "node:child_process";

export interface RepoInfo {
  owner: string;
  name: string;
}

export type ExecResult = { stdout: string };

export type ExecFn = (
  command: string,
  options: { cwd: string },
) => Promise<ExecResult>;

const DEFAULT_TIMEOUT_MS = 2_000;

function defaultExecFn(
  command: string,
  options: { cwd: string },
): Promise<ExecResult> {
  return new Promise((resolveFn) => {
    exec(
      command,
      { cwd: options.cwd, timeout: DEFAULT_TIMEOUT_MS, windowsHide: true },
      (err, stdout) => {
        if (err) {
          resolveFn({ stdout: "" });
          return;
        }
        // `exec` with default options yields a string; we accept both for safety.
        // reason: Node typings narrow this to `string | Buffer`, but the runtime
        // shape is well-defined and we just want a UTF-8 string out.
        // biome-ignore lint/suspicious/noExplicitAny: see comment above
        const out = stdout as any;
        const text: string =
          typeof out === "string"
            ? out
            : out && typeof out.toString === "function"
              ? String(out)
              : "";
        resolveFn({ stdout: text });
      },
    );
  });
}

/**
 * Run `git config --get remote.origin.url` in `cwd` and parse the result.
 * Returns null if the command fails, output is empty, or the URL doesn't
 * match a recognized GitHub form.
 */
export async function detectRepo(
  cwd: string,
  execFn: ExecFn = defaultExecFn,
): Promise<RepoInfo | null> {
  let result: ExecResult;
  try {
    result = await execFn("git config --get remote.origin.url", { cwd });
  } catch {
    return null;
  }
  const raw = result.stdout.trim();
  if (raw.length === 0) return null;
  return parseGitUrl(raw);
}

/**
 * Parse a git remote URL into { owner, name }. Handles:
 *   - https://github.com/owner/repo(.git)?
 *   - git@github.com:owner/repo(.git)?
 *   - ssh://git@github.com/owner/repo(.git)?
 *
 * Returns null if the URL doesn't match a known form, or owner/name are
 * missing. Strips a trailing ".git" if present.
 */
export function parseGitUrl(raw: string): RepoInfo | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  // SCP-like form: git@github.com:owner/repo.git
  const scp = /^[\w.-]+@([\w.-]+):([^/\s]+)\/([^/\s]+?)(?:\.git)?$/.exec(
    trimmed,
  );
  if (scp) {
    const owner = scp[2];
    const name = scp[3];
    if (owner && name) return { owner, name };
    return null;
  }

  // URL form: https://, http://, ssh://, git://
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  const segments = url.pathname.split("/").filter((s) => s.length > 0);
  if (segments.length < 2) return null;
  const owner = segments[0];
  const last = segments[1];
  if (!owner || !last) return null;
  const name = last.endsWith(".git") ? last.slice(0, -4) : last;
  if (name.length === 0) return null;
  return { owner, name };
}

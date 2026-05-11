// Read/write the CLI token file at `~/.config/agentlint/token`.
//
// The token file is an opt-in fallback that `agentlint login` populates after
// the device flow completes. The CLI's primary token source is still the
// `AGENTLINT_TOKEN` env var (env wins over file); the file exists so that
// interactive users don't have to export the env var in every shell.
//
// Security:
//   - File is written with mode 0600 (owner read/write only).
//   - On read, if the mode is wider than 0600, we refuse to use the file
//     (return null) and emit a warning. This protects against another local
//     user reading the token off a shared machine.
//   - We never log the token itself.

import {
  chmod,
  mkdir,
  readFile,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const TOKEN_FILE_MODE = 0o600;
export const TOKEN_FILE_DIR_MODE = 0o700;

/**
 * Compute the path to the token file. Uses `os.homedir()` so tests can stub
 * `HOME` rather than the path being hardcoded.
 */
export function tokenFilePath(home: string = homedir()): string {
  return join(home, ".config", "agentlint", "token");
}

export interface ReadTokenFileDeps {
  log?: (line: string) => void;
  home?: string;
}

/**
 * Read the token file. Returns null if the file is missing, empty, or has
 * a mode wider than 0600. Never throws.
 */
export async function readTokenFile(
  deps: ReadTokenFileDeps = {},
): Promise<string | null> {
  const path = tokenFilePath(deps.home);
  let st: Awaited<ReturnType<typeof stat>>;
  try {
    st = await stat(path);
  } catch {
    return null;
  }

  // On Windows, file modes don't map cleanly to POSIX bits — we skip the
  // mode check on win32 because there's no meaningful equivalent.
  if (process.platform !== "win32") {
    const mode = st.mode & 0o777;
    if (mode & 0o077) {
      const warn = deps.log ?? ((_l: string) => {});
      warn(
        `Refusing to read token file ${path} — mode ${mode.toString(8)} is wider than 0600. Run \`chmod 0600 ${path}\` to fix.`,
      );
      return null;
    }
  }

  let contents: string;
  try {
    contents = await readFile(path, "utf-8");
  } catch {
    return null;
  }
  const trimmed = contents.trim();
  if (trimmed.length === 0) return null;
  return trimmed;
}

export interface WriteTokenFileDeps {
  home?: string;
}

/**
 * Write the token to `~/.config/agentlint/token` with mode 0600. Creates
 * the parent directory if necessary. Overwrites any existing file.
 */
export async function writeTokenFile(
  token: string,
  deps: WriteTokenFileDeps = {},
): Promise<void> {
  const path = tokenFilePath(deps.home);
  const dir = dirname(path);
  await mkdir(dir, { recursive: true, mode: TOKEN_FILE_DIR_MODE });
  // writeFile honors the `mode` option only when the file doesn't already
  // exist. Explicitly chmod afterwards to guarantee 0600 on overwrite.
  await writeFile(path, `${token.trim()}\n`, { mode: TOKEN_FILE_MODE });
  await chmod(path, TOKEN_FILE_MODE);
}

/**
 * Delete the token file. Idempotent — missing file is not an error.
 */
export async function unlinkTokenFile(
  deps: WriteTokenFileDeps = {},
): Promise<boolean> {
  const path = tokenFilePath(deps.home);
  try {
    await unlink(path);
    return true;
  } catch {
    return false;
  }
}

// Config-file loader for `.agentlint.json` (v2).
//
// The config is checked into the user's repo and pairs a CI secret token to
// a specific dashboard project. It's deliberately small: the server is the
// source of truth for project metadata; the file only needs to identify
// which project to push to.
//
// Shape (version 1):
//   {
//     "projectId":  "proj_xxxxxxxx",
//     "orgSlug":    "acme",            // human-readable, advisory only
//     "repoOwner":  "acme",
//     "repoName":   "widgets",
//     "prodBranch": "main",
//     "version":    1
//   }
//
// Resolution: walk up from `startDir` looking for `.agentlint.json`. We stop
// at the first match or when we hit the filesystem root. Reads and parsing
// are best-effort — any failure returns `null` so the caller can fall back
// to flags / env without crashing the local audit.
//
// Local-first invariant (CHARTER §3): never throws, never logs the file
// contents, and never traverses past the filesystem root.

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const CONFIG_FILENAME = ".agentlint.json";

export interface AgentlintConfig {
  projectId: string;
  orgSlug: string | null;
  repoOwner: string | null;
  repoName: string | null;
  prodBranch: string;
  version: number;
}

export type ReadFileFn = (path: string) => Promise<string>;
export type ExistsFn = (path: string) => Promise<boolean>;

export interface LoadConfigOptions {
  readFileFn?: ReadFileFn;
  existsFn?: ExistsFn;
  /** Override the filesystem root used as a walk-up stop condition. */
  rootStop?: string;
}

async function defaultReadFile(path: string): Promise<string> {
  return readFile(path, "utf-8");
}

async function defaultExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Walk up from `startDir` looking for `.agentlint.json`. Returns the
 * resolved absolute path of the first match, or null when none is found.
 *
 * Stops at the filesystem root (`dirname(x) === x`) or at `rootStop` if
 * provided. Never throws.
 */
export async function findConfigFile(
  startDir: string,
  opts: LoadConfigOptions = {},
): Promise<string | null> {
  const existsFn = opts.existsFn ?? defaultExists;
  let current = startDir;
  // Cap the walk-up so a pathological symlink or weird mount can't spin us.
  // 64 levels is well past any real repo depth.
  for (let i = 0; i < 64; i += 1) {
    const candidate = join(current, CONFIG_FILENAME);
    if (await existsFn(candidate)) return candidate;
    if (opts.rootStop && current === opts.rootStop) return null;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return null;
}

/**
 * Load and validate `.agentlint.json` starting from `startDir`. Returns null
 * when the file isn't found, isn't valid JSON, or is missing the required
 * `projectId` field.
 */
export async function loadConfig(
  startDir: string,
  opts: LoadConfigOptions = {},
): Promise<AgentlintConfig | null> {
  const readFileFn = opts.readFileFn ?? defaultReadFile;
  const path = await findConfigFile(startDir, opts);
  if (!path) return null;

  let raw: string;
  try {
    raw = await readFileFn(path);
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  return normalizeConfig(parsed);
}

/**
 * Validate the parsed JSON shape into an `AgentlintConfig`. Missing optional
 * fields are normalized to defaults; an absent or non-string `projectId`
 * fails validation by returning null.
 */
export function normalizeConfig(parsed: unknown): AgentlintConfig | null {
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;

  const projectId = typeof obj.projectId === "string" ? obj.projectId : null;
  if (!projectId || projectId.trim().length === 0) return null;

  const orgSlug =
    typeof obj.orgSlug === "string" && obj.orgSlug.length > 0
      ? obj.orgSlug
      : null;
  const repoOwner =
    typeof obj.repoOwner === "string" && obj.repoOwner.length > 0
      ? obj.repoOwner
      : null;
  const repoName =
    typeof obj.repoName === "string" && obj.repoName.length > 0
      ? obj.repoName
      : null;
  const prodBranch =
    typeof obj.prodBranch === "string" && obj.prodBranch.length > 0
      ? obj.prodBranch
      : "main";
  const version =
    typeof obj.version === "number" && Number.isFinite(obj.version)
      ? obj.version
      : 1;

  return {
    projectId,
    orgSlug,
    repoOwner,
    repoName,
    prodBranch,
    version,
  };
}

/**
 * Serialize a config to the canonical on-disk JSON format: 2-space indent +
 * a trailing newline. Centralized so `init` and any future writers agree.
 */
export function stringifyConfig(config: AgentlintConfig): string {
  // Spell out the key order so the on-disk file is stable and reviewable.
  const ordered = {
    projectId: config.projectId,
    orgSlug: config.orgSlug,
    repoOwner: config.repoOwner,
    repoName: config.repoName,
    prodBranch: config.prodBranch,
    version: config.version,
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

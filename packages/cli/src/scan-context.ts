import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ProjectMeta, ScanContext } from "@agentlinthq/core";
import fg from "fast-glob";

export async function createScanContext(args: {
  root: string;
  url?: string;
}): Promise<ScanContext> {
  const root = resolve(args.root);
  const fileCache = new Map<string, string | null>();
  const existsCache = new Map<string, boolean>();
  const globCache = new Map<string, string[]>();

  const ctx: ScanContext = {
    root,
    url: args.url,
    async read(relPath) {
      const cached = fileCache.get(relPath);
      if (cached !== undefined) return cached;
      try {
        const content = await readFile(join(root, relPath), "utf-8");
        fileCache.set(relPath, content);
        return content;
      } catch {
        fileCache.set(relPath, null);
        return null;
      }
    },
    async exists(relPath) {
      const cached = existsCache.get(relPath);
      if (cached !== undefined) return cached;
      try {
        await stat(join(root, relPath));
        existsCache.set(relPath, true);
        return true;
      } catch {
        existsCache.set(relPath, false);
        return false;
      }
    },
    async glob(pattern) {
      const cached = globCache.get(pattern);
      if (cached !== undefined) return cached;
      const results = await fg(pattern, {
        cwd: root,
        dot: true,
        onlyFiles: true,
        followSymbolicLinks: false,
        ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
      });
      globCache.set(pattern, results);
      return results;
    },
    meta: await detectProjectMeta(root),
  };

  return ctx;
}

async function detectProjectMeta(root: string): Promise<ProjectMeta> {
  const has = async (p: string): Promise<boolean> => {
    try {
      await stat(join(root, p));
      return true;
    } catch {
      return false;
    }
  };
  const read = async (p: string): Promise<string | null> => {
    try {
      return await readFile(join(root, p), "utf-8");
    } catch {
      return null;
    }
  };

  // Detect package manager
  let packageManager: ProjectMeta["packageManager"] = "unknown";
  if (await has("bun.lock")) packageManager = "bun";
  else if (await has("bun.lockb")) packageManager = "bun";
  else if (await has("pnpm-lock.yaml")) packageManager = "pnpm";
  else if (await has("yarn.lock")) packageManager = "yarn";
  else if (await has("package-lock.json")) packageManager = "npm";
  else if (await has("uv.lock")) packageManager = "uv";
  else if ((await has("Cargo.lock")) || (await has("Cargo.toml")))
    packageManager = "cargo";
  else if ((await has("go.sum")) || (await has("go.mod")))
    packageManager = "go";
  else if ((await has("pyproject.toml")) || (await has("requirements.txt")))
    packageManager = packageManager === "unknown" ? "pip" : packageManager;
  else if (await has("package.json")) packageManager = "npm";

  // Parse package.json if present
  let manifest: Record<string, unknown> | null = null;
  const pkgRaw = await read("package.json");
  if (pkgRaw) {
    try {
      manifest = JSON.parse(pkgRaw) as Record<string, unknown>;
    } catch {
      manifest = null;
    }
  }

  // Detect monorepo
  let isMonorepo = false;
  let workspaces: string[] = [];
  if (manifest && Array.isArray(manifest.workspaces)) {
    isMonorepo = true;
    workspaces = manifest.workspaces as string[];
  } else if (
    manifest &&
    typeof manifest.workspaces === "object" &&
    manifest.workspaces !== null
  ) {
    const ws = (manifest.workspaces as { packages?: string[] }).packages;
    if (Array.isArray(ws)) {
      isMonorepo = true;
      workspaces = ws;
    }
  }
  if (await has("pnpm-workspace.yaml")) {
    isMonorepo = true;
    if (workspaces.length === 0) workspaces = ["packages/*"]; // common default
  }

  // Detect language
  let language: ProjectMeta["language"] = "unknown";
  const hasTsConfig =
    (await has("tsconfig.json")) || (await has("tsconfig.base.json"));
  const pkgHasTs =
    manifest &&
    ((manifest.devDependencies as Record<string, string> | undefined)
      ?.typescript !== undefined ||
      (manifest.dependencies as Record<string, string> | undefined)
        ?.typescript !== undefined);
  if (hasTsConfig || pkgHasTs) language = "typescript";
  else if (manifest) language = "javascript";
  else if ((await has("pyproject.toml")) || (await has("requirements.txt")))
    language = "python";
  else if (await has("Cargo.toml")) language = "rust";
  else if (await has("go.mod")) language = "go";

  // Detect CI
  const ciFiles: string[] = [];
  if (await has(".github/workflows")) ciFiles.push(".github/workflows");
  if (await has(".gitlab-ci.yml")) ciFiles.push(".gitlab-ci.yml");
  if (await has(".circleci/config.yml")) ciFiles.push(".circleci/config.yml");
  if (await has("azure-pipelines.yml")) ciFiles.push("azure-pipelines.yml");
  if (await has(".travis.yml")) ciFiles.push(".travis.yml");

  return {
    packageManager,
    isMonorepo,
    workspaces,
    language,
    hasCi: ciFiles.length > 0,
    ciFiles,
    manifest,
  };
}

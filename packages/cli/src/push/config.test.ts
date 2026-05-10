import { describe, expect, it } from "vitest";
import {
  CONFIG_FILENAME,
  findConfigFile,
  loadConfig,
  normalizeConfig,
  stringifyConfig,
} from "./config.js";

const VALID_RAW = JSON.stringify({
  projectId: "proj_abc123",
  orgSlug: "acme",
  repoOwner: "acme",
  repoName: "widgets",
  prodBranch: "main",
  version: 1,
});

describe("findConfigFile", () => {
  it("returns the path of the config in the start directory", async () => {
    const path = await findConfigFile("/repo", {
      existsFn: async (p) => p === `/repo/${CONFIG_FILENAME}`,
    });
    expect(path).toBe(`/repo/${CONFIG_FILENAME}`);
  });

  it("walks up to find a config in an ancestor", async () => {
    const path = await findConfigFile("/repo/packages/cli/src", {
      existsFn: async (p) => p === `/repo/${CONFIG_FILENAME}`,
    });
    expect(path).toBe(`/repo/${CONFIG_FILENAME}`);
  });

  it("returns null when no config is found", async () => {
    const path = await findConfigFile("/repo/sub", {
      existsFn: async () => false,
    });
    expect(path).toBeNull();
  });

  it("stops at rootStop when provided", async () => {
    let checked = 0;
    const path = await findConfigFile("/repo/sub", {
      existsFn: async () => {
        checked += 1;
        return false;
      },
      rootStop: "/repo",
    });
    expect(path).toBeNull();
    // /repo/sub and /repo should both be checked, then stop.
    expect(checked).toBe(2);
  });
});

describe("loadConfig", () => {
  it("returns null when no config is found", async () => {
    const cfg = await loadConfig("/nowhere", {
      existsFn: async () => false,
    });
    expect(cfg).toBeNull();
  });

  it("returns null on invalid JSON", async () => {
    const cfg = await loadConfig("/repo", {
      existsFn: async (p) => p === `/repo/${CONFIG_FILENAME}`,
      readFileFn: async () => "{not json",
    });
    expect(cfg).toBeNull();
  });

  it("returns null when projectId is missing", async () => {
    const cfg = await loadConfig("/repo", {
      existsFn: async (p) => p === `/repo/${CONFIG_FILENAME}`,
      readFileFn: async () => JSON.stringify({ orgSlug: "x" }),
    });
    expect(cfg).toBeNull();
  });

  it("returns null when read throws", async () => {
    const cfg = await loadConfig("/repo", {
      existsFn: async (p) => p === `/repo/${CONFIG_FILENAME}`,
      readFileFn: async () => {
        throw new Error("EACCES");
      },
    });
    expect(cfg).toBeNull();
  });

  it("returns the parsed config when valid", async () => {
    const cfg = await loadConfig("/repo", {
      existsFn: async (p) => p === `/repo/${CONFIG_FILENAME}`,
      readFileFn: async () => VALID_RAW,
    });
    expect(cfg).toEqual({
      projectId: "proj_abc123",
      orgSlug: "acme",
      repoOwner: "acme",
      repoName: "widgets",
      prodBranch: "main",
      version: 1,
    });
  });

  it("walks up from a nested cwd to find the root config", async () => {
    const cfg = await loadConfig("/repo/packages/cli", {
      existsFn: async (p) => p === `/repo/${CONFIG_FILENAME}`,
      readFileFn: async () => VALID_RAW,
    });
    expect(cfg?.projectId).toBe("proj_abc123");
  });
});

describe("normalizeConfig", () => {
  it("defaults prodBranch to main when missing", () => {
    const cfg = normalizeConfig({ projectId: "proj_1" });
    expect(cfg?.prodBranch).toBe("main");
  });

  it("defaults version to 1 when missing", () => {
    const cfg = normalizeConfig({ projectId: "proj_1" });
    expect(cfg?.version).toBe(1);
  });

  it("treats empty-string optional fields as null", () => {
    const cfg = normalizeConfig({
      projectId: "proj_1",
      orgSlug: "",
      repoOwner: "",
      repoName: "",
    });
    expect(cfg?.orgSlug).toBeNull();
    expect(cfg?.repoOwner).toBeNull();
    expect(cfg?.repoName).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(normalizeConfig(null)).toBeNull();
    expect(normalizeConfig("string")).toBeNull();
    expect(normalizeConfig(123)).toBeNull();
  });

  it("returns null when projectId is whitespace-only", () => {
    expect(normalizeConfig({ projectId: "   " })).toBeNull();
  });
});

describe("stringifyConfig", () => {
  it("serializes with 2-space indent and trailing newline", () => {
    const out = stringifyConfig({
      projectId: "proj_1",
      orgSlug: "acme",
      repoOwner: "acme",
      repoName: "widgets",
      prodBranch: "main",
      version: 1,
    });
    expect(out.endsWith("\n")).toBe(true);
    expect(out).toContain('  "projectId": "proj_1"');
    expect(out).toContain('  "version": 1');
  });

  it("preserves canonical key order", () => {
    const out = stringifyConfig({
      projectId: "p",
      orgSlug: "o",
      repoOwner: "ro",
      repoName: "rn",
      prodBranch: "main",
      version: 1,
    });
    const keys = Array.from(out.matchAll(/"(\w+)":/g)).map((m) => m[1]);
    expect(keys).toEqual([
      "projectId",
      "orgSlug",
      "repoOwner",
      "repoName",
      "prodBranch",
      "version",
    ]);
  });
});

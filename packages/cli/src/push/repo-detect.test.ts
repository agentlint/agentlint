import { describe, expect, it } from "vitest";
import { detectRepo, type ExecFn, parseGitUrl } from "./repo-detect.js";

describe("parseGitUrl", () => {
  it("parses https GitHub URL with .git suffix", () => {
    expect(parseGitUrl("https://github.com/agentlint/agentlint.git")).toEqual({
      owner: "agentlint",
      name: "agentlint",
    });
  });

  it("parses https GitHub URL without .git suffix", () => {
    expect(parseGitUrl("https://github.com/agentlint/agentlint")).toEqual({
      owner: "agentlint",
      name: "agentlint",
    });
  });

  it("parses SCP-style git@github.com URL", () => {
    expect(parseGitUrl("git@github.com:agentlint/agentlint.git")).toEqual({
      owner: "agentlint",
      name: "agentlint",
    });
  });

  it("parses SCP-style URL without .git suffix", () => {
    expect(parseGitUrl("git@github.com:owner/repo")).toEqual({
      owner: "owner",
      name: "repo",
    });
  });

  it("parses ssh:// URL form", () => {
    expect(parseGitUrl("ssh://git@github.com/owner/repo.git")).toEqual({
      owner: "owner",
      name: "repo",
    });
  });

  it("parses non-github hosts (we still extract owner/name)", () => {
    expect(parseGitUrl("https://gitlab.com/group/project.git")).toEqual({
      owner: "group",
      name: "project",
    });
  });

  it("returns null for empty string", () => {
    expect(parseGitUrl("")).toBeNull();
    expect(parseGitUrl("   ")).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(parseGitUrl("not a url")).toBeNull();
    expect(parseGitUrl("https://github.com/onlyowner")).toBeNull();
    expect(parseGitUrl("git@github.com:onlyowner")).toBeNull();
  });

  it("trims surrounding whitespace and newlines", () => {
    expect(parseGitUrl("  https://github.com/o/r.git\n")).toEqual({
      owner: "o",
      name: "r",
    });
  });
});

describe("detectRepo", () => {
  it("invokes git config in the given cwd", async () => {
    let observedCommand: string | null = null;
    let observedCwd: string | null = null;
    const execFn: ExecFn = async (command, options) => {
      observedCommand = command;
      observedCwd = options.cwd;
      return { stdout: "https://github.com/owner/repo.git\n" };
    };
    const repo = await detectRepo("/tmp/proj", execFn);
    expect(repo).toEqual({ owner: "owner", name: "repo" });
    expect(observedCommand).toBe("git config --get remote.origin.url");
    expect(observedCwd).toBe("/tmp/proj");
  });

  it("returns null when stdout is empty (no remote)", async () => {
    const execFn: ExecFn = async () => ({ stdout: "" });
    const repo = await detectRepo("/tmp/proj", execFn);
    expect(repo).toBeNull();
  });

  it("returns null when execFn rejects", async () => {
    const execFn: ExecFn = async () => {
      throw new Error("not a git repo");
    };
    const repo = await detectRepo("/tmp/proj", execFn);
    expect(repo).toBeNull();
  });

  it("returns null when output is malformed", async () => {
    const execFn: ExecFn = async () => ({ stdout: "garbage://??\n" });
    const repo = await detectRepo("/tmp/proj", execFn);
    expect(repo).toBeNull();
  });

  it("parses SCP-form output from git config", async () => {
    const execFn: ExecFn = async () => ({
      stdout: "git@github.com:agentlint/agentlint.git\n",
    });
    const repo = await detectRepo("/tmp/proj", execFn);
    expect(repo).toEqual({ owner: "agentlint", name: "agentlint" });
  });
});

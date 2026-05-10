import { describe, expect, it } from "vitest";
import {
  type ExecFn,
  parseAgentlintReport,
  scanRepo,
} from "./clone-and-scan.js";

describe("parseAgentlintReport", () => {
  it("returns score, counts, results from a JSON report", () => {
    const json = JSON.stringify({
      version: "1.0.0",
      score: 87,
      results: [
        { ruleId: "a", status: "pass", points: 5 },
        { ruleId: "b", status: "fail", points: 0 },
      ],
    });
    const out = parseAgentlintReport(json);
    expect(out.score).toBe(87);
    expect(out.results).toHaveLength(2);
    expect(out.passes).toBe(1);
    expect(out.fails).toBe(1);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseAgentlintReport("not json")).toThrow();
  });

  it("throws when required fields are missing", () => {
    expect(() => parseAgentlintReport(JSON.stringify({}))).toThrow(/score/);
  });
});

describe("scanRepo", () => {
  it("clones the repo, runs the CLI, parses the JSON, returns a successful report", async () => {
    const calls: string[][] = [];
    const exec: ExecFn = async (cmd, args) => {
      calls.push([cmd, ...args]);
      if (cmd === "git") return { stdout: "", stderr: "" };
      if (cmd.endsWith("agentlint") || cmd.includes("cli")) {
        return {
          stdout: JSON.stringify({
            version: "1.0.0",
            score: 91,
            results: [
              { ruleId: "x", status: "pass", points: 5 },
              { ruleId: "y", status: "skip", points: 0 },
            ],
          }),
          stderr: "",
        };
      }
      return { stdout: "", stderr: "" };
    };
    const result = await scanRepo({
      owner: "vercel",
      repo: "next.js",
      defaultBranch: "canary",
      cliPath: "/path/to/agentlint",
      workDir: "/tmp/lb",
      execFn: exec,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.score).toBe(91);
      expect(result.passes).toBe(1);
    }
    const cmds = calls.map((c) => c[0]);
    expect(cmds).toContain("git");
    expect(cmds.some((c) => c.includes("agentlint") || c.includes("cli"))).toBe(true);
  });

  it("returns ok:false when git clone fails", async () => {
    const exec: ExecFn = async (cmd) => {
      if (cmd === "git") {
        const err = new Error("not found") as Error & { code?: number };
        err.code = 128;
        throw err;
      }
      return { stdout: "", stderr: "" };
    };
    const result = await scanRepo({
      owner: "ghost",
      repo: "missing",
      defaultBranch: "main",
      cliPath: "/path/to/agentlint",
      workDir: "/tmp/lb",
      execFn: exec,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/clone/);
    }
  });

  it("returns ok:false when the CLI returns invalid JSON", async () => {
    const exec: ExecFn = async (cmd) => {
      if (cmd === "git") return { stdout: "", stderr: "" };
      return { stdout: "<<not json>>", stderr: "" };
    };
    const result = await scanRepo({
      owner: "owner",
      repo: "r",
      defaultBranch: "main",
      cliPath: "/path/to/agentlint",
      workDir: "/tmp/lb",
      execFn: exec,
    });
    expect(result.ok).toBe(false);
  });
});

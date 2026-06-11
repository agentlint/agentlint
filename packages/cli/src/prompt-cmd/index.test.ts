import type { Report } from "@agentlinthq/core";
import { describe, expect, it } from "vitest";
import { runPromptCmd } from "./index.js";

const makeReport = (withFail: boolean): Report => ({
  version: "2.2.0",
  scannedAt: "2026-06-11T00:00:00.000Z",
  root: "/repo",
  results: withFail
    ? [
        {
          ruleId: "agents-md-exists",
          status: "fail",
          points: 0,
          message: "AGENTS.md not found.",
          fix: { summary: "create it", prompt: "Create an AGENTS.md file." },
        },
      ]
    : [
        {
          ruleId: "agents-md-exists",
          status: "pass",
          points: 10,
          message: "present",
        },
      ],
  byCategory: [],
  rawScore: { earned: 0, possible: 100 },
  score: withFail ? 40 : 100,
});

function deps(report: Report) {
  const out: string[] = [];
  const logs: string[] = [];
  return {
    out,
    logs,
    deps: {
      scan: async () => report,
      write: (s: string) => {
        out.push(s);
      },
      log: (s: string) => {
        logs.push(s);
      },
    },
  };
}

describe("runPromptCmd", () => {
  it("prints the consolidated prompt and reports success", async () => {
    const { out, deps: d } = deps(makeReport(true));
    const outcome = await runPromptCmd({ path: "/repo" }, d);
    expect(outcome.kind).toBe("printed");
    expect(out.join("")).toContain("Fix agentlint findings");
    expect(out.join("")).toContain("agents-md-exists");
  });

  it("reports nothing-to-fix on a clean repo", async () => {
    const { out, deps: d } = deps(makeReport(false));
    const outcome = await runPromptCmd({ path: "/repo" }, d);
    expect(outcome.kind).toBe("nothing-to-fix");
    expect(out).toHaveLength(0);
  });

  it("rejects unknown rule ids before scanning", async () => {
    const { deps: d } = deps(makeReport(true));
    const outcome = await runPromptCmd(
      { path: "/repo", rules: ["bogus-rule"] },
      d,
    );
    expect(outcome).toEqual({ kind: "unknown-rules", unknown: ["bogus-rule"] });
  });

  it("filters to the requested known rules", async () => {
    const { out, deps: d } = deps(makeReport(true));
    const outcome = await runPromptCmd(
      { path: "/repo", rules: ["agents-md-exists"] },
      d,
    );
    expect(outcome.kind).toBe("printed");
    expect(out.join("")).toContain("agents-md-exists");
  });
});

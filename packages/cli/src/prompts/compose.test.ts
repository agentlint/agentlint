import type { ProjectMeta, Report, Result } from "@agentlinthq/core";
import { describe, expect, it } from "vitest";
import {
  attachPrompts,
  composeFixPrompt,
  composeRulePrompts,
} from "./compose.js";

const meta: ProjectMeta = {
  packageManager: "pnpm",
  isMonorepo: false,
  workspaces: [],
  language: "typescript",
  hasCi: false,
  ciFiles: [],
  manifest: null,
};

const result = (over: Partial<Result> & { ruleId: string }): Result => ({
  status: "fail",
  points: 0,
  message: "msg",
  ...over,
});

const report = (results: Result[], score = 50): Report => ({
  version: "2.2.0",
  scannedAt: "2026-06-11T00:00:00.000Z",
  root: "/repo",
  results,
  byCategory: [],
  rawScore: { earned: 0, possible: 100 },
  score,
});

describe("attachPrompts", () => {
  it("attaches a prompt to fail results", () => {
    const input = [
      result({ ruleId: "agents-md-exists", fix: { summary: "s" } }),
    ];
    const out = attachPrompts(input, meta);
    expect(out[0].fix?.prompt).toContain("AGENTS.md");
  });

  it("creates a fix envelope when a fail result has none", () => {
    const input = [result({ ruleId: "editorconfig" })];
    const out = attachPrompts(input, meta);
    expect(out[0].fix?.summary).toBe("msg");
    expect(out[0].fix?.prompt).toContain(".editorconfig");
  });

  it("attaches to warns only when the rule provided a fix", () => {
    const actionable = result({
      ruleId: "agents-md-size",
      status: "warn",
      points: 1,
      message: "AGENTS.md is 300 lines — too long; noise.",
      fix: { summary: "trim" },
    });
    const informational = result({
      ruleId: "agents-md-off-limits",
      status: "warn",
      points: 2,
    });
    const out = attachPrompts([actionable, informational], meta);
    expect(out[0].fix?.prompt).toContain("250 lines");
    expect(out[1].fix?.prompt).toBeUndefined();
  });

  it("leaves pass and skip results untouched", () => {
    const passing = result({
      ruleId: "agents-md-exists",
      status: "pass",
      points: 10,
    });
    const skipped = result({
      ruleId: "llms-txt-present",
      status: "skip",
      points: null,
    });
    const out = attachPrompts([passing, skipped], meta);
    expect(out[0].fix).toBeUndefined();
    expect(out[1].fix).toBeUndefined();
  });

  it("does not mutate the input results", () => {
    const input = [
      result({ ruleId: "agents-md-exists", fix: { summary: "s" } }),
    ];
    const snapshot = JSON.parse(JSON.stringify(input));
    attachPrompts(input, meta);
    expect(input).toEqual(snapshot);
  });
});

describe("composeFixPrompt", () => {
  it("returns null when nothing is actionable", () => {
    const r = report([
      result({ ruleId: "agents-md-exists", status: "pass", points: 10 }),
    ]);
    expect(composeFixPrompt(r)).toBeNull();
  });

  it("orders fails before warns and by rule weight descending", () => {
    const results = attachPrompts(
      [
        result({
          ruleId: "editorconfig", // weight 2, fail
        }),
        result({
          ruleId: "agents-md-size", // warn with fix
          status: "warn",
          points: 1,
          fix: { summary: "trim" },
        }),
        result({
          ruleId: "agents-md-exists", // weight 10, fail
        }),
      ],
      meta,
    );
    const prompt = composeFixPrompt(report(results));
    expect(prompt).not.toBeNull();
    const p = prompt as string;
    const posAgents = p.indexOf("agents-md-exists");
    const posEditor = p.indexOf("editorconfig");
    const posSize = p.indexOf("agents-md-size");
    expect(posAgents).toBeGreaterThan(-1);
    expect(posAgents).toBeLessThan(posEditor);
    expect(posEditor).toBeLessThan(posSize);
  });

  it("includes score, ground rules, and verification footer", () => {
    const results = attachPrompts([result({ ruleId: "editorconfig" })], meta);
    const p = composeFixPrompt(report(results, 73)) as string;
    expect(p).toContain("73/100");
    expect(p).toContain("Ground rules");
    expect(p).toContain("npx @agentlinthq/cli@latest");
  });

  it("filters to the requested rule ids", () => {
    const results = attachPrompts(
      [
        result({ ruleId: "editorconfig" }),
        result({ ruleId: "agents-md-exists" }),
      ],
      meta,
    );
    const p = composeFixPrompt(report(results), ["editorconfig"]) as string;
    expect(p).toContain("editorconfig");
    expect(p).not.toContain("agents-md-exists");
  });
});

describe("composeRulePrompts (single-rule output)", () => {
  it("returns per-rule prompts with verification line", () => {
    const results = attachPrompts([result({ ruleId: "editorconfig" })], meta);
    const out = composeRulePrompts(report(results), ["editorconfig"]);
    expect(out).toHaveLength(1);
    expect(out[0].ruleId).toBe("editorconfig");
    expect(out[0].prompt).toContain(".editorconfig");
  });

  it("reports unknown rule ids", () => {
    const out = composeRulePrompts(report([]), ["no-such-rule"]);
    expect(out).toHaveLength(0);
  });
});

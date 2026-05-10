import { beforeEach, describe, expect, it } from "vitest";
import { buildReport, type Result, registerRuleCategory } from "./index.js";

describe("buildReport", () => {
  beforeEach(() => {
    // Register a small synthetic ruleset
    registerRuleCategory("d1", "discoverability");
    registerRuleCategory("d2", "discoverability");
    registerRuleCategory("b1", "buildability");
    registerRuleCategory("doc1", "documentation");
  });

  it("computes score correctly when all categories are scored", () => {
    const results: Result[] = [
      { ruleId: "d1", status: "pass", points: 10, message: "" },
      { ruleId: "d2", status: "pass", points: 15, message: "" },
      { ruleId: "b1", status: "pass", points: 25, message: "" },
      { ruleId: "doc1", status: "pass", points: 15, message: "" },
    ];
    const r = buildReport({
      version: "1.0.0",
      root: "/x",
      results,
    });
    // earned 65, possible 65 (disc 25 + build 25 + doc 15)
    expect(r.rawScore).toEqual({ earned: 65, possible: 65 });
    expect(r.score).toBe(100);
  });

  it("excludes skipped categories from the denominator", () => {
    const results: Result[] = [
      { ruleId: "d1", status: "pass", points: 10, message: "" },
      { ruleId: "d2", status: "pass", points: 15, message: "" },
      { ruleId: "b1", status: "pass", points: 25, message: "" },
      { ruleId: "doc1", status: "skip", points: null, message: "no --url" },
    ];
    const r = buildReport({
      version: "1.0.0",
      root: "/x",
      results,
    });
    expect(r.rawScore).toEqual({ earned: 50, possible: 50 });
    expect(r.score).toBe(100);
  });

  it("partial scores normalize correctly", () => {
    const results: Result[] = [
      { ruleId: "d1", status: "pass", points: 10, message: "" },
      { ruleId: "d2", status: "fail", points: 0, message: "" },
      { ruleId: "b1", status: "pass", points: 25, message: "" },
      { ruleId: "doc1", status: "skip", points: null, message: "" },
    ];
    const r = buildReport({ version: "1.0.0", root: "/x", results });
    // earned 35 / possible 50 = 70
    expect(r.score).toBe(70);
  });
});

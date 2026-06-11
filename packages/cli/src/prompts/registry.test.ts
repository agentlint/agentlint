import type { ProjectMeta, Result } from "@agentlinthq/core";
import { describe, expect, it } from "vitest";
import { allRules } from "../rules/index.js";
import { buildRulePrompt, promptRegistry } from "./registry.js";

const baseMeta: ProjectMeta = {
  packageManager: "pnpm",
  isMonorepo: false,
  workspaces: [],
  language: "typescript",
  hasCi: false,
  ciFiles: [],
  manifest: null,
};

const failResult = (ruleId: string, message = "finding message"): Result => ({
  ruleId,
  status: "fail",
  points: 0,
  message,
});

describe("promptRegistry completeness", () => {
  it("has a prompt builder for every registered rule", () => {
    for (const rule of allRules) {
      expect(
        promptRegistry[rule.meta.id],
        `missing prompt for rule ${rule.meta.id}`,
      ).toBeTypeOf("function");
    }
  });

  it("has no orphan prompts for rules that don't exist", () => {
    const ruleIds = new Set(allRules.map((r) => r.meta.id));
    for (const id of Object.keys(promptRegistry)) {
      expect(ruleIds.has(id), `orphan prompt: ${id}`).toBe(true);
    }
  });

  it("every prompt renders a non-trivial string for a fail result", () => {
    for (const rule of allRules) {
      const prompt = buildRulePrompt(failResult(rule.meta.id), baseMeta);
      expect(prompt, rule.meta.id).toBeTypeOf("string");
      expect((prompt as string).length, rule.meta.id).toBeGreaterThan(80);
      // No unresolved template artifacts.
      expect(prompt, rule.meta.id).not.toContain("undefined");
      expect(prompt, rule.meta.id).not.toContain("[object Object]");
    }
  });
});

describe("buildRulePrompt", () => {
  it("returns null for unknown rule ids", () => {
    expect(buildRulePrompt(failResult("no-such-rule"), baseMeta)).toBeNull();
  });

  it("uses the detected package manager in command examples", () => {
    const prompt = buildRulePrompt(failResult("build-cmd-documented"), {
      ...baseMeta,
      packageManager: "pnpm",
    });
    expect(prompt).toContain("pnpm run build");

    const npmPrompt = buildRulePrompt(failResult("build-cmd-documented"), {
      ...baseMeta,
      packageManager: "npm",
    });
    expect(npmPrompt).toContain("npm run build");
  });

  it("adapts to non-JS toolchains", () => {
    const prompt = buildRulePrompt(failResult("build-cmd-documented"), {
      ...baseMeta,
      packageManager: "cargo",
      language: "rust",
    });
    expect(prompt).toContain("cargo build");
    expect(prompt).toContain("Cargo.toml");
  });

  it("interpolates the finding message where relevant", () => {
    const prompt = buildRulePrompt(
      failResult("agents-md-sections", "AGENTS.md is missing sections: test."),
      baseMeta,
    );
    expect(prompt).toContain("AGENTS.md is missing sections: test.");
  });

  it("branches the env prompt on committed vs missing", () => {
    const committed = buildRulePrompt(
      failResult("env-example-no-env", ".env file is committed — exposed."),
      baseMeta,
    );
    expect(committed).toContain("git rm --cached");
    expect(committed).toContain("rotate");

    const missing = buildRulePrompt(
      failResult("env-example-no-env", "No .env.example present."),
      baseMeta,
    );
    expect(missing).toContain(".env.example");
    expect(missing).not.toContain("git rm --cached");
  });

  it("lists workspaces in the monorepo prompt", () => {
    const prompt = buildRulePrompt(failResult("monorepo-sub-agents-md"), {
      ...baseMeta,
      isMonorepo: true,
      workspaces: ["packages/core", "packages/cli"],
    });
    expect(prompt).toContain("packages/core");
    expect(prompt).toContain("packages/cli");
  });

  it("never tells the agent to pick a license itself", () => {
    const prompt = buildRulePrompt(failResult("license-declared"), baseMeta);
    expect(prompt).toContain("do NOT choose one yourself");
  });
});

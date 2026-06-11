import type { Report } from "@agentlinthq/core";
import { describe, expect, it } from "vitest";
import { renderHtml } from "./html.js";
import { renderJson } from "./json.js";
import { renderMarkdown } from "./markdown.js";
import { renderTerminal } from "./terminal.js";

const report: Report = {
  version: "2.2.0",
  scannedAt: "2026-06-11T00:00:00.000Z",
  root: "/repo",
  results: [
    {
      ruleId: "agents-md-exists",
      status: "fail",
      points: 0,
      message: "AGENTS.md not found.",
      fix: {
        summary: "Create AGENTS.md at the repo root.",
        docsUrl: "https://agents.md/",
        prompt: "Create an AGENTS.md file at the repository root <esc>.",
      },
    },
    {
      ruleId: "editorconfig",
      status: "pass",
      points: 2,
      message: ".editorconfig present.",
    },
  ],
  byCategory: [
    { category: "discoverability", earned: 0, possible: 25 },
    { category: "buildability", earned: 0, possible: 0 },
    { category: "conventions", earned: 2, possible: 20 },
    { category: "documentation", earned: 0, possible: 0 },
    { category: "safety", earned: 0, possible: 0 },
  ],
  rawScore: { earned: 2, possible: 45 },
  score: 4,
};

describe("markdown reporter", () => {
  it("includes the per-failure fix prompt in a fenced block", () => {
    const md = renderMarkdown(report);
    expect(md).toContain("Prompt for an AI agent");
    expect(md).toContain("Create an AGENTS.md file at the repository root");
  });
});

describe("html reporter", () => {
  it("renders the prompt in a <details> block, HTML-escaped, no scripts", () => {
    const html = renderHtml(report);
    expect(html).toContain("<details");
    expect(html).toContain("&lt;esc&gt;");
    expect(html).not.toContain("<script");
  });
});

describe("json reporter", () => {
  it("carries fix.prompt through serialization", () => {
    const parsed = JSON.parse(renderJson(report));
    expect(parsed.results[0].fix.prompt).toContain("AGENTS.md");
  });
});

describe("terminal reporter", () => {
  it("hints at the prompt subcommand when there are findings", () => {
    expect(renderTerminal(report)).toContain("agentlint prompt");
  });

  it("does not hint when everything passes", () => {
    const clean: Report = {
      ...report,
      results: [report.results[1]],
      score: 100,
    };
    expect(renderTerminal(clean)).not.toContain("agentlint prompt");
  });
});

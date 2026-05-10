import type { Rule } from "@agentlinthq/core";
import {
  fail,
  findAgentsMd,
  hasSection,
  pass,
  skip,
  warn,
} from "./_helpers.js";

export const agentsMdExists: Rule = {
  meta: {
    id: "agents-md-exists",
    category: "discoverability",
    weight: 10,
    fixable: true,
    description: "AGENTS.md exists at the repo root.",
  },
  async check(ctx) {
    const found = await findAgentsMd(ctx);
    if (!found) {
      return fail(
        "agents-md-exists",
        "AGENTS.md not found. AI coding agents read this file as their primary source of project context.",
        {
          summary:
            "Create AGENTS.md at the repo root with build/test commands, conventions, and gotchas.",
          docsUrl: "https://agents.md/",
        },
      );
    }
    if (found.name !== "AGENTS.md") {
      return warn(
        "agents-md-exists",
        7,
        `Found ${found.name}, but the canonical filename is AGENTS.md (case-sensitive on Linux/CI).`,
        {
          summary: `Rename ${found.name} → AGENTS.md.`,
          docsUrl: "https://agents.md/",
        },
      );
    }
    return pass("agents-md-exists", 10, "AGENTS.md present at repo root.");
  },
};

export const agentsMdSize: Rule = {
  meta: {
    id: "agents-md-size",
    category: "discoverability",
    weight: 2,
    fixable: false,
    description: "AGENTS.md is 30–250 lines (concise, not bloated).",
  },
  async check(ctx) {
    const found = await findAgentsMd(ctx);
    if (!found) return skip("agents-md-size", "No AGENTS.md to measure.");
    const lines = found.content.split("\n").length;
    if (lines < 30) {
      return warn(
        "agents-md-size",
        1,
        `AGENTS.md is only ${lines} lines — likely too thin to be useful.`,
        {
          summary:
            "Expand AGENTS.md to cover build, test, conventions, and gotchas.",
        },
      );
    }
    if (lines > 250) {
      return warn(
        "agents-md-size",
        1,
        `AGENTS.md is ${lines} lines — too long; agents lose signal in noise.`,
        { summary: "Trim or split into per-folder AGENTS.md files." },
      );
    }
    return pass(
      "agents-md-size",
      2,
      `AGENTS.md is ${lines} lines — within the 30–250 sweet spot.`,
    );
  },
};

export const agentsMdSections: Rule = {
  meta: {
    id: "agents-md-sections",
    category: "discoverability",
    weight: 5,
    fixable: true,
    description:
      "AGENTS.md covers build, test, conventions, and gotchas sections.",
  },
  async check(ctx) {
    const found = await findAgentsMd(ctx);
    if (!found) return skip("agents-md-sections", "No AGENTS.md to inspect.");
    const required = [
      { key: "build", label: "build" },
      { key: "test", label: "test" },
      { key: "convention|style|naming", label: "conventions" },
      { key: "gotcha|off-limits|do not|warning", label: "gotchas/off-limits" },
    ];
    const missing: string[] = [];
    for (const r of required) {
      if (!hasSection(found.content, r.key)) missing.push(r.label);
    }
    if (missing.length === 0) {
      return pass(
        "agents-md-sections",
        5,
        "AGENTS.md covers build, test, conventions, and gotchas.",
      );
    }
    const points = Math.max(0, 5 - missing.length * 2);
    return missing.length === 4
      ? fail(
          "agents-md-sections",
          `AGENTS.md is missing all key sections (${missing.join(", ")}).`,
          {
            summary:
              "Add ## Build, ## Test, ## Conventions, and ## Off-limits sections.",
          },
        )
      : warn(
          "agents-md-sections",
          points,
          `AGENTS.md is missing sections: ${missing.join(", ")}.`,
          { summary: `Add the missing sections: ${missing.join(", ")}.` },
        );
  },
};

export const readmeLinksAgentsMd: Rule = {
  meta: {
    id: "readme-links-agents-md",
    category: "discoverability",
    weight: 2,
    fixable: true,
    description: "README links to AGENTS.md.",
  },
  async check(ctx) {
    const readme =
      (await ctx.read("README.md")) ??
      (await ctx.read("readme.md")) ??
      (await ctx.read("Readme.md"));
    if (!readme) return skip("readme-links-agents-md", "No README found.");
    if (/AGENTS\.md/i.test(readme)) {
      return pass("readme-links-agents-md", 2, "README links to AGENTS.md.");
    }
    return fail(
      "readme-links-agents-md",
      "README does not reference AGENTS.md.",
      {
        summary:
          "Add a 'For AI agents' section to README pointing at AGENTS.md.",
      },
    );
  },
};

export const toolShimsPresent: Rule = {
  meta: {
    id: "tool-shims-present",
    category: "discoverability",
    weight: 4,
    fixable: true,
    description:
      "CLAUDE.md, .cursor/rules, and copilot-instructions.md exist (as symlinks or imports of AGENTS.md).",
  },
  async check(ctx) {
    const checks = [
      { name: "CLAUDE.md", weight: 1.5 },
      { name: ".cursor/rules/main.md", weight: 1 },
      { name: ".cursorrules", weight: 1, alt: true },
      { name: ".github/copilot-instructions.md", weight: 1.5 },
    ];
    let earned = 0;
    const found: string[] = [];
    const missing: string[] = [];
    let hasCursor = false;
    for (const c of checks) {
      const ok = await ctx.exists(c.name);
      if (ok) {
        if (c.alt && hasCursor) continue; // don't double-count cursor variants
        if (c.name.includes(".cursor")) hasCursor = true;
        earned += c.weight;
        found.push(c.name);
      } else if (!c.alt) {
        missing.push(c.name);
      }
    }
    earned = Math.min(4, Math.round(earned));
    if (earned === 4) {
      return pass(
        "tool-shims-present",
        4,
        `Tool shims present: ${found.join(", ")}.`,
      );
    }
    if (earned === 0) {
      return fail(
        "tool-shims-present",
        "No tool-specific shims found. Claude Code, Cursor, and Copilot won't see your AGENTS.md content.",
        {
          summary:
            "Add CLAUDE.md, .cursor/rules/main.md, and .github/copilot-instructions.md (each can simply import AGENTS.md).",
        },
      );
    }
    return warn(
      "tool-shims-present",
      earned,
      `Some shims missing: ${missing.join(", ")}.`,
      { summary: `Add: ${missing.join(", ")}.` },
    );
  },
};

export const monorepoSubAgentsMd: Rule = {
  meta: {
    id: "monorepo-sub-agents-md",
    category: "discoverability",
    weight: 2,
    fixable: false,
    description:
      "In monorepos, sub-package AGENTS.md files exist for each workspace.",
  },
  async check(ctx) {
    if (!ctx.meta.isMonorepo) {
      return skip("monorepo-sub-agents-md", "Not a monorepo.");
    }
    const subs = await ctx.glob("packages/*/AGENTS.md");
    const subsAlt = await ctx.glob("apps/*/AGENTS.md");
    const total = subs.length + subsAlt.length;
    if (total >= 1) {
      return pass(
        "monorepo-sub-agents-md",
        2,
        `${total} sub-package AGENTS.md file(s) detected.`,
      );
    }
    return fail(
      "monorepo-sub-agents-md",
      "Monorepo detected but no sub-package AGENTS.md files. Each workspace should have its own.",
      {
        summary:
          "Add packages/<name>/AGENTS.md per workspace with package-specific instructions.",
      },
    );
  },
};

export const discoverabilityRules: Rule[] = [
  agentsMdExists,
  agentsMdSize,
  agentsMdSections,
  readmeLinksAgentsMd,
  toolShimsPresent,
  monorepoSubAgentsMd,
];

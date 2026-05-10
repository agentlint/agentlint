import type { Rule } from "@agentlinthq/core";
import { fail, findAgentsMd, hasSection, pass, warn } from "./_helpers.js";

export const agentsMdOffLimits: Rule = {
  meta: {
    id: "agents-md-off-limits",
    category: "safety",
    weight: 3,
    fixable: true,
    description:
      "AGENTS.md has an off-limits / do-not-modify section if relevant.",
  },
  async check(ctx) {
    const a = await findAgentsMd(ctx);
    if (!a)
      return fail(
        "agents-md-off-limits",
        "No AGENTS.md, so off-limits paths cannot be declared.",
        { summary: "Add AGENTS.md with an Off-limits section." },
      );
    if (
      hasSection(a.content, "off.limits") ||
      hasSection(a.content, "do not modify") ||
      hasSection(a.content, "do not edit") ||
      /\b(generated|vendor|migration)/i.test(a.content)
    ) {
      return pass("agents-md-off-limits", 3, "Off-limits paths declared.");
    }
    // Check if the project actually has files that would need protection
    const generated = await ctx.glob("**/_generated/**");
    const vendored = await ctx.glob("vendor/**");
    if (generated.length === 0 && vendored.length === 0) {
      return warn(
        "agents-md-off-limits",
        2,
        "No off-limits section, but project does not appear to need one.",
      );
    }
    return fail(
      "agents-md-off-limits",
      "Project has generated or vendored files but AGENTS.md does not declare them off-limits.",
      {
        summary: "Add an Off-limits section listing generated/vendored paths.",
      },
    );
  },
};

export const preCommitHooks: Rule = {
  meta: {
    id: "pre-commit-hooks",
    category: "safety",
    weight: 3,
    fixable: true,
    description: "Pre-commit hooks are configured.",
  },
  async check(ctx) {
    if (await ctx.exists(".husky/pre-commit"))
      return pass("pre-commit-hooks", 3, "husky pre-commit hook configured.");
    if (await ctx.exists("lefthook.yml"))
      return pass("pre-commit-hooks", 3, "lefthook configured.");
    if (await ctx.exists(".pre-commit-config.yaml"))
      return pass("pre-commit-hooks", 3, "pre-commit framework configured.");
    if (await ctx.exists(".githooks"))
      return pass("pre-commit-hooks", 3, ".githooks directory configured.");
    const m = ctx.meta.manifest;
    if (m?.["lint-staged"])
      return pass("pre-commit-hooks", 3, "lint-staged configured.");
    return fail("pre-commit-hooks", "No pre-commit hooks configured.", {
      summary:
        "Add husky + lint-staged (or lefthook, or pre-commit) to catch issues before they're committed.",
    });
  },
};

export const envExampleNoEnv: Rule = {
  meta: {
    id: "env-example-no-env",
    category: "safety",
    weight: 3,
    fixable: true,
    description: ".env.example exists; no .env or .env.local committed.",
  },
  async check(ctx) {
    const hasExample =
      (await ctx.exists(".env.example")) ||
      (await ctx.exists(".env.sample")) ||
      (await ctx.exists(".env.template"));
    const hasReal =
      (await ctx.exists(".env")) ||
      (await ctx.exists(".env.local")) ||
      (await ctx.exists(".env.production"));
    if (hasReal)
      return fail(
        "env-example-no-env",
        ".env file is committed — credentials may be exposed.",
        { summary: "Remove .env from the repo and add it to .gitignore." },
      );
    if (hasExample)
      return pass(
        "env-example-no-env",
        3,
        ".env.example present, no .env committed.",
      );
    // If no env files at all, project may not need them; partial credit
    return warn("env-example-no-env", 2, "No .env.example present.", {
      summary:
        "If your project uses env vars, commit a .env.example so agents know which vars to set.",
    });
  },
};

export const prTemplate: Rule = {
  meta: {
    id: "pr-template",
    category: "safety",
    weight: 2,
    fixable: true,
    description: "A PR template exists.",
  },
  async check(ctx) {
    const candidates = [
      ".github/PULL_REQUEST_TEMPLATE.md",
      ".github/pull_request_template.md",
      "PULL_REQUEST_TEMPLATE.md",
      "docs/pull_request_template.md",
    ];
    for (const c of candidates) {
      if (await ctx.exists(c))
        return pass("pr-template", 2, `PR template at ${c}.`);
    }
    return fail("pr-template", "No PR template found.", {
      summary:
        "Add .github/PULL_REQUEST_TEMPLATE.md with a checklist for reviewers.",
    });
  },
};

export const codeowners: Rule = {
  meta: {
    id: "codeowners",
    category: "safety",
    weight: 2,
    fixable: true,
    description: "A CODEOWNERS file exists.",
  },
  async check(ctx) {
    const candidates = ["CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS"];
    for (const c of candidates) {
      if (await ctx.exists(c))
        return pass("codeowners", 2, `CODEOWNERS at ${c}.`);
    }
    return fail("codeowners", "No CODEOWNERS file found.", {
      summary:
        "Add .github/CODEOWNERS so sensitive paths require designated reviewers.",
    });
  },
};

export const licenseDeclared: Rule = {
  meta: {
    id: "license-declared",
    category: "safety",
    weight: 2,
    fixable: true,
    description: "A LICENSE file exists at the repo root.",
  },
  async check(ctx) {
    for (const c of ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING"]) {
      if (await ctx.exists(c))
        return pass("license-declared", 2, `${c} present.`);
    }
    return fail("license-declared", "No LICENSE file at repo root.", {
      summary: "Add a LICENSE file so agents and humans know the terms.",
    });
  },
};

export const safetyRules: Rule[] = [
  agentsMdOffLimits,
  preCommitHooks,
  envExampleNoEnv,
  prTemplate,
  codeowners,
  licenseDeclared,
];

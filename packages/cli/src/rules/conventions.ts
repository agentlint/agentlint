import type { Rule } from "@agentlint/core";
import { fail, findAgentsMd, hasSection, pass, warn } from "./_helpers.js";

export const linterConfig: Rule = {
  meta: {
    id: "linter-config",
    category: "conventions",
    weight: 4,
    fixable: false,
    description: "A linter config is present (ESLint, Biome, Ruff, etc.).",
  },
  async check(ctx) {
    const candidates = [
      ".eslintrc",
      ".eslintrc.json",
      ".eslintrc.js",
      ".eslintrc.cjs",
      ".eslintrc.yml",
      "eslint.config.js",
      "eslint.config.mjs",
      "eslint.config.ts",
      "biome.json",
      "biome.jsonc",
      "ruff.toml",
      ".ruff.toml",
      ".golangci.yml",
      ".golangci.yaml",
      "clippy.toml",
    ];
    for (const c of candidates) {
      if (await ctx.exists(c))
        return pass("linter-config", 4, `Linter config found: ${c}.`);
    }
    // Could be in pyproject.toml [tool.ruff]
    const pyproject = await ctx.read("pyproject.toml");
    if (pyproject && /\[tool\.(ruff|mypy|flake8|pylint)\]/.test(pyproject)) {
      return pass("linter-config", 4, "Linter config in pyproject.toml.");
    }
    // Or in package.json eslintConfig / biome
    const m = ctx.meta.manifest;
    if (m && (m.eslintConfig || m.biome)) {
      return pass("linter-config", 4, "Linter config in package.json.");
    }
    return fail("linter-config", "No linter configuration detected.", {
      summary:
        "Add a linter (Biome, ESLint, Ruff, etc.) and commit its config file.",
    });
  },
};

export const formatterConfig: Rule = {
  meta: {
    id: "formatter-config",
    category: "conventions",
    weight: 4,
    fixable: false,
    description:
      "A formatter config is present (Prettier, Biome, Black, etc.).",
  },
  async check(ctx) {
    const candidates = [
      ".prettierrc",
      ".prettierrc.json",
      ".prettierrc.js",
      ".prettierrc.cjs",
      ".prettierrc.yaml",
      ".prettierrc.yml",
      "prettier.config.js",
      "prettier.config.mjs",
      "biome.json",
      "biome.jsonc",
      ".rustfmt.toml",
      "rustfmt.toml",
    ];
    for (const c of candidates) {
      if (await ctx.exists(c))
        return pass("formatter-config", 4, `Formatter config: ${c}.`);
    }
    const pyproject = await ctx.read("pyproject.toml");
    if (pyproject && /\[tool\.(black|ruff\.format)\]/.test(pyproject)) {
      return pass("formatter-config", 4, "Formatter config in pyproject.toml.");
    }
    const m = ctx.meta.manifest;
    if (m && (m.prettier || m.biome)) {
      return pass("formatter-config", 4, "Formatter config in package.json.");
    }
    return fail("formatter-config", "No formatter configuration detected.", {
      summary:
        "Add a formatter (Biome, Prettier, Black, rustfmt, gofmt) and commit its config.",
    });
  },
};

export const editorconfig: Rule = {
  meta: {
    id: "editorconfig",
    category: "conventions",
    weight: 2,
    fixable: true,
    description: "A .editorconfig file is present.",
  },
  async check(ctx) {
    if (await ctx.exists(".editorconfig"))
      return pass("editorconfig", 2, ".editorconfig present.");
    return fail("editorconfig", ".editorconfig not found.", {
      summary:
        "Add a .editorconfig at the repo root for consistent indentation and line endings.",
    });
  },
};

export const namingConventionsDocumented: Rule = {
  meta: {
    id: "naming-conventions-documented",
    category: "conventions",
    weight: 4,
    fixable: false,
    description:
      "Naming conventions for files, types, and variables are documented in AGENTS.md.",
  },
  async check(ctx) {
    const a = await findAgentsMd(ctx);
    if (!a)
      return fail(
        "naming-conventions-documented",
        "No AGENTS.md, so naming conventions cannot be documented there.",
        { summary: "Add AGENTS.md and a Naming section." },
      );
    if (
      hasSection(a.content, "naming") ||
      /\b(camelCase|kebab-case|snake_case|PascalCase)\b/.test(a.content)
    ) {
      return pass(
        "naming-conventions-documented",
        4,
        "Naming conventions documented.",
      );
    }
    return fail(
      "naming-conventions-documented",
      "Naming conventions not documented in AGENTS.md.",
      { summary: "Document naming for files, types, variables in AGENTS.md." },
    );
  },
};

export const folderStructureDocumented: Rule = {
  meta: {
    id: "folder-structure-documented",
    category: "conventions",
    weight: 3,
    fixable: false,
    description:
      "The folder structure or architecture is documented in AGENTS.md.",
  },
  async check(ctx) {
    const a = await findAgentsMd(ctx);
    if (!a)
      return fail("folder-structure-documented", "No AGENTS.md present.", {
        summary:
          "Add AGENTS.md with an Architecture or Folder structure section.",
      });
    if (
      hasSection(a.content, "architect") ||
      hasSection(a.content, "structure") ||
      hasSection(a.content, "layout") ||
      /```[\s\S]*\b(src|packages|apps)\b[\s\S]*```/.test(a.content)
    ) {
      return pass(
        "folder-structure-documented",
        3,
        "Folder structure / architecture documented.",
      );
    }
    return fail(
      "folder-structure-documented",
      "No folder structure section in AGENTS.md.",
      {
        summary:
          "Add an ## Architecture section with a directory tree or component map.",
      },
    );
  },
};

export const commitConventionDocumented: Rule = {
  meta: {
    id: "commit-convention-documented",
    category: "conventions",
    weight: 3,
    fixable: false,
    description:
      "Commit-message convention is documented (e.g. Conventional Commits).",
  },
  async check(ctx) {
    const a = await findAgentsMd(ctx);
    const candidates = [
      a?.content ?? "",
      (await ctx.read("CONTRIBUTING.md")) ?? "",
    ].join("\n");
    if (
      /conventional commits/i.test(candidates) ||
      /\b(feat|fix|chore|docs|refactor|test):/.test(candidates) ||
      /commit\s+message/i.test(candidates)
    ) {
      return pass(
        "commit-convention-documented",
        3,
        "Commit-message convention documented.",
      );
    }
    return fail(
      "commit-convention-documented",
      "No commit-message convention documented.",
      {
        summary:
          "Document Conventional Commits or your team's convention in AGENTS.md or CONTRIBUTING.md.",
      },
    );
  },
};

export const conventionsRules: Rule[] = [
  linterConfig,
  formatterConfig,
  editorconfig,
  namingConventionsDocumented,
  folderStructureDocumented,
  commitConventionDocumented,
];

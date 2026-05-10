import type { Rule } from "@agentlint/core";
import {
  fail,
  findAgentsMd,
  getNpmScript,
  pass,
  skip,
  warn,
} from "./_helpers.js";

/** Heuristic: AGENTS.md mentions a command in a fenced block or as `command`. */
function mentionsCommand(content: string, keyword: string): boolean {
  // Look for keyword inside fenced code blocks or inline code
  const fenced = /```[\s\S]*?```/g;
  const matches = content.match(fenced) ?? [];
  for (const block of matches) {
    if (new RegExp(`\\b${keyword}\\b`, "i").test(block)) return true;
  }
  return new RegExp("`[^`]*\\b" + keyword + "\\b[^`]*`", "i").test(content);
}

export const buildCmdDocumented: Rule = {
  meta: {
    id: "build-cmd-documented",
    category: "buildability",
    weight: 6,
    fixable: true,
    description:
      "A build command is documented in AGENTS.md and present in the package manifest.",
  },
  async check(ctx) {
    const agents = await findAgentsMd(ctx);
    const inDocs = agents
      ? mentionsCommand(agents.content, "build") ||
        mentionsCommand(agents.content, "compile")
      : false;
    const npmScript = getNpmScript(ctx, "build");
    const hasCargo = await ctx.exists("Cargo.toml");
    const hasGoMod = await ctx.exists("go.mod");
    const inManifest = !!npmScript || hasCargo || hasGoMod;

    if (inDocs && inManifest)
      return pass(
        "build-cmd-documented",
        6,
        "Build command is documented and resolves to a real script.",
      );
    if (inManifest && !inDocs)
      return warn(
        "build-cmd-documented",
        3,
        "Build script exists but is not documented in AGENTS.md.",
        { summary: "Add the build command to AGENTS.md ## Build section." },
      );
    if (inDocs && !inManifest)
      return warn(
        "build-cmd-documented",
        2,
        "Build documented but no matching script in the manifest.",
        {
          summary:
            "Add a 'build' script to package.json or matching toolchain.",
        },
      );
    return fail(
      "build-cmd-documented",
      "No build command documented or detected.",
      {
        summary:
          "Add a build command to AGENTS.md and to package.json scripts.",
      },
    );
  },
};

export const testCmdDocumented: Rule = {
  meta: {
    id: "test-cmd-documented",
    category: "buildability",
    weight: 6,
    fixable: true,
    description: "A test command is documented and runnable.",
  },
  async check(ctx) {
    const agents = await findAgentsMd(ctx);
    const inDocs = agents ? mentionsCommand(agents.content, "test") : false;
    const npmScript = getNpmScript(ctx, "test");
    const hasPyTest =
      (await ctx.exists("pytest.ini")) || (await ctx.exists("pyproject.toml"));
    const hasCargo = await ctx.exists("Cargo.toml");
    const hasGoTests = (await ctx.glob("**/*_test.go")).length > 0;
    const inManifest = !!npmScript || hasPyTest || hasCargo || hasGoTests;

    if (inDocs && inManifest)
      return pass(
        "test-cmd-documented",
        6,
        "Test command is documented and the project has a test setup.",
      );
    if (inManifest && !inDocs)
      return warn(
        "test-cmd-documented",
        3,
        "Tests exist but are not documented in AGENTS.md.",
        { summary: "Add the test command to AGENTS.md." },
      );
    if (inDocs && !inManifest)
      return warn(
        "test-cmd-documented",
        2,
        "Test command documented but no test setup detected.",
        { summary: "Add a 'test' script wired to your test runner." },
      );
    return fail(
      "test-cmd-documented",
      "No test command documented or detected.",
      {
        summary:
          "Add a test command to AGENTS.md and a test runner to the project.",
      },
    );
  },
};

export const lintCmdDocumented: Rule = {
  meta: {
    id: "lint-cmd-documented",
    category: "buildability",
    weight: 4,
    fixable: true,
    description: "A lint or format command is documented.",
  },
  async check(ctx) {
    const agents = await findAgentsMd(ctx);
    const inDocs = agents
      ? mentionsCommand(agents.content, "lint") ||
        mentionsCommand(agents.content, "format")
      : false;
    const lintScript = getNpmScript(ctx, "lint");
    const formatScript = getNpmScript(ctx, "format");
    const hasManifestCmd = !!(lintScript || formatScript);
    if (inDocs && hasManifestCmd)
      return pass("lint-cmd-documented", 4, "Lint/format command documented.");
    if (hasManifestCmd)
      return warn(
        "lint-cmd-documented",
        2,
        "Lint script exists but isn't documented in AGENTS.md.",
        { summary: "Add lint command to AGENTS.md." },
      );
    return fail(
      "lint-cmd-documented",
      "No lint or format command documented.",
      { summary: "Add a 'lint' script and document it in AGENTS.md." },
    );
  },
};

export const typecheckCmdDocumented: Rule = {
  meta: {
    id: "typecheck-cmd-documented",
    category: "buildability",
    weight: 4,
    fixable: true,
    description: "A type-check command is documented (where applicable).",
  },
  async check(ctx) {
    const lang = ctx.meta.language;
    const applicable =
      lang === "typescript" || lang === "python" || lang === "rust";
    if (!applicable)
      return skip(
        "typecheck-cmd-documented",
        "Language has no separate type-check step.",
      );
    const agents = await findAgentsMd(ctx);
    const inDocs = agents
      ? mentionsCommand(agents.content, "typecheck") ||
        mentionsCommand(agents.content, "type-check") ||
        mentionsCommand(agents.content, "tsc") ||
        mentionsCommand(agents.content, "mypy")
      : false;
    const tcScript =
      getNpmScript(ctx, "typecheck") ?? getNpmScript(ctx, "type-check");
    if (inDocs && tcScript)
      return pass(
        "typecheck-cmd-documented",
        4,
        "Type-check command documented.",
      );
    if (tcScript)
      return warn(
        "typecheck-cmd-documented",
        2,
        "Type-check script exists but isn't documented.",
        { summary: "Document the type-check command in AGENTS.md." },
      );
    return fail(
      "typecheck-cmd-documented",
      "No type-check command for a language that needs one.",
      { summary: "Add 'tsc --noEmit' (or mypy) as a script and document it." },
    );
  },
};

export const cmdCrossReference: Rule = {
  meta: {
    id: "cmd-cross-reference",
    category: "buildability",
    weight: 3,
    fixable: false,
    description:
      "Documented commands cross-reference to actual scripts in the manifest.",
  },
  async check(ctx) {
    const agents = await findAgentsMd(ctx);
    if (!agents)
      return skip("cmd-cross-reference", "No AGENTS.md to cross-reference.");
    const m = ctx.meta.manifest;
    if (!m)
      return skip(
        "cmd-cross-reference",
        "No package manifest to compare against.",
      );
    const scripts = (m.scripts as Record<string, string>) ?? {};
    const scriptNames = Object.keys(scripts);
    if (scriptNames.length === 0)
      return skip("cmd-cross-reference", "No scripts defined.");

    // Find npm/bun/yarn/pnpm run X mentions in AGENTS.md.
    // Two forms:
    //   "npm run build"   → script name is "build"
    //   "bun test"         → script name is "test" (npm/bun/yarn/pnpm shorthand)
    const reRun = /(?:npm|bun|yarn|pnpm)\s+run\s+([a-zA-Z][\w:-]*)/g;
    const reShort =
      /(?:npm|bun|yarn|pnpm)\s+(test|start|build|lint|format|typecheck|type-check)\b/g;
    const mentioned = new Set<string>();
    for (const match of agents.content.matchAll(reRun)) {
      mentioned.add(match[1]);
    }
    for (const match of agents.content.matchAll(reShort)) {
      mentioned.add(match[1]);
    }
    // 'test' and 'start' are npm builtins — don't flag if missing.
    const builtin = new Set(["test", "start", "install", "i", "add", "ci"]);
    const missing = [...mentioned].filter(
      (name) => !(name in scripts) && !builtin.has(name),
    );
    if (missing.length === 0)
      return pass(
        "cmd-cross-reference",
        3,
        "All documented commands resolve to real scripts.",
      );
    return warn(
      "cmd-cross-reference",
      Math.max(0, 3 - missing.length),
      `AGENTS.md references commands that don't exist: ${missing.join(", ")}.`,
      {
        summary:
          "Add the missing scripts to package.json or remove them from AGENTS.md.",
      },
    );
  },
};

export const ciConfigUsesSameCmds: Rule = {
  meta: {
    id: "ci-config-uses-same-cmds",
    category: "buildability",
    weight: 2,
    fixable: false,
    description: "CI config uses the same commands as documented in AGENTS.md.",
  },
  async check(ctx) {
    if (!ctx.meta.hasCi)
      return fail("ci-config-uses-same-cmds", "No CI configuration detected.", {
        summary:
          "Add a GitHub Actions workflow (or equivalent) that runs build, test, lint.",
      });
    // Look at GitHub Actions workflows
    const workflows = await ctx.glob(".github/workflows/*.{yml,yaml}");
    if (workflows.length === 0)
      return pass(
        "ci-config-uses-same-cmds",
        1,
        "CI config detected (non-GitHub).",
      );
    let mentionsTest = false;
    let mentionsBuild = false;
    let mentionsLint = false;
    for (const w of workflows) {
      const content = (await ctx.read(w)) ?? "";
      if (
        /\b(npm|bun|pnpm|yarn)\s+(run\s+)?test\b|\bpytest\b|\bgo test\b|\bcargo test\b/.test(
          content,
        )
      )
        mentionsTest = true;
      if (
        /\b(npm|bun|pnpm|yarn)\s+(run\s+)?build\b|\bcargo build\b/.test(content)
      )
        mentionsBuild = true;
      if (
        /\b(npm|bun|pnpm|yarn)\s+(run\s+)?lint\b|\bruff\b|\bbiome\b|\beslint\b/.test(
          content,
        )
      )
        mentionsLint = true;
    }
    const score =
      (mentionsTest ? 1 : 0) +
      (mentionsBuild ? 0.5 : 0) +
      (mentionsLint ? 0.5 : 0);
    if (score >= 2)
      return pass(
        "ci-config-uses-same-cmds",
        2,
        "CI runs build, test, and lint.",
      );
    if (score >= 1)
      return warn(
        "ci-config-uses-same-cmds",
        1,
        "CI runs only some of the documented commands.",
        { summary: "Run build, test, and lint in CI." },
      );
    return fail(
      "ci-config-uses-same-cmds",
      "CI exists but does not run build/test/lint commands.",
      {
        summary: "Wire CI to call the same scripts you document in AGENTS.md.",
      },
    );
  },
};

export const buildabilityRules: Rule[] = [
  buildCmdDocumented,
  testCmdDocumented,
  lintCmdDocumented,
  typecheckCmdDocumented,
  cmdCrossReference,
  ciConfigUsesSameCmds,
];

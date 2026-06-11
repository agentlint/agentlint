// Predefined fix prompts, one per rule.
//
// agentlint never calls an LLM. These are static templates, parametrized
// with detected project metadata (package manager, language, workspaces),
// that a user can paste into any AI coding agent (Claude Code, Cursor,
// Copilot, Codex, ...) to fix the corresponding finding. Each prompt tells
// the agent to derive real values from the repository — never to invent
// commands or paths.

import type { ProjectMeta, Result } from "@agentlinthq/core";

export interface PromptArgs {
  result: Result;
  meta: ProjectMeta;
}

type PromptBuilder = (args: PromptArgs) => string;

const JS_MANAGERS = new Set(["npm", "pnpm", "bun", "yarn"]);

function isJsProject(meta: ProjectMeta): boolean {
  return JS_MANAGERS.has(meta.packageManager);
}

/** "pnpm run build" for JS projects, a toolchain hint otherwise. */
function runScript(meta: ProjectMeta, script: string): string {
  if (isJsProject(meta)) return `${meta.packageManager} run ${script}`;
  switch (meta.packageManager) {
    case "cargo":
      return `cargo ${script === "typecheck" ? "check" : script}`;
    case "go":
      return `go ${script === "lint" ? "vet ./..." : `${script} ./...`}`;
    case "uv":
    case "pip":
      return script === "test" ? "pytest" : `your ${script} command`;
    default:
      return `your ${script} command`;
  }
}

function manifestName(meta: ProjectMeta): string {
  if (isJsProject(meta)) return "package.json";
  if (meta.packageManager === "cargo") return "Cargo.toml";
  if (meta.packageManager === "go") return "go.mod";
  if (meta.packageManager === "uv" || meta.packageManager === "pip")
    return "pyproject.toml";
  return "the package manifest";
}

const agentsMdSkeleton = (
  meta: ProjectMeta,
) => `   - ## Project — one paragraph: what this is, language, framework.
   - ## Build — exact commands (e.g. \`${runScript(meta, "build")}\`) and prerequisites.
   - ## Test — how to run the full suite and a single test file.
   - ## Conventions — naming, file layout, import style, commit-message format.
   - ## Gotchas / Off-limits — generated or vendored paths, things an agent must not modify, and non-obvious pitfalls.`;

export const promptRegistry: Record<string, PromptBuilder> = {
  // ── discoverability ────────────────────────────────────────────────
  "agents-md-exists": ({
    meta,
  }) => `Create an AGENTS.md file at the repository root — the primary context file AI coding agents read (see https://agents.md/).
1. Read README.md, ${manifestName(meta)}, and any CI workflows to learn the project's real build/test/lint commands. Do not invent commands.
2. Write AGENTS.md (aim for 30–250 lines) with these sections:
${agentsMdSkeleton(meta)}
3. Every command you document must exist in the repository today.`,

  "agents-md-size": ({ result }) =>
    result.message.includes("too long")
      ? `AGENTS.md is too long; agents lose signal in noise. Trim it to under 250 lines:
1. Keep build/test/lint commands, conventions, architecture map, and gotchas.
2. Move deep-dive material into linked docs (docs/*.md) or per-folder AGENTS.md files, and link them from the root file.
3. Delete anything an agent can derive by reading the code (full API listings, changelogs).`
      : `AGENTS.md is too thin to be useful. Expand it to at least 30 lines:
1. Inspect the repository to find the real build, test, and lint commands.
2. Add sections for Build, Test, Conventions, and Gotchas/Off-limits with concrete, verified content.
3. Add a short architecture map (key directories and what lives in each).`,

  "agents-md-sections": ({
    result,
  }) => `AGENTS.md is missing key sections. The finding says: "${result.message}"
1. Add each missing section as a markdown heading (## Build, ## Test, ## Conventions, ## Gotchas / Off-limits).
2. Fill each with verified content from the repository — real commands from the manifest/CI, real conventions from the existing code, real generated/vendored paths.
3. Do not pad with generic advice; agents need project-specific facts.`,

  "readme-links-agents-md":
    () => `Add a short "For AI agents" note to README.md that links to AGENTS.md, e.g.:
> **AI coding agents:** start with [AGENTS.md](./AGENTS.md) for build commands, conventions, and guardrails.
Place it near the top (after the intro or badges). Keep it to 1–3 lines.`,

  "tool-shims-present": ({
    result,
  }) => `Add per-tool shim files so every agent finds the AGENTS.md content. The finding says: "${result.message}"
1. CLAUDE.md at the repo root containing: a one-line note plus \`@AGENTS.md\` (Claude Code import syntax) or a brief pointer to AGENTS.md.
2. .github/copilot-instructions.md — a pointer to AGENTS.md plus any Copilot-specific notes.
3. .cursor/rules/main.md (or legacy .cursorrules) — same content pointer for Cursor.
Each shim should reference AGENTS.md as the single source of truth, not duplicate it.`,

  "monorepo-sub-agents-md": ({
    meta,
  }) => `This is a monorepo${meta.workspaces.length > 0 ? ` with workspaces: ${meta.workspaces.join(", ")}` : ""} but has no per-workspace AGENTS.md files.
1. For each workspace, create <workspace>/AGENTS.md covering only that package: what it is, its own build/test commands, its conventions and gotchas.
2. Keep each one short (10–60 lines); the root AGENTS.md stays the overview.
3. Derive workspace commands from each workspace's own manifest — do not copy root commands blindly.`,

  // ── buildability ───────────────────────────────────────────────────
  "build-cmd-documented": ({
    result,
    meta,
  }) => `Make the build command both real and documented. The finding says: "${result.message}"
1. If ${manifestName(meta)} has no build entry, add one wired to the project's actual toolchain.
2. Document the exact command (e.g. \`${runScript(meta, "build")}\`) in AGENTS.md under a ## Build heading, in a fenced code block.
3. Run the command once to confirm it works before documenting it.`,

  "test-cmd-documented": ({
    result,
    meta,
  }) => `Make the test command both real and documented. The finding says: "${result.message}"
1. If the project has no test setup, add the standard test runner for this stack and one smoke test.
2. Document the exact command (e.g. \`${runScript(meta, "test")}\`) in AGENTS.md under a ## Test heading, including how to run a single test.
3. Run the command once to confirm it passes before documenting it.`,

  "lint-cmd-documented": ({
    result,
    meta,
  }) => `Make the lint/format command both real and documented. The finding says: "${result.message}"
1. If no lint script exists, add one wired to the project's linter (add the linter first if needed — see the linter-config fix).
2. Document the exact command (e.g. \`${runScript(meta, "lint")}\`) in AGENTS.md.
3. Run it once to confirm it works.`,

  "typecheck-cmd-documented": ({
    result,
    meta,
  }) => `Add and document a type-check command. The finding says: "${result.message}"
1. For TypeScript add a "typecheck" script running \`tsc --noEmit\`; for Python use mypy or pyright; for Rust \`cargo check\`.
2. Document the command (e.g. \`${runScript(meta, "typecheck")}\`) in AGENTS.md alongside build and test.
3. Run it once and fix or note any pre-existing errors rather than hiding them.`,

  "cmd-cross-reference": ({
    result,
  }) => `AGENTS.md references commands that don't exist. The finding says: "${result.message}"
1. For each missing command, decide: add the script to the manifest (preferred if the docs describe real workflow) or correct/remove the stale reference in AGENTS.md.
2. After the change, every command mentioned in AGENTS.md must run successfully from a clean checkout.`,

  "ci-config-uses-same-cmds": ({
    result,
    meta,
  }) => `Align CI with the documented commands. The finding says: "${result.message}"
1. If there is no CI at all, add .github/workflows/ci.yml that checks out, installs dependencies, and runs the documented build, test, and lint commands.
2. If CI exists, make it call the same scripts documented in AGENTS.md (e.g. \`${runScript(meta, "build")}\`, \`${runScript(meta, "test")}\`, \`${runScript(meta, "lint")}\`) — not bespoke variants.
3. Keep the workflow minimal; do not add deploy steps.`,

  // ── conventions ────────────────────────────────────────────────────
  "linter-config": ({ meta }) => `Add a linter and commit its config.
1. Pick the standard linter for this stack (${isJsProject(meta) ? "Biome or ESLint" : meta.packageManager === "cargo" ? "clippy" : meta.packageManager === "go" ? "golangci-lint" : meta.packageManager === "pip" || meta.packageManager === "uv" ? "Ruff" : "the stack's standard linter"}) and add its config file at the repo root.
2. Start from the recommended ruleset; only disable rules with a written reason.
3. Add a lint script to ${manifestName(meta)}, run it, and fix or explicitly suppress existing violations.`,

  "formatter-config": ({ meta }) => `Add a code formatter and commit its config.
1. Pick the standard formatter (${isJsProject(meta) ? "Biome or Prettier" : meta.packageManager === "cargo" ? "rustfmt" : meta.packageManager === "go" ? "gofmt (no config needed — document it)" : meta.packageManager === "pip" || meta.packageManager === "uv" ? "Black or Ruff format" : "the stack's standard formatter"}) and commit its config file.
2. Format the codebase in a single dedicated commit so the diff stays reviewable.
3. Add a format script and mention it in AGENTS.md.`,

  editorconfig:
    () => `Add a .editorconfig at the repo root matching the project's current dominant style. Inspect existing files first to detect indentation and line endings, then write e.g.:
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
Adjust indent_size/style per language section if the codebase differs.`,

  "naming-conventions-documented":
    () => `Document naming conventions in AGENTS.md.
1. Inspect the codebase to extract the *actual* conventions: file naming (kebab-case? snake_case?), type/class naming, function/variable naming, test-file naming.
2. Add a ## Naming (or extend ## Conventions) section in AGENTS.md listing them with one example each.
3. Document what the code does today — do not introduce new conventions in this change.`,

  "folder-structure-documented":
    () => `Document the folder structure in AGENTS.md.
1. Add an ## Architecture section with a short annotated directory tree (top 2 levels) describing what lives where and where new code should go.
2. Only include directories that matter for contributors; skip build output and vendored code.`,

  "commit-convention-documented": () => `Document the commit-message convention.
1. Run \`git log --oneline -30\` to see the de-facto convention.
2. If commits already follow Conventional Commits, document that in AGENTS.md (or CONTRIBUTING.md) with the allowed types (feat, fix, chore, docs, refactor, test, perf, ci).
3. If there is no convention, propose Conventional Commits and document it — do not rewrite history.`,

  // ── documentation (docs-site rules) ───────────────────────────────
  "llms-txt-present":
    () => `Add an llms.txt file at the root of the documentation site (see https://llmstxt.org/).
1. In the docs site source, create llms.txt: an H1 with the project name, a one-line summary, then a markdown list of the most important pages with absolute URLs and one-line descriptions.
2. Ensure the site serves it at /llms.txt with content-type text/plain.
3. Keep it curated (10–50 links), not an exhaustive sitemap.`,

  "llms-full-or-md-mirrors":
    () => `Make full docs content available to agents in plain text.
1. Preferred: generate llms-full.txt at the docs root — the concatenated markdown content of all docs pages (most docs frameworks have a plugin or a simple build step for this).
2. Alternative: serve a .md mirror of each docs page (page-url + ".md").
3. Wire generation into the docs build so it never goes stale.`,

  "docs-have-fenced-code":
    () => `Docs pages show code as images or canvas, which agents cannot read.
1. Replace screenshots/canvas-rendered code with real fenced code blocks in the docs source.
2. Keep images only for genuinely visual content (UI screenshots, diagrams) and give them alt text.`,

  "api-reference-text-extractable":
    () => `The API reference is not text-extractable.
1. Render the API reference as server-rendered or static HTML so the content exists in the page markup, not only in canvas/SVG or client-side-only rendering.
2. If the reference is generated from an OpenAPI spec, prefer a generator that emits static HTML or markdown.`,

  "openapi-linked-from-llms":
    () => `Link the machine-readable API spec from llms.txt.
1. Publish the OpenAPI (or AsyncAPI) spec at a stable URL on the docs site, e.g. /openapi.json.
2. Add a line to llms.txt under an "API" heading linking to it with a one-line description.`,

  "robots-consistent-with-llms":
    () => `robots.txt blocks AI crawlers while llms.txt invites them — pick one policy.
1. If AI tools should read the docs: remove the Disallow rules for AI user-agents (GPTBot, ClaudeBot, CCBot, PerplexityBot, ...) from robots.txt.
2. If they should not: remove llms.txt instead.
Make robots.txt and llms.txt tell the same story.`,

  // ── safety ─────────────────────────────────────────────────────────
  "agents-md-off-limits": () => `Declare off-limits paths in AGENTS.md.
1. Identify what agents must not touch: generated code, vendored dependencies, database migrations, lockfiles, public API contracts, license headers.
2. Add an ## Off-limits section to AGENTS.md listing each path or area with a one-line reason.
3. Only list things that are genuinely present in this repository.`,

  "pre-commit-hooks": ({
    meta,
  }) => `Add pre-commit hooks so broken code never reaches a commit.
1. ${isJsProject(meta) ? `Install husky + lint-staged (\`${meta.packageManager} add -D husky lint-staged\`), add a .husky/pre-commit hook running lint-staged, and configure lint-staged to run the linter/formatter on staged files.` : "Add the pre-commit framework (https://pre-commit.com): create .pre-commit-config.yaml running the project's formatter and linter, and document `pre-commit install` in the setup instructions."}
2. Keep hooks fast (<5s) — lint only staged files, never run the full test suite.
3. Document the hook setup in AGENTS.md.`,

  "env-example-no-env": ({ result }) =>
    result.message.includes("committed")
      ? `SECURITY: a real .env file is committed to the repository.
1. Remove it from git tracking: \`git rm --cached .env\` (and any .env.local / .env.production), then add those names to .gitignore.
2. Create a .env.example with the same variable names but placeholder values and short comments.
3. Tell the repository owner to rotate every credential that was in the committed file — assume it is compromised.`
      : `Add a .env.example documenting required environment variables.
1. Search the code for environment-variable reads (process.env, os.environ, etc.) and list each required variable.
2. Create .env.example with placeholder values and a one-line comment per variable.
3. Ensure .gitignore covers .env and .env.* (except .env.example).`,

  "pr-template":
    () => `Add a pull-request template at .github/PULL_REQUEST_TEMPLATE.md with concise sections:
## What & why — summary of the change and its motivation.
## How to test — exact commands or steps a reviewer runs.
## Checklist — tests added/updated, docs updated, no secrets committed.
Keep it under ~30 lines so contributors actually fill it in.`,

  codeowners: () => `Add a CODEOWNERS file at .github/CODEOWNERS.
1. Run \`git shortlog -sne --no-merges | head\` to find the main maintainers.
2. Start with a default owner line (\`* @owner\`) and add specific owners for sensitive paths (CI workflows, release tooling, public API).
3. Only list users/teams with repository access, or GitHub ignores the entry.`,

  "license-declared": () => `Add a LICENSE file at the repository root.
1. Ask the repository owner which license applies — do NOT choose one yourself. If the manifest already has a "license" field, use that.
2. Add the standard full text for that license with the correct year and copyright holder.
3. Ensure the manifest's license field matches the file.`,
};

/**
 * Build the predefined fix prompt for a single result, or null when the
 * rule has no registered prompt.
 */
export function buildRulePrompt(
  result: Result,
  meta: ProjectMeta,
): string | null {
  const builder = promptRegistry[result.ruleId];
  if (!builder) return null;
  return builder({ result, meta });
}

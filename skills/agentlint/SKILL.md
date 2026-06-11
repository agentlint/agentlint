---
name: agentlint
description: Audit a repository's AI-agent readiness with the agentlint CLI and fix the findings. Use when the user asks to score, audit, or improve how well a repo works with AI coding agents (AGENTS.md, build/test docs, conventions, guardrails), or mentions agentlint.
---

# agentlint — audit and fix AI-agent readiness

agentlint scans a repository against ~30 checks across five categories
(discoverability, buildability, conventions, documentation, safety) and
produces a 0–100 score. It is local-first and never calls an AI itself.

## Running the CLI

Prefer the installed binary; fall back to npx:

```bash
if command -v agentlint >/dev/null 2>&1; then
  agentlint "$@"
else
  npx -y @agentlinthq/cli@latest "$@"
fi
```

## Workflow

1. **Scan.** Run the CLI with `--markdown` from the repo root — that format
   is designed for you to read:

   ```bash
   agentlint . --markdown --no-html
   ```

   Add `--url <docs-site>` when the project has a public docs site (enables
   the documentation checks: llms.txt, .md mirrors, robots consistency).

2. **Report.** Tell the user the score, the per-category breakdown, and the
   top failing rules with their point weights.

3. **Fix (only if the user wants fixes).** Get the consolidated fix prompt
   and follow its instructions — it is written for AI coding agents and is
   ordered by score impact:

   ```bash
   agentlint prompt .
   ```

   For a single finding: `agentlint prompt --rule <rule-id>`.

   Honor its ground rules: derive commands from the real repository, keep
   diffs minimal, never invent facts, and stop to ask when a fix needs an
   owner decision (e.g. which license to use).

4. **Verify.** Re-run the scan and confirm the score improved and the fixed
   rules now pass:

   ```bash
   agentlint . --no-html
   ```

## Exit codes (for CI use)

- `0` — score >= 80
- `1` — score < 80
- `2` — org policy failure (only with `--push`)

`agentlint prompt` exits 0 even on low scores (it is a generator, not a
gate) and 1 only for unknown rule ids.

#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { buildReport, registerRuleCategory } from "@agentlint/core";
import { renderHtml } from "./report/html.js";
import { renderJson } from "./report/json.js";
import { renderMarkdown } from "./report/markdown.js";
import { renderTerminal } from "./report/terminal.js";
import { allRules } from "./rules/index.js";
import { createScanContext } from "./scan-context.js";

const VERSION = "1.0.0";

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      json: { type: "boolean" },
      markdown: { type: "boolean" },
      url: { type: "string" },
      output: { type: "string", short: "o" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
      "no-html": { type: "boolean" },
    },
    allowPositionals: true,
    strict: true,
  });

  if (values.help) {
    printHelp();
    return;
  }
  if (values.version) {
    console.log(VERSION);
    return;
  }

  const root = resolve(positionals[0] ?? ".");

  // Register rule categories with core's score calculator.
  for (const r of allRules) registerRuleCategory(r.meta.id, r.meta.category);

  const ctx = await createScanContext({ root, url: values.url });

  // Run all rules in parallel.
  const results = await Promise.all(
    allRules.map(async (rule) => {
      try {
        return await rule.check(ctx);
      } catch (err) {
        return {
          ruleId: rule.meta.id,
          status: "fail" as const,
          points: 0,
          message: `Rule crashed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }),
  );

  const report = buildReport({
    version: VERSION,
    root,
    url: values.url,
    results,
  });

  if (values.json) {
    process.stdout.write(renderJson(report));
    process.exit(report.score < 80 ? 1 : 0);
  }
  if (values.markdown) {
    process.stdout.write(renderMarkdown(report));
    process.exit(report.score < 80 ? 1 : 0);
  }

  // Default: pretty terminal + write HTML to disk.
  process.stdout.write(renderTerminal(report));

  if (!values["no-html"]) {
    const htmlPath = values.output ?? "agentlint-report.html";
    writeFileSync(htmlPath, renderHtml(report));
    console.log(`  Full report:    ${htmlPath}`);
    console.log("");
  }

  process.exit(report.score < 80 ? 1 : 0);
}

function printHelp() {
  console.log(`
agentlint v${VERSION}  —  Lighthouse for AI coding agents

Usage:
  agentlint [path]           Scan the given path (default: cwd)

Options:
  --json                     Machine-readable JSON to stdout
  --markdown                 Markdown report to stdout (for AI agents)
  --url <docs-url>           Also audit the docs site at this URL
  --output, -o <path>        Where to write the HTML report
  --no-html                  Don't write an HTML report
  --version, -v              Print version
  --help, -h                 Show this message

Exit code: 0 if score >= 80, 1 otherwise. Use this to gate CI.

Docs: https://agentlint.dev
`);
}

main().catch((err) => {
  console.error("agentlint crashed:", err);
  process.exit(2);
});

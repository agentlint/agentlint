#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { buildReport, registerRuleCategory } from "@agentlinthq/core";
import { pushReport } from "./push/client.js";
import { detectRepo } from "./push/repo-detect.js";
import { resolveToken, tokenFilePath } from "./push/token.js";
import { renderHtml } from "./report/html.js";
import { renderJson } from "./report/json.js";
import { renderMarkdown } from "./report/markdown.js";
import { renderTerminal } from "./report/terminal.js";
import { allRules } from "./rules/index.js";
import { createScanContext } from "./scan-context.js";

const VERSION = "1.0.0";
const DEFAULT_PUSH_URL = "https://agentlint.sh";

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
      push: { type: "boolean" },
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

  // The --url flag is overloaded:
  //   - on its own it means "audit this docs site"
  //   - with --push it ALSO selects the upload endpoint
  // To disambiguate, --push uses (in order): an explicit --url that looks
  // like an endpoint, AGENTLINT_URL, or the default. The docs URL passed
  // to the scan is whatever --url was, regardless.
  const ctx = await createScanContext({ root, url: values.url });

  // Register rule categories with core's score calculator.
  for (const r of allRules) registerRuleCategory(r.meta.id, r.meta.category);

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
    if (values.push) await runPush(report, values.url, root);
    process.exit(report.score < 80 ? 1 : 0);
  }
  if (values.markdown) {
    process.stdout.write(renderMarkdown(report));
    if (values.push) await runPush(report, values.url, root);
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

  if (values.push) await runPush(report, values.url, root);

  process.exit(report.score < 80 ? 1 : 0);
}

/**
 * Resolve token, detect repo, POST the report. Never throws and never exits
 * non-zero — the local audit already succeeded; push is a side effect
 * (CHARTER §3, PRD §CLI surface).
 */
async function runPush(
  report: ReturnType<typeof buildReport>,
  flagUrl: string | undefined,
  cwd: string,
): Promise<void> {
  const endpoint =
    pickEndpoint(flagUrl) ?? process.env.AGENTLINT_URL ?? DEFAULT_PUSH_URL;

  const token = await resolveToken();
  if (!token) {
    console.log(
      `Push failed: no token (set AGENTLINT_TOKEN or write one to ${tokenFilePath()})`,
    );
    return;
  }

  const repo = await detectRepo(cwd);

  const counts = countByStatus(report.results);
  const body = JSON.stringify({
    score: report.score,
    passes: counts.pass,
    fails: counts.fail,
    warnings: counts.warn,
    skipped: counts.skip,
    repo: repo
      ? { owner: repo.owner, name: repo.name }
      : { owner: null, name: null },
    report,
  });

  const result = await pushReport({ url: endpoint, token, body });
  if (result.ok) {
    console.log(`Pushed: ${result.runUrl}`);
  } else {
    console.log(`Push failed: ${result.reason}`);
  }
}

/**
 * The --url flag is primarily a docs-site URL for the documentation rules.
 * If the user passed --push --url <something>, we treat that --url as the
 * push endpoint only when it looks like a bare origin (no path beyond /).
 * Otherwise we fall back to AGENTLINT_URL / the default. This keeps the
 * existing single-flag use case unchanged while letting `--push --url` work.
 */
function pickEndpoint(flagUrl: string | undefined): string | null {
  if (!flagUrl) return null;
  try {
    const u = new URL(flagUrl);
    if (u.pathname === "/" || u.pathname === "") return flagUrl;
    return null;
  } catch {
    return null;
  }
}

function countByStatus(results: ReturnType<typeof buildReport>["results"]): {
  pass: number;
  fail: number;
  warn: number;
  skip: number;
} {
  let pass = 0;
  let fail = 0;
  let warn = 0;
  let skip = 0;
  for (const r of results) {
    if (r.status === "pass") pass += 1;
    else if (r.status === "fail") fail += 1;
    else if (r.status === "warn") warn += 1;
    else if (r.status === "skip") skip += 1;
  }
  return { pass, fail, warn, skip };
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
  --push                     Upload the report to your agentlint.sh dashboard
                             (requires AGENTLINT_TOKEN env or
                             ~/.config/agentlint/token; opt-in, never on by
                             default)
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

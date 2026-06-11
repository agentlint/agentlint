import type { Category, Report } from "@agentlinthq/core";

const CATEGORY_LABELS: Record<Category, string> = {
  discoverability: "Discoverability",
  buildability: "Buildability",
  conventions: "Convention clarity",
  documentation: "Documentation surface",
  safety: "Safety & guardrails",
};

export function renderMarkdown(report: Report): string {
  const lines: string[] = [];
  lines.push(`# agentlint report`);
  lines.push("");
  lines.push(`> Score: **${report.score}/100** • scanned ${report.root}`);
  if (report.url) lines.push(`> Docs URL: ${report.url}`);
  lines.push(`> Generated: ${report.scannedAt}`);
  lines.push("");

  lines.push(`## Summary by category`);
  lines.push("");
  lines.push("| Category | Earned | Possible |");
  lines.push("|---|---|---|");
  for (const c of report.byCategory) {
    const label = CATEGORY_LABELS[c.category];
    if (c.possible === 0) {
      lines.push(`| ${label} | _skipped_ | _skipped_ |`);
    } else {
      lines.push(`| ${label} | ${c.earned} | ${c.possible} |`);
    }
  }
  lines.push("");

  // Failures with fixes
  const fails = report.results.filter((r) => r.status === "fail");
  if (fails.length > 0) {
    lines.push(`## Failures (${fails.length})`);
    lines.push("");
    lines.push(
      "An AI coding agent can read this section and apply the fixes directly.",
    );
    lines.push("");
    for (const f of fails) {
      lines.push(`### \`${f.ruleId}\``);
      lines.push("");
      lines.push(f.message);
      if (f.fix) {
        lines.push("");
        lines.push(`**Fix:** ${f.fix.summary}`);
        if (f.fix.docsUrl) lines.push(`Reference: ${f.fix.docsUrl}`);
        if (f.fix.diff) {
          lines.push("");
          lines.push("```diff");
          lines.push(f.fix.diff);
          lines.push("```");
        }
        if (f.fix.prompt) {
          lines.push("");
          lines.push("**Prompt for an AI agent:**");
          lines.push("");
          lines.push("````text");
          lines.push(f.fix.prompt);
          lines.push("````");
        }
      }
      lines.push("");
    }
  }

  // Warnings
  const warns = report.results.filter((r) => r.status === "warn");
  if (warns.length > 0) {
    lines.push(`## Warnings (${warns.length})`);
    lines.push("");
    for (const w of warns) {
      lines.push(
        `- **${w.ruleId}** — ${w.message}${w.fix ? ` _(${w.fix.summary})_` : ""}`,
      );
    }
    lines.push("");
  }

  // Passes
  const passes = report.results.filter((r) => r.status === "pass");
  if (passes.length > 0) {
    lines.push(`## Passes (${passes.length})`);
    lines.push("");
    for (const p of passes) {
      lines.push(`- ✓ \`${p.ruleId}\` — ${p.message}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

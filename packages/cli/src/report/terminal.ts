import type { Category, Report } from "@agentlinthq/core";
import pc from "picocolors";

const CATEGORY_LABELS: Record<Category, string> = {
  discoverability: "Discoverability",
  buildability: "Buildability",
  conventions: "Convention clarity",
  documentation: "Documentation surface",
  safety: "Safety & guardrails",
};

export function renderTerminal(report: Report): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(
    `${pc.bold("agentlint")} ${pc.dim(`v${report.version}`)}  ${pc.dim("scanning")} ${report.root}`,
  );
  if (report.url) lines.push(`  ${pc.dim("docs URL:")} ${report.url}`);
  lines.push("");

  // Per-category
  const labelWidth = 22;
  for (const cat of report.byCategory) {
    const label = CATEGORY_LABELS[cat.category].padEnd(labelWidth, ".");
    if (cat.possible === 0) {
      lines.push(`  ${label} ${pc.dim(" -/-   (skipped)")}`);
    } else {
      const ratio = cat.earned / cat.possible;
      const colorize =
        ratio >= 0.9 ? pc.green : ratio >= 0.6 ? pc.yellow : pc.red;
      lines.push(
        `  ${label} ${colorize(`${cat.earned.toString().padStart(2)}/${cat.possible}`)}`,
      );
    }
  }
  lines.push("");

  // Score
  const scoreColor =
    report.score >= 90 ? pc.green : report.score >= 70 ? pc.yellow : pc.red;
  lines.push(
    `  ${pc.bold("Overall")} ${"".padEnd(labelWidth - 7, ".")} ${scoreColor(
      pc.bold(`${report.score}/100`),
    )}`,
  );
  lines.push("");

  // Counts
  const counts = { pass: 0, fail: 0, warn: 0, skip: 0 };
  for (const r of report.results) counts[r.status]++;
  lines.push(
    `  ${pc.green(`${counts.pass} passes`)}, ${pc.red(`${counts.fail} fails`)}, ${pc.yellow(`${counts.warn} warnings`)}, ${pc.dim(`${counts.skip} skipped`)}.`,
  );

  // Top fixes
  const fails = report.results
    .filter((r) => r.status === "fail" || r.status === "warn")
    .sort((a, b) => {
      // Sort fails before warns, then by point loss (estimated)
      if (a.status !== b.status) return a.status === "fail" ? -1 : 1;
      return 0;
    })
    .slice(0, 5);

  if (fails.length > 0) {
    lines.push("");
    lines.push(`  ${pc.bold("Top fixes:")}`);
    for (const f of fails) {
      const icon = f.status === "fail" ? pc.red("✗") : pc.yellow("!");
      lines.push(`    ${icon} ${pc.dim(f.ruleId.padEnd(34))} ${f.message}`);
    }
    lines.push("");
    lines.push(
      `  ${pc.dim("Run")} ${pc.bold("agentlint prompt")} ${pc.dim("for a copy-paste prompt your AI agent can use to fix these.")}`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

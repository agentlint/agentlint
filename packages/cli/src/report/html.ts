import type { Category, Report, Result } from "@agentlint/core";

const CATEGORY_LABELS: Record<Category, string> = {
  discoverability: "Discoverability",
  buildability: "Buildability",
  conventions: "Convention clarity",
  documentation: "Documentation surface",
  safety: "Safety & guardrails",
};

const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  discoverability: "Can the agent find the right project context?",
  buildability: "Can the agent build, test, and verify?",
  conventions: "Can the agent follow the project's style?",
  documentation: "Is the public docs surface agent-readable?",
  safety: "Does the project tell agents what NOT to do?",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusBadge(s: Result["status"]): string {
  const map = {
    pass: { label: "PASS", color: "#1d9e75", bg: "#e1f5ee" },
    fail: { label: "FAIL", color: "#a32d2d", bg: "#fcebeb" },
    warn: { label: "WARN", color: "#854f0b", bg: "#faeeda" },
    skip: { label: "SKIP", color: "#5f5e5a", bg: "#f1efe8" },
  };
  const m = map[s];
  return `<span class="badge" style="color:${m.color};background:${m.bg}">${m.label}</span>`;
}

export function renderHtml(report: Report): string {
  const score = report.score;
  const scoreClass =
    score >= 90 ? "score-good" : score >= 70 ? "score-mid" : "score-bad";

  const groupedByCategory: Record<Category, Result[]> = {
    discoverability: [],
    buildability: [],
    conventions: [],
    documentation: [],
    safety: [],
  };
  // Map results to their category by looking up in the bycategory bucket.
  // We don't have a direct mapping in the report, so we reconstruct from rule IDs
  // — pragmatic: we'll rely on rule prefix conventions from each file.
  // Better: pass the category through results (future improvement). For now we
  // group by traversing all results and matching common id substrings.
  const idToCategory = (id: string): Category => {
    if (
      id.startsWith("agents-md") ||
      id === "readme-links-agents-md" ||
      id === "tool-shims-present" ||
      id === "monorepo-sub-agents-md"
    ) {
      // agents-md-off-limits is in safety; detect
      if (id === "agents-md-off-limits") return "safety";
      return "discoverability";
    }
    if (
      id.endsWith("-cmd-documented") ||
      id === "cmd-cross-reference" ||
      id === "ci-config-uses-same-cmds"
    )
      return "buildability";
    if (
      id === "linter-config" ||
      id === "formatter-config" ||
      id === "editorconfig" ||
      id === "naming-conventions-documented" ||
      id === "folder-structure-documented" ||
      id === "commit-convention-documented"
    )
      return "conventions";
    if (
      id === "llms-txt-present" ||
      id === "llms-full-or-md-mirrors" ||
      id === "docs-have-fenced-code" ||
      id === "api-reference-text-extractable" ||
      id === "openapi-linked-from-llms" ||
      id === "robots-consistent-with-llms"
    )
      return "documentation";
    return "safety";
  };
  for (const r of report.results) {
    groupedByCategory[idToCategory(r.ruleId)].push(r);
  }

  const categoryHtml = (Object.keys(groupedByCategory) as Category[])
    .map((cat) => {
      const results = groupedByCategory[cat];
      const score = report.byCategory.find((c) => c.category === cat);
      const scoreLabel =
        !score || score.possible === 0
          ? '<span class="muted">skipped</span>'
          : `${score.earned} / ${score.possible}`;
      const rows = results
        .map(
          (r) => `
        <tr class="row-${r.status}">
          <td>${statusBadge(r.status)}</td>
          <td><code>${escapeHtml(r.ruleId)}</code></td>
          <td>
            <div>${escapeHtml(r.message)}</div>
            ${
              r.fix
                ? `<div class="fix"><strong>Fix:</strong> ${escapeHtml(r.fix.summary)}${r.fix.docsUrl ? ` &middot; <a href="${escapeHtml(r.fix.docsUrl)}" target="_blank" rel="noreferrer">docs</a>` : ""}</div>`
                : ""
            }
            ${
              r.fix?.diff
                ? `<pre class="diff">${escapeHtml(r.fix.diff)}</pre>`
                : ""
            }
          </td>
        </tr>`,
        )
        .join("\n");
      return `
      <section class="category">
        <header>
          <h2>${CATEGORY_LABELS[cat]}</h2>
          <span class="cat-score">${scoreLabel}</span>
        </header>
        <p class="cat-desc">${CATEGORY_DESCRIPTIONS[cat]}</p>
        <table>
          <thead><tr><th>Status</th><th>Rule</th><th>Message</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
    `;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>agentlint report — ${escapeHtml(report.root)}</title>
<style>
  :root {
    --bg: #ffffff;
    --fg: #1a1a18;
    --muted: #6b6964;
    --border: #e8e6df;
    --card: #faf9f5;
    --accent: #5f4ec5;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #1c1b18;
      --fg: #e8e6df;
      --muted: #8e8c84;
      --border: #2c2c2a;
      --card: #232220;
      --accent: #b5aef0;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 32px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    background: var(--bg);
    color: var(--fg);
    line-height: 1.55;
  }
  .container { max-width: 1080px; margin: 0 auto; }
  header.top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid var(--border);
    padding-bottom: 24px;
    margin-bottom: 24px;
  }
  h1 { font-size: 28px; margin: 0 0 4px; font-weight: 500; }
  .subtitle { color: var(--muted); font-size: 14px; word-break: break-all; }
  .score-circle {
    width: 120px; height: 120px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 36px;
    font-weight: 500;
    color: white;
    flex-shrink: 0;
  }
  .score-good { background: #1d9e75; }
  .score-mid { background: #ba7517; }
  .score-bad { background: #a32d2d; }
  section.category {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px 24px;
    margin-bottom: 16px;
  }
  section.category header {
    display: flex; justify-content: space-between; align-items: baseline;
  }
  h2 { font-size: 18px; margin: 0; font-weight: 500; }
  .cat-score { font-size: 16px; color: var(--muted); }
  .cat-desc { color: var(--muted); font-size: 14px; margin: 4px 0 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 10px 12px; vertical-align: top; border-bottom: 1px solid var(--border); }
  th { font-size: 12px; text-transform: uppercase; color: var(--muted); font-weight: 500; }
  tr:last-child td { border-bottom: none; }
  code { font-family: "SF Mono", Menlo, monospace; font-size: 13px; color: var(--accent); }
  .badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.05em; }
  .fix { margin-top: 6px; font-size: 14px; color: var(--muted); }
  .fix strong { color: var(--fg); }
  pre.diff { background: var(--bg); border: 1px solid var(--border); padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 12px; margin: 8px 0 0; }
  .muted { color: var(--muted); }
  footer { margin-top: 32px; color: var(--muted); font-size: 13px; text-align: center; }
  footer a { color: var(--accent); }
</style>
</head>
<body>
<div class="container">
  <header class="top">
    <div>
      <h1>agentlint report</h1>
      <div class="subtitle">${escapeHtml(report.root)}${report.url ? ` &middot; ${escapeHtml(report.url)}` : ""}</div>
      <div class="subtitle">Scanned ${escapeHtml(report.scannedAt)} &middot; agentlint v${escapeHtml(report.version)}</div>
    </div>
    <div class="score-circle ${scoreClass}">${score}</div>
  </header>
  ${categoryHtml}
  <footer>
    Generated by <a href="https://agentlint.dev" target="_blank" rel="noreferrer">agentlint</a>.
    Run <code>npx @agentlint/cli</code> on any repo.
  </footer>
</div>
</body>
</html>`;
}

import type { LeaderboardRow } from "./aggregate.js";

export interface RenderInput {
  generatedAt: string;
  cliVersion: string;
  rows: LeaderboardRow[];
}

export function renderJson(input: RenderInput): string {
  return JSON.stringify(
    {
      generatedAt: input.generatedAt,
      cliVersion: input.cliVersion,
      rows: input.rows,
    },
    null,
    2,
  );
}

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fmtNumber(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("en-US");
}

export function renderTable(input: RenderInput): string {
  const head = [
    "Rank",
    "Repo",
    "Stars",
    "Language",
    "Score",
    "Passes",
    "Fails",
    "Skips",
    "Notes",
  ]
    .map((h) => `<th scope="col">${escapeHtml(h)}</th>`)
    .join("");

  const body = input.rows
    .map((row) => {
      const fullName = `${row.owner}/${row.repo}`;
      const repoLink = `https://github.com/${encodeURIComponent(row.owner)}/${encodeURIComponent(row.repo)}`;
      return [
        "<tr>",
        `<td>${row.rank ?? "—"}</td>`,
        `<td><a href="${escapeHtml(repoLink)}" target="_blank" rel="noreferrer">${escapeHtml(fullName)}</a></td>`,
        `<td>${fmtNumber(row.stars)}</td>`,
        `<td>${escapeHtml(row.language ?? "—")}</td>`,
        `<td>${row.score === null ? "—" : escapeHtml(row.score)}</td>`,
        `<td>${fmtNumber(row.passes)}</td>`,
        `<td>${fmtNumber(row.fails)}</td>`,
        `<td>${fmtNumber(row.skips)}</td>`,
        `<td>${escapeHtml(row.error ?? "")}</td>`,
        "</tr>",
      ].join("");
    })
    .join("");

  return [
    `<section class="leaderboard" data-generated-at="${escapeHtml(input.generatedAt)}" data-cli-version="${escapeHtml(input.cliVersion)}">`,
    `<table>`,
    `<thead><tr>${head}</tr></thead>`,
    `<tbody>${body}</tbody>`,
    `</table>`,
    `</section>`,
  ].join("");
}

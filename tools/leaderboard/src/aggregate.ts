import type { ScanRepoResult } from "./clone-and-scan.js";
import type { RepoEntry } from "./fetch-repos.js";

export interface LeaderboardRow {
  rank: number | null;
  owner: string;
  repo: string;
  stars: number;
  language: string | null;
  score: number | null;
  passes: number | null;
  fails: number | null;
  skips: number | null;
  error: string | null;
}

export interface AggregateOptions {
  repos: RepoEntry[];
  scanResults: ScanRepoResult[];
}

export function aggregate(opts: AggregateOptions): LeaderboardRow[] {
  const repoMap = new Map<string, RepoEntry>();
  for (const r of opts.repos) {
    repoMap.set(`${r.owner}/${r.repo}`, r);
  }

  const rows: LeaderboardRow[] = [];
  for (const s of opts.scanResults) {
    const meta = repoMap.get(`${s.owner}/${s.repo}`);
    if (s.ok) {
      rows.push({
        rank: 0,
        owner: s.owner,
        repo: s.repo,
        stars: meta?.stars ?? 0,
        language: meta?.language ?? null,
        score: s.score,
        passes: s.passes,
        fails: s.fails,
        skips: s.skips,
        error: null,
      });
    } else {
      rows.push({
        rank: null,
        owner: s.owner,
        repo: s.repo,
        stars: meta?.stars ?? 0,
        language: meta?.language ?? null,
        score: null,
        passes: null,
        fails: null,
        skips: null,
        error: s.error,
      });
    }
  }

  rows.sort((a, b) => {
    if (a.score === null && b.score === null) return b.stars - a.stars;
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    if (b.score !== a.score) return b.score - a.score;
    return b.stars - a.stars;
  });

  let rank = 0;
  for (const row of rows) {
    if (row.score === null) continue;
    rank += 1;
    row.rank = rank;
  }

  return rows;
}

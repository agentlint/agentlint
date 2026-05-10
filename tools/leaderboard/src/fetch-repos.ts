export interface BuildSearchUrlOptions {
  page: number;
  perPage: number;
  minStars: number;
}

export type FetchFn = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<Response>;

export interface FetchTopReposOptions {
  token: string;
  limit: number;
  fetchFn?: FetchFn;
  minStars?: number;
  perPage?: number;
}

const DEFAULT_PER_PAGE = 100;
const DEFAULT_MIN_STARS = 1000;

export async function fetchTopRepos(
  opts: FetchTopReposOptions,
): Promise<RepoEntry[]> {
  if (!opts.token) {
    throw new Error("GITHUB_TOKEN is required to fetch from the GitHub API");
  }
  const perPage = opts.perPage ?? DEFAULT_PER_PAGE;
  const minStars = opts.minStars ?? DEFAULT_MIN_STARS;
  const fetchFn = opts.fetchFn ?? (globalThis.fetch as FetchFn);
  const out: RepoEntry[] = [];
  for (let page = 1; out.length < opts.limit; page += 1) {
    const url = buildSearchUrl({ page, perPage, minStars });
    const res = await fetchFn(url, {
      headers: {
        Authorization: `Bearer ${opts.token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "agentlint-leaderboard/1.0 (+https://agentlint.sh/leaderboard)",
      },
    });
    if (!res.ok) {
      throw new Error(
        `GitHub search API returned ${res.status} ${res.statusText}`.trim(),
      );
    }
    const payload = (await res.json()) as SearchPayload;
    const repos = parseSearchResponse(payload);
    if (repos.length === 0) break;
    out.push(...repos);
  }
  return out.slice(0, opts.limit);
}

export interface RepoEntry {
  owner: string;
  repo: string;
  stars: number;
  language: string | null;
  defaultBranch: string;
}

interface SearchItem {
  name?: unknown;
  owner?: { login?: unknown };
  stargazers_count?: unknown;
  language?: unknown;
  default_branch?: unknown;
}

interface SearchPayload {
  items?: SearchItem[];
}

export function parseSearchResponse(payload: SearchPayload): RepoEntry[] {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const out: RepoEntry[] = [];
  for (const item of items) {
    const owner = item.owner?.login;
    const repo = item.name;
    const stars = item.stargazers_count;
    const defaultBranch = item.default_branch;
    if (
      typeof owner !== "string" ||
      typeof repo !== "string" ||
      typeof stars !== "number" ||
      typeof defaultBranch !== "string"
    ) {
      continue;
    }
    out.push({
      owner,
      repo,
      stars,
      language: typeof item.language === "string" ? item.language : null,
      defaultBranch,
    });
  }
  return out;
}

export function buildSearchUrl(opts: BuildSearchUrlOptions): string {
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set(
    "q",
    `stars:>${opts.minStars} fork:false archived:false`,
  );
  url.searchParams.set("page", String(opts.page));
  url.searchParams.set("per_page", String(opts.perPage));
  url.searchParams.set("sort", "stars");
  url.searchParams.set("order", "desc");
  return url.toString();
}

import { describe, expect, it } from "vitest";
import {
  buildSearchUrl,
  type FetchFn,
  fetchTopRepos,
  parseSearchResponse,
} from "./fetch-repos.js";

describe("buildSearchUrl", () => {
  it("builds GitHub search URL with stars threshold, page, per_page, sort", () => {
    const url = buildSearchUrl({ page: 1, perPage: 100, minStars: 1000 });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://api.github.com/search/repositories",
    );
    expect(parsed.searchParams.get("q")).toBe(
      "stars:>1000 fork:false archived:false",
    );
    expect(parsed.searchParams.get("page")).toBe("1");
    expect(parsed.searchParams.get("per_page")).toBe("100");
    expect(parsed.searchParams.get("sort")).toBe("stars");
    expect(parsed.searchParams.get("order")).toBe("desc");
  });
});

describe("parseSearchResponse", () => {
  it("extracts owner, repo, stars, language, defaultBranch from GitHub search payload", () => {
    const payload = {
      total_count: 2,
      incomplete_results: false,
      items: [
        {
          name: "next.js",
          full_name: "vercel/next.js",
          owner: { login: "vercel" },
          stargazers_count: 130000,
          language: "JavaScript",
          default_branch: "canary",
        },
        {
          name: "react",
          full_name: "facebook/react",
          owner: { login: "facebook" },
          stargazers_count: 230000,
          language: "JavaScript",
          default_branch: "main",
        },
      ],
    };
    const repos = parseSearchResponse(payload);
    expect(repos).toEqual([
      {
        owner: "vercel",
        repo: "next.js",
        stars: 130000,
        language: "JavaScript",
        defaultBranch: "canary",
      },
      {
        owner: "facebook",
        repo: "react",
        stars: 230000,
        language: "JavaScript",
        defaultBranch: "main",
      },
    ]);
  });

  it("returns empty array when items is missing", () => {
    expect(parseSearchResponse({})).toEqual([]);
  });
});

describe("fetchTopRepos", () => {
  it("throws when token is missing", async () => {
    await expect(
      fetchTopRepos({ token: "", limit: 100, fetchFn: async () => new Response() }),
    ).rejects.toThrow(/GITHUB_TOKEN/);
  });

  it("paginates and concatenates results across pages, sending Authorization header", async () => {
    const calls: { url: string; auth: string | undefined }[] = [];
    const makeItem = (n: number) => ({
      name: `repo${n}`,
      owner: { login: "owner" },
      stargazers_count: 1000 + n,
      language: "TypeScript",
      default_branch: "main",
    });
    const fetchFn: FetchFn = async (url, init) => {
      calls.push({ url, auth: init?.headers?.Authorization });
      const parsed = new URL(url);
      const page = Number(parsed.searchParams.get("page"));
      const perPage = Number(parsed.searchParams.get("per_page"));
      const start = (page - 1) * perPage;
      const items = Array.from({ length: perPage }, (_, i) => makeItem(start + i));
      return new Response(JSON.stringify({ items }), { status: 200 });
    };
    const repos = await fetchTopRepos({
      token: "ghp_test",
      limit: 25,
      perPage: 10,
      fetchFn,
    });
    expect(repos).toHaveLength(25);
    expect(repos[0]?.repo).toBe("repo0");
    expect(repos[24]?.repo).toBe("repo24");
    expect(calls).toHaveLength(3);
    expect(calls[0]?.auth).toBe("Bearer ghp_test");
  });

  it("stops requesting more pages when the API returns an empty page", async () => {
    let calls = 0;
    const fetchFn: FetchFn = async () => {
      calls += 1;
      const items =
        calls === 1
          ? [
              {
                name: "only",
                owner: { login: "owner" },
                stargazers_count: 1500,
                language: "Go",
                default_branch: "main",
              },
            ]
          : [];
      return new Response(JSON.stringify({ items }), { status: 200 });
    };
    const repos = await fetchTopRepos({
      token: "ghp_test",
      limit: 1000,
      perPage: 100,
      fetchFn,
    });
    expect(repos).toHaveLength(1);
    expect(calls).toBe(2);
  });

  it("throws when the API responds with a non-2xx status", async () => {
    const fetchFn: FetchFn = async () =>
      new Response("rate limited", { status: 403 });
    await expect(
      fetchTopRepos({ token: "ghp_test", limit: 10, fetchFn }),
    ).rejects.toThrow(/403/);
  });
});

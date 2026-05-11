import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ExecFn } from "./clone-and-scan.js";
import type { FetchFn } from "./fetch-repos.js";
import { resolveEntryOptions, runLeaderboard } from "./run.js";

interface FakeRepo {
  name: string;
  owner: { login: string };
  stargazers_count: number;
  language: string | null;
  default_branch: string;
}

function makeFetch(items: FakeRepo[][]): FetchFn {
  let call = 0;
  return async () => {
    const page = items[call] ?? [];
    call += 1;
    return new Response(JSON.stringify({ items: page }), { status: 200 });
  };
}

function makeExec(opts: {
  scoreFor?: (owner: string, repo: string) => number | null;
  cloneFails?: (owner: string, repo: string) => boolean;
}): ExecFn {
  return async (cmd, args) => {
    if (cmd === "git") {
      const url = args[args.length - 2] ?? "";
      const match = url.match(/github\.com\/([^/]+)\/(.+?)\.git/);
      if (match && opts.cloneFails?.(match[1] ?? "", match[2] ?? "")) {
        throw new Error("clone fatal");
      }
      return { stdout: "", stderr: "" };
    }
    const destPath = args[args.length - 1] ?? "";
    const dirMatch = destPath.match(/([^/]+)--(.+)$/);
    const owner = dirMatch?.[1] ?? "owner";
    const repo = dirMatch?.[2] ?? "repo";
    const score = opts.scoreFor?.(owner, repo);
    if (score === null) {
      return { stdout: "garbage not json", stderr: "" };
    }
    return {
      stdout: JSON.stringify({
        version: "1.0.0",
        score: score ?? 80,
        results: [
          { ruleId: "x", status: "pass", points: 5 },
          { ruleId: "y", status: "pass", points: 5 },
        ],
      }),
      stderr: "",
    };
  };
}

const ONE_REPO: FakeRepo = {
  name: "react",
  owner: { login: "facebook" },
  stargazers_count: 230000,
  language: "JavaScript",
  default_branch: "main",
};

const TWO_REPOS: FakeRepo[] = [
  ONE_REPO,
  {
    name: "next.js",
    owner: { login: "vercel" },
    stargazers_count: 130000,
    language: "JavaScript",
    default_branch: "canary",
  },
];

describe("runLeaderboard", () => {
  let workdir: string;

  beforeEach(async () => {
    workdir = await mkdtemp(join(tmpdir(), "leaderboard-test-"));
  });

  afterEach(async () => {
    await rm(workdir, { recursive: true, force: true });
  });

  it("throws when GITHUB_TOKEN is missing", async () => {
    await expect(
      runLeaderboard({
        token: "",
        limit: 5,
        cliPath: "/fake",
        outDir: join(workdir, "out"),
        htmlDir: join(workdir, "html"),
        workDir: join(workdir, "work"),
        fetchFn: makeFetch([[ONE_REPO]]),
        execFn: makeExec({}),
      }),
    ).rejects.toThrow(/GITHUB_TOKEN/);
  });

  it("throws when limit is zero or negative", async () => {
    await expect(
      runLeaderboard({
        token: "ghp",
        limit: 0,
        cliPath: "/fake",
        outDir: join(workdir, "out"),
        htmlDir: join(workdir, "html"),
        workDir: join(workdir, "work"),
        fetchFn: makeFetch([[]]),
        execFn: makeExec({}),
      }),
    ).rejects.toThrow(/limit/);
  });

  it("orchestrates fetch → scan → aggregate → write for a happy path", async () => {
    const generatedAt = new Date("2026-05-11T06:00:00.000Z");
    const result = await runLeaderboard({
      token: "ghp",
      limit: 2,
      cliPath: "/fake/agentlint",
      outDir: join(workdir, "out"),
      htmlDir: join(workdir, "html"),
      workDir: join(workdir, "work"),
      cliVersion: "1.2.3",
      fetchFn: makeFetch([TWO_REPOS, []]),
      execFn: makeExec({
        scoreFor: (_, repo) => (repo === "react" ? 95 : 87),
      }),
      clock: () => generatedAt,
    });

    expect(result.ok).toBe(true);
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(0);
    expect(result.rows[0]?.repo).toBe("react");
    expect(result.rows[0]?.score).toBe(95);

    const datedJson = await readFile(
      join(workdir, "out", "2026-05-11.json"),
      "utf8",
    );
    const parsed = JSON.parse(datedJson);
    expect(parsed.generatedAt).toBe("2026-05-11T06:00:00.000Z");
    expect(parsed.cliVersion).toBe("1.2.3");
    expect(parsed.rows).toHaveLength(2);
  });

  it("writes both <date>.json and latest.json with identical content", async () => {
    await runLeaderboard({
      token: "ghp",
      limit: 1,
      cliPath: "/fake/agentlint",
      outDir: join(workdir, "out"),
      htmlDir: join(workdir, "html"),
      workDir: join(workdir, "work"),
      fetchFn: makeFetch([[ONE_REPO], []]),
      execFn: makeExec({ scoreFor: () => 91 }),
      clock: () => new Date("2026-05-11T06:00:00.000Z"),
    });
    const dated = await readFile(
      join(workdir, "out", "2026-05-11.json"),
      "utf8",
    );
    const latest = await readFile(join(workdir, "out", "latest.json"), "utf8");
    expect(latest).toBe(dated);
  });

  it("writes leaderboard.html under htmlDir", async () => {
    await runLeaderboard({
      token: "ghp",
      limit: 1,
      cliPath: "/fake/agentlint",
      outDir: join(workdir, "out"),
      htmlDir: join(workdir, "html"),
      workDir: join(workdir, "work"),
      fetchFn: makeFetch([[ONE_REPO], []]),
      execFn: makeExec({ scoreFor: () => 91 }),
      clock: () => new Date("2026-05-11T06:00:00.000Z"),
    });
    const html = await readFile(
      join(workdir, "html", "leaderboard.html"),
      "utf8",
    );
    expect(html).toContain("<table");
    expect(html).toContain("react");
  });

  it("returns ok:false when all scans fail (clone errors)", async () => {
    const result = await runLeaderboard({
      token: "ghp",
      limit: 2,
      cliPath: "/fake",
      outDir: join(workdir, "out"),
      htmlDir: join(workdir, "html"),
      workDir: join(workdir, "work"),
      fetchFn: makeFetch([TWO_REPOS, []]),
      execFn: makeExec({ cloneFails: () => true }),
      clock: () => new Date("2026-05-11T06:00:00.000Z"),
    });
    expect(result.ok).toBe(false);
    expect(result.successCount).toBe(0);
    expect(result.failureCount).toBe(2);
  });

  it("returns ok:true and records failed rows when scans are mixed", async () => {
    const result = await runLeaderboard({
      token: "ghp",
      limit: 2,
      cliPath: "/fake",
      outDir: join(workdir, "out"),
      htmlDir: join(workdir, "html"),
      workDir: join(workdir, "work"),
      fetchFn: makeFetch([TWO_REPOS, []]),
      execFn: makeExec({
        scoreFor: (_, repo) => (repo === "react" ? 95 : 80),
        cloneFails: (_, repo) => repo === "next.js",
      }),
      clock: () => new Date("2026-05-11T06:00:00.000Z"),
    });
    expect(result.ok).toBe(true);
    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
    const failedRow = result.rows.find((r) => r.repo === "next.js");
    expect(failedRow?.score).toBeNull();
    expect(failedRow?.error).toMatch(/clone/);
  });

  it("propagates errors from fetchTopRepos and writes no files", async () => {
    const failingFetch: FetchFn = async () =>
      new Response("rate limited", { status: 403 });
    await expect(
      runLeaderboard({
        token: "ghp",
        limit: 1,
        cliPath: "/fake",
        outDir: join(workdir, "out"),
        htmlDir: join(workdir, "html"),
        workDir: join(workdir, "work"),
        fetchFn: failingFetch,
        execFn: makeExec({}),
      }),
    ).rejects.toThrow(/403/);
    await expect(readFile(join(workdir, "out", "latest.json"))).rejects.toThrow();
  });

  it("respects the limit parameter (scans no more than N repos)", async () => {
    const calls: string[] = [];
    const execTracking: ExecFn = async (cmd, args) => {
      if (cmd === "git") {
        const url = args[args.length - 2] ?? "";
        calls.push(url);
        return { stdout: "", stderr: "" };
      }
      return {
        stdout: JSON.stringify({ version: "1", score: 50, results: [] }),
        stderr: "",
      };
    };
    await runLeaderboard({
      token: "ghp",
      limit: 1,
      cliPath: "/fake",
      outDir: join(workdir, "out"),
      htmlDir: join(workdir, "html"),
      workDir: join(workdir, "work"),
      fetchFn: makeFetch([TWO_REPOS, []]),
      execFn: execTracking,
      clock: () => new Date("2026-05-11T06:00:00.000Z"),
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("facebook/react");
  });
});

describe("resolveEntryOptions", () => {
  it("reads GITHUB_TOKEN and limit from env, applies defaults", () => {
    const opts = resolveEntryOptions({
      env: { GITHUB_TOKEN: "abc" },
      cwd: "/repo",
    });
    expect(opts.token).toBe("abc");
    expect(opts.limit).toBe(100);
    expect(opts.cliPath).toBe("/repo/packages/cli/dist/index.js");
    expect(opts.outDir).toBe("/repo/tools/leaderboard/data/aggregated");
    expect(opts.htmlDir).toBe("/repo/tools/leaderboard/out");
  });

  it("honors LEADERBOARD_LIMIT override", () => {
    const opts = resolveEntryOptions({
      env: { GITHUB_TOKEN: "abc", LEADERBOARD_LIMIT: "5" },
      cwd: "/repo",
    });
    expect(opts.limit).toBe(5);
  });

  it("honors LEADERBOARD_OUTDIR and AGENTLINT_CLI_PATH overrides", () => {
    const opts = resolveEntryOptions({
      env: {
        GITHUB_TOKEN: "abc",
        LEADERBOARD_OUTDIR: "alt/out",
        AGENTLINT_CLI_PATH: "alt/cli.js",
      },
      cwd: "/repo",
    });
    expect(opts.outDir).toBe("/repo/alt/out");
    expect(opts.cliPath).toBe("/repo/alt/cli.js");
  });
});

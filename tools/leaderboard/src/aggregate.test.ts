import { describe, expect, it } from "vitest";
import { aggregate, type LeaderboardRow } from "./aggregate.js";

describe("aggregate", () => {
  const repos = [
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
  ];

  it("merges scan results with repo metadata, sorts by score desc", () => {
    const rows = aggregate({
      repos,
      scanResults: [
        {
          ok: true,
          owner: "vercel",
          repo: "next.js",
          version: "1.0.0",
          score: 87,
          results: [],
          passes: 20,
          fails: 1,
          skips: 0,
        },
        {
          ok: true,
          owner: "facebook",
          repo: "react",
          version: "1.0.0",
          score: 95,
          results: [],
          passes: 22,
          fails: 0,
          skips: 0,
        },
      ],
    });
    expect(rows.map((r) => r.repo)).toEqual(["react", "next.js"]);
    expect(rows[0]?.score).toBe(95);
    expect(rows[0]?.stars).toBe(230000);
    expect(rows[0]?.language).toBe("JavaScript");
  });

  it("includes failed scans at the bottom with score=null and a reason", () => {
    const rows = aggregate({
      repos,
      scanResults: [
        {
          ok: true,
          owner: "vercel",
          repo: "next.js",
          version: "1.0.0",
          score: 87,
          results: [],
          passes: 20,
          fails: 1,
          skips: 0,
        },
        {
          ok: false,
          owner: "facebook",
          repo: "react",
          error: "clone failed: timeout",
        },
      ],
    });
    expect(rows.map((r) => r.repo)).toEqual(["next.js", "react"]);
    expect(rows[1]?.score).toBeNull();
    expect(rows[1]?.error).toMatch(/clone failed/);
  });

  it("assigns 1-based ranks to scored rows; failed rows get null rank", () => {
    const rows: LeaderboardRow[] = aggregate({
      repos,
      scanResults: [
        {
          ok: true,
          owner: "vercel",
          repo: "next.js",
          version: "1.0.0",
          score: 87,
          results: [],
          passes: 20,
          fails: 1,
          skips: 0,
        },
        {
          ok: false,
          owner: "facebook",
          repo: "react",
          error: "boom",
        },
      ],
    });
    expect(rows[0]?.rank).toBe(1);
    expect(rows[1]?.rank).toBeNull();
  });
});

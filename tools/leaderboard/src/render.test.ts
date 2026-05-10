import { describe, expect, it } from "vitest";
import type { LeaderboardRow } from "./aggregate.js";
import { renderJson, renderTable } from "./render.js";

const SAMPLE: LeaderboardRow[] = [
  {
    rank: 1,
    owner: "facebook",
    repo: "react",
    stars: 230000,
    language: "JavaScript",
    score: 95,
    passes: 22,
    fails: 0,
    skips: 0,
    error: null,
  },
  {
    rank: 2,
    owner: "vercel",
    repo: "next.js",
    stars: 130000,
    language: "JavaScript",
    score: 87,
    passes: 20,
    fails: 1,
    skips: 0,
    error: null,
  },
  {
    rank: null,
    owner: "ghost",
    repo: "missing",
    stars: 5000,
    language: null,
    score: null,
    passes: null,
    fails: null,
    skips: null,
    error: "clone failed",
  },
];

describe("renderJson", () => {
  it("emits an object with metadata + rows array", () => {
    const out = renderJson({
      generatedAt: "2026-05-10T00:00:00Z",
      cliVersion: "1.0.0",
      rows: SAMPLE,
    });
    const parsed = JSON.parse(out);
    expect(parsed.generatedAt).toBe("2026-05-10T00:00:00Z");
    expect(parsed.cliVersion).toBe("1.0.0");
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows[0].repo).toBe("react");
  });
});

describe("renderTable", () => {
  it("renders an HTML table with one row per leaderboard entry", () => {
    const html = renderTable({
      generatedAt: "2026-05-10T00:00:00Z",
      cliVersion: "1.0.0",
      rows: SAMPLE,
    });
    expect(html).toContain("<table");
    expect(html).toContain("react");
    expect(html).toContain("next.js");
    expect(html).toContain("missing");
    expect(html).toContain("95");
    expect(html).toContain("87");
    expect(html).toContain("clone failed");
  });

  it("escapes HTML in error messages and repo names", () => {
    const html = renderTable({
      generatedAt: "2026-05-10T00:00:00Z",
      cliVersion: "1.0.0",
      rows: [
        {
          rank: null,
          owner: "owner",
          repo: "<script>x</script>",
          stars: 0,
          language: null,
          score: null,
          passes: null,
          fails: null,
          skips: null,
          error: "<img src=x onerror=alert(1)>",
        },
      ],
    });
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<img src=x");
  });
});

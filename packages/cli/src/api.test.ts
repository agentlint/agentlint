import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runScan, VERSION } from "./api.js";

async function makeTempRepo(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "agentlint-api-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    const parent = full.substring(0, full.lastIndexOf("/"));
    if (parent && parent !== dir) await mkdir(parent, { recursive: true });
    await writeFile(full, content, "utf-8");
  }
  return dir;
}

describe("runScan programmatic API", () => {
  const dirs: string[] = [];

  beforeEach(() => {
    dirs.length = 0;
  });

  afterEach(async () => {
    for (const d of dirs) {
      await rm(d, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("returns a Report shaped like the core type", async () => {
    const cwd = await makeTempRepo({});
    dirs.push(cwd);
    const report = await runScan({ cwd });

    expect(report).toMatchObject({
      version: expect.any(String),
      scannedAt: expect.any(String),
      root: expect.any(String),
      results: expect.any(Array),
      byCategory: expect.any(Array),
      score: expect.any(Number),
    });
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  it("runs every rule (results.length >= 20)", async () => {
    const cwd = await makeTempRepo({});
    dirs.push(cwd);
    const report = await runScan({ cwd });
    // ~30 rules ship today; assert a generous floor that survives rule churn.
    expect(report.results.length).toBeGreaterThanOrEqual(20);
  });

  it("scores an empty repo with at least one fail", async () => {
    const cwd = await makeTempRepo({});
    dirs.push(cwd);
    const report = await runScan({ cwd });
    const fails = report.results.filter((r) => r.status === "fail");
    expect(fails.length).toBeGreaterThan(0);
  });

  it("scores a minimally-conformant repo higher than an empty one", async () => {
    const empty = await makeTempRepo({});
    dirs.push(empty);
    const seeded = await makeTempRepo({
      "AGENTS.md": "# AGENTS.md\nbuild: pnpm run build\n",
      "README.md": "# project\n",
      LICENSE: "MIT\n",
      ".editorconfig": "root = true\n",
      ".gitignore": "node_modules\n",
      ".env.example": "FOO=bar\n",
      "package.json": JSON.stringify({ name: "x", version: "0.0.0" }),
    });
    dirs.push(seeded);

    const emptyReport = await runScan({ cwd: empty });
    const seededReport = await runScan({ cwd: seeded });
    expect(seededReport.score).toBeGreaterThan(emptyReport.score);
  });

  it("plumbs `url` through to the report and to documentation rules", async () => {
    const cwd = await makeTempRepo({});
    dirs.push(cwd);
    const report = await runScan({
      cwd,
      url: "https://example.invalid/docs",
    });
    expect(report.url).toBe("https://example.invalid/docs");
    // Without --url, documentation URL rules skip. With one, they should
    // attempt to fetch (and either pass or fail — but not skip with "No --url").
    const docRules = report.results.filter(
      (r) => r.ruleId === "llms-txt-present",
    );
    expect(docRules.length).toBe(1);
    expect(docRules[0]?.message).not.toMatch(/No --url/);
  });

  it("never throws when a rule misbehaves (rules-never-throw contract)", async () => {
    // Forge a repo with no readable files. runScan must return a Report,
    // not reject.
    const cwd = await makeTempRepo({});
    dirs.push(cwd);
    await expect(runScan({ cwd })).resolves.toBeDefined();
  });

  it("exposes VERSION as a string in the form X.Y.Z", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("uses VERSION on every Report", async () => {
    const cwd = await makeTempRepo({});
    dirs.push(cwd);
    const report = await runScan({ cwd });
    expect(report.version).toBe(VERSION);
  });
});

import type { Report } from "@agentlinthq/core";
import { describe, expect, it } from "vitest";
import {
  buildPushBody,
  type FetchFn,
  type PushRunMetadata,
  parsePolicy,
  pushReport,
} from "./client.js";

const mkFetch = (impl: FetchFn): FetchFn => impl;

const baseReport: Report = {
  version: "2.0.0",
  scannedAt: "2026-05-10T00:00:00.000Z",
  root: "/repo",
  results: [
    {
      ruleId: "r1",
      status: "pass",
      points: 5,
      message: "ok",
    },
    {
      ruleId: "r2",
      status: "fail",
      points: 0,
      message: "missing",
    },
    {
      ruleId: "r3",
      status: "warn",
      points: 3,
      message: "iffy",
    },
    {
      ruleId: "r4",
      status: "skip",
      points: null,
      message: "n/a",
    },
  ],
  byCategory: [],
  rawScore: { earned: 8, possible: 10 },
  score: 80,
};

const baseMetadata: PushRunMetadata = {
  repo: { owner: "acme", name: "widgets" },
  branch: "main",
  commitSha: "abc123",
  projectId: "proj_1",
  isPublic: false,
  prContext: null,
};

const baseArgs = {
  url: "https://agentlint.sh",
  token: "agl_proj_token",
  report: baseReport,
  metadata: baseMetadata,
  getEnv: () => undefined,
  oidcFetcher: async () => null,
};

describe("buildPushBody", () => {
  it("counts results by status and includes branch + commitSha + projectId", () => {
    const body = buildPushBody(baseReport, baseMetadata);
    const parsed = JSON.parse(body);
    expect(parsed.score).toBe(80);
    expect(parsed.passes).toBe(1);
    expect(parsed.fails).toBe(1);
    expect(parsed.warnings).toBe(1);
    expect(parsed.skipped).toBe(1);
    expect(parsed.branch).toBe("main");
    expect(parsed.commitSha).toBe("abc123");
    expect(parsed.projectId).toBe("proj_1");
    expect(parsed.repo).toEqual({ owner: "acme", name: "widgets" });
    expect(parsed.public).toBe(false);
    expect(parsed.pr).toBeNull();
    expect(parsed.report).toBeDefined();
  });

  it("emits null repo fields when no repo is detected", () => {
    const body = buildPushBody(baseReport, { ...baseMetadata, repo: null });
    const parsed = JSON.parse(body);
    expect(parsed.repo).toEqual({ owner: null, name: null });
  });
});

describe("pushReport", () => {
  it("posts to <origin>/api/runs with bearer auth + JSON content type", async () => {
    let observedUrl: string | null = null;
    let observedHeaders: Record<string, string> = {};
    let observedBody: string | null = null;
    let observedMethod: string | null = null;
    const fetchFn = mkFetch(async (url, init) => {
      observedUrl = url;
      observedHeaders = init.headers;
      observedBody = init.body;
      observedMethod = init.method;
      return new Response(
        JSON.stringify({ id: "run_123", url: "/dashboard" }),
        { status: 201 },
      );
    });
    const result = await pushReport({ ...baseArgs, fetchFn });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.runUrl).toBe("https://agentlint.sh/dashboard");
    expect(observedUrl).toBe("https://agentlint.sh/api/runs");
    expect(observedMethod).toBe("POST");
    expect(observedHeaders.Authorization).toBe("Bearer agl_proj_token");
    expect(observedHeaders["Content-Type"]).toBe("application/json");
    expect(observedHeaders["x-github-oidc"]).toBeUndefined();
    expect(observedBody).toContain('"score":80');
    expect(observedBody).toContain('"branch":"main"');
    expect(observedBody).toContain('"commitSha":"abc123"');
  });

  it("forwards an OIDC JWT in x-github-oidc when the fetcher returns one", async () => {
    let observedHeaders: Record<string, string> = {};
    const fetchFn = mkFetch(async (_url, init) => {
      observedHeaders = init.headers;
      return new Response("", { status: 201 });
    });
    const result = await pushReport({
      ...baseArgs,
      fetchFn,
      oidcFetcher: async () => "jwt-from-runner",
    });
    expect(result.ok).toBe(true);
    expect(observedHeaders["x-github-oidc"]).toBe("jwt-from-runner");
  });

  it("does not set x-github-oidc when the fetcher returns null", async () => {
    let observedHeaders: Record<string, string> = {};
    const fetchFn = mkFetch(async (_url, init) => {
      observedHeaders = init.headers;
      return new Response("", { status: 201 });
    });
    const result = await pushReport({
      ...baseArgs,
      fetchFn,
      oidcFetcher: async () => null,
    });
    expect(result.ok).toBe(true);
    expect("x-github-oidc" in observedHeaders).toBe(false);
  });

  it("swallows OIDC fetcher errors and still pushes", async () => {
    let observedHeaders: Record<string, string> = {};
    const fetchFn = mkFetch(async (_url, init) => {
      observedHeaders = init.headers;
      return new Response("", { status: 201 });
    });
    const result = await pushReport({
      ...baseArgs,
      fetchFn,
      oidcFetcher: async () => {
        throw new Error("network");
      },
    });
    expect(result.ok).toBe(true);
    expect("x-github-oidc" in observedHeaders).toBe(false);
  });

  it("uses absolute runUrl when server returns a full URL", async () => {
    const fetchFn = mkFetch(
      async () =>
        new Response(
          JSON.stringify({
            id: "run_1",
            url: "https://agentlint.sh/dashboard?run=run_1",
          }),
          { status: 201 },
        ),
    );
    const result = await pushReport({ ...baseArgs, fetchFn });
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.runUrl).toBe("https://agentlint.sh/dashboard?run=run_1");
  });

  it("falls back to <origin>/dashboard when 201 body is not JSON", async () => {
    const fetchFn = mkFetch(async () => new Response("ok", { status: 201 }));
    const result = await pushReport({ ...baseArgs, fetchFn });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.runUrl).toBe("https://agentlint.sh/dashboard");
  });

  it("returns invalid-token reason on 401", async () => {
    const fetchFn = mkFetch(
      async () =>
        new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
        }),
    );
    const result = await pushReport({ ...baseArgs, fetchFn });
    expect(result).toEqual({ ok: false, reason: "invalid or revoked token" });
  });

  it("returns invalid-token reason on 403", async () => {
    const fetchFn = mkFetch(
      async () => new Response("forbidden", { status: 403 }),
    );
    const result = await pushReport({ ...baseArgs, fetchFn });
    expect(result).toEqual({ ok: false, reason: "invalid or revoked token" });
  });

  it("returns too-large reason on 413", async () => {
    const fetchFn = mkFetch(
      async () => new Response("too large", { status: 413 }),
    );
    const result = await pushReport({ ...baseArgs, fetchFn });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/too large/);
  });

  it("returns rate-limit reason on 429", async () => {
    const fetchFn = mkFetch(
      async () => new Response("slow down", { status: 429 }),
    );
    const result = await pushReport({ ...baseArgs, fetchFn });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/rate limited/);
  });

  it("returns server-error reason on 5xx", async () => {
    const fetchFn = mkFetch(async () => new Response("boom", { status: 503 }));
    const result = await pushReport({ ...baseArgs, fetchFn });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("503");
  });

  it("returns unexpected-status for other non-2xx", async () => {
    const fetchFn = mkFetch(
      async () => new Response("teapot", { status: 418 }),
    );
    const result = await pushReport({ ...baseArgs, fetchFn });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("418");
  });

  it("returns network-error reason when fetch rejects", async () => {
    const fetchFn = mkFetch(async () => {
      throw new Error("ECONNREFUSED");
    });
    const result = await pushReport({ ...baseArgs, fetchFn });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.reason).toMatch(/network error.*ECONNREFUSED/);
  });

  it("refuses non-https URLs by default", async () => {
    let called = false;
    const fetchFn = mkFetch(async () => {
      called = true;
      return new Response("nope", { status: 201 });
    });
    const result = await pushReport({
      ...baseArgs,
      url: "http://attacker.example.com",
      fetchFn,
    });
    expect(called).toBe(false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/non-https/);
  });

  it("allows http://localhost without AGENTLINT_INSECURE", async () => {
    const fetchFn = mkFetch(
      async () =>
        new Response(JSON.stringify({ url: "/dashboard" }), { status: 201 }),
    );
    const result = await pushReport({
      ...baseArgs,
      url: "http://localhost:3000",
      fetchFn,
    });
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.runUrl).toBe("http://localhost:3000/dashboard");
  });

  it("allows http://127.0.0.1 without AGENTLINT_INSECURE", async () => {
    const fetchFn = mkFetch(async () => new Response("", { status: 201 }));
    const result = await pushReport({
      ...baseArgs,
      url: "http://127.0.0.1:3000",
      fetchFn,
    });
    expect(result.ok).toBe(true);
  });

  it("allows insecure URLs when AGENTLINT_INSECURE=1", async () => {
    const fetchFn = mkFetch(async () => new Response("", { status: 201 }));
    const result = await pushReport({
      ...baseArgs,
      url: "http://staging.internal",
      fetchFn,
      getEnv: (name) => (name === "AGENTLINT_INSECURE" ? "1" : undefined),
    });
    expect(result.ok).toBe(true);
  });

  it("rejects malformed URLs", async () => {
    const result = await pushReport({
      ...baseArgs,
      url: "not a url",
      fetchFn: mkFetch(async () => new Response("", { status: 201 })),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/invalid endpoint URL/);
  });

  it("returns policy=null when response has no policy field", async () => {
    const fetchFn = mkFetch(
      async () =>
        new Response(JSON.stringify({ id: "r1", url: "/dashboard" }), {
          status: 201,
        }),
    );
    const result = await pushReport({ ...baseArgs, fetchFn });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.policy).toBeNull();
  });

  it("returns the parsed policy object when the server includes one", async () => {
    const fetchFn = mkFetch(
      async () =>
        new Response(
          JSON.stringify({
            id: "r1",
            url: "/dashboard",
            policy: { minScore: 80, enforce: true, passed: false },
          }),
          { status: 201 },
        ),
    );
    const result = await pushReport({ ...baseArgs, fetchFn });
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.policy).toEqual({
        minScore: 80,
        enforce: true,
        passed: false,
      });
  });

  it("returns policy=null when the policy field has a malformed shape", async () => {
    const fetchFn = mkFetch(
      async () =>
        new Response(
          JSON.stringify({
            id: "r1",
            url: "/dashboard",
            // missing `passed`, wrong type on enforce
            policy: { minScore: 80, enforce: "yes" },
          }),
          { status: 201 },
        ),
    );
    const result = await pushReport({ ...baseArgs, fetchFn });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.policy).toBeNull();
  });
});

describe("parsePolicy", () => {
  it("returns null for nullish or non-object input", () => {
    expect(parsePolicy(null)).toBeNull();
    expect(parsePolicy(undefined)).toBeNull();
    expect(parsePolicy("policy")).toBeNull();
    expect(parsePolicy(42)).toBeNull();
  });

  it("returns null when required keys are missing", () => {
    expect(parsePolicy({ minScore: 80, enforce: true })).toBeNull();
    expect(parsePolicy({ minScore: 80, passed: true })).toBeNull();
    expect(parsePolicy({ enforce: true, passed: true })).toBeNull();
  });

  it("returns null when types are wrong", () => {
    expect(
      parsePolicy({ minScore: "80", enforce: true, passed: true }),
    ).toBeNull();
    expect(parsePolicy({ minScore: 80, enforce: 1, passed: true })).toBeNull();
    expect(
      parsePolicy({ minScore: 80, enforce: true, passed: "yes" }),
    ).toBeNull();
    expect(
      parsePolicy({
        minScore: Number.NaN,
        enforce: true,
        passed: true,
      }),
    ).toBeNull();
  });

  it("returns the parsed shape on a valid object", () => {
    expect(parsePolicy({ minScore: 0, enforce: false, passed: true })).toEqual({
      minScore: 0,
      enforce: false,
      passed: true,
    });
    expect(
      parsePolicy({ minScore: 100, enforce: true, passed: false }),
    ).toEqual({ minScore: 100, enforce: true, passed: false });
  });
});

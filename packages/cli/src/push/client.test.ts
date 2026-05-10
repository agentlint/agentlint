import { describe, expect, it } from "vitest";
import { type FetchFn, pushReport } from "./client.js";

const mkFetch = (impl: FetchFn): FetchFn => impl;

const baseArgs = {
  url: "https://agentlint.sh",
  token: "agl_test_token",
  body: JSON.stringify({ score: 100 }),
  getEnv: () => undefined,
};

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
        {
          status: 201,
        },
      );
    });
    const result = await pushReport({ ...baseArgs, fetchFn });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.runUrl).toBe("https://agentlint.sh/dashboard");
    expect(observedUrl).toBe("https://agentlint.sh/api/runs");
    expect(observedMethod).toBe("POST");
    expect(observedHeaders.Authorization).toBe("Bearer agl_test_token");
    expect(observedHeaders["Content-Type"]).toBe("application/json");
    expect(observedBody).toBe(JSON.stringify({ score: 100 }));
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
});

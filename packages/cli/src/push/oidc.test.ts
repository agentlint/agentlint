import { describe, expect, it } from "vitest";
import { type FetchFn, fetchGithubOidcToken } from "./oidc.js";

const mkFetch = (impl: FetchFn): FetchFn => impl;

const baseEnv: Record<string, string> = {
  GITHUB_ACTIONS: "true",
  ACTIONS_ID_TOKEN_REQUEST_URL: "https://actions.github.com/oidc/token",
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: "request-bearer-token",
};

describe("fetchGithubOidcToken", () => {
  it("returns null when GITHUB_ACTIONS is not set", async () => {
    const result = await fetchGithubOidcToken({
      getEnv: () => undefined,
      fetchFn: mkFetch(async () => new Response("", { status: 200 })),
    });
    expect(result).toBeNull();
  });

  it("returns null when GITHUB_ACTIONS is not 'true'", async () => {
    const result = await fetchGithubOidcToken({
      getEnv: (n) => (n === "GITHUB_ACTIONS" ? "false" : undefined),
      fetchFn: mkFetch(async () => new Response("", { status: 200 })),
    });
    expect(result).toBeNull();
  });

  it("returns null when ACTIONS_ID_TOKEN_REQUEST_URL is missing", async () => {
    const env: Record<string, string> = { ...baseEnv };
    delete env.ACTIONS_ID_TOKEN_REQUEST_URL;
    const result = await fetchGithubOidcToken({
      getEnv: (n) => env[n],
      fetchFn: mkFetch(async () => new Response("", { status: 200 })),
    });
    expect(result).toBeNull();
  });

  it("returns null when ACTIONS_ID_TOKEN_REQUEST_TOKEN is missing", async () => {
    const env: Record<string, string> = { ...baseEnv };
    delete env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
    const result = await fetchGithubOidcToken({
      getEnv: (n) => env[n],
      fetchFn: mkFetch(async () => new Response("", { status: 200 })),
    });
    expect(result).toBeNull();
  });

  it("requests with audience=agentlint by default", async () => {
    let observedUrl: string | null = null;
    let observedAuth: string | null = null;
    const result = await fetchGithubOidcToken({
      getEnv: (n) => baseEnv[n],
      fetchFn: mkFetch(async (url, init) => {
        observedUrl = url;
        observedAuth = init.headers.Authorization ?? null;
        return new Response(JSON.stringify({ value: "jwt-abc" }), {
          status: 200,
        });
      }),
    });
    expect(result).toBe("jwt-abc");
    expect(observedUrl).toContain("audience=agentlint");
    expect(observedAuth).toBe("Bearer request-bearer-token");
  });

  it("honors a custom audience", async () => {
    let observedUrl: string | null = null;
    await fetchGithubOidcToken({
      getEnv: (n) => baseEnv[n],
      audience: "custom",
      fetchFn: mkFetch(async (url) => {
        observedUrl = url;
        return new Response(JSON.stringify({ value: "jwt" }), { status: 200 });
      }),
    });
    expect(observedUrl).toContain("audience=custom");
  });

  it("returns null on HTTP error status", async () => {
    const result = await fetchGithubOidcToken({
      getEnv: (n) => baseEnv[n],
      fetchFn: mkFetch(async () => new Response("nope", { status: 500 })),
    });
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    const result = await fetchGithubOidcToken({
      getEnv: (n) => baseEnv[n],
      fetchFn: mkFetch(async () => {
        throw new Error("ECONNRESET");
      }),
    });
    expect(result).toBeNull();
  });

  it("returns null when response is not JSON", async () => {
    const result = await fetchGithubOidcToken({
      getEnv: (n) => baseEnv[n],
      fetchFn: mkFetch(async () => new Response("plain text", { status: 200 })),
    });
    expect(result).toBeNull();
  });

  it("returns null when response is missing the value field", async () => {
    const result = await fetchGithubOidcToken({
      getEnv: (n) => baseEnv[n],
      fetchFn: mkFetch(
        async () =>
          new Response(JSON.stringify({ other: "x" }), { status: 200 }),
      ),
    });
    expect(result).toBeNull();
  });

  it("returns null when value is empty", async () => {
    const result = await fetchGithubOidcToken({
      getEnv: (n) => baseEnv[n],
      fetchFn: mkFetch(
        async () =>
          new Response(JSON.stringify({ value: "" }), { status: 200 }),
      ),
    });
    expect(result).toBeNull();
  });

  it("returns null when base URL is malformed", async () => {
    const env: Record<string, string> = {
      ...baseEnv,
      ACTIONS_ID_TOKEN_REQUEST_URL: "not a url",
    };
    const result = await fetchGithubOidcToken({
      getEnv: (n) => env[n],
      fetchFn: mkFetch(async () => new Response("", { status: 200 })),
    });
    expect(result).toBeNull();
  });
});

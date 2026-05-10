import { describe, expect, it } from "vitest";
import { type FetchFn, lookupProject } from "./project-lookup.js";

const mkFetch = (impl: FetchFn): FetchFn => impl;

const baseArgs = {
  url: "https://agentlint.sh",
  token: "agl_proj_token",
  repoOwner: "acme",
  repoName: "widgets",
};

describe("lookupProject", () => {
  it("GETs /api/cli/projects with the repo query params + bearer auth", async () => {
    let observedUrl: string | null = null;
    let observedAuth: string | null = null;
    let observedMethod: string | null = null;
    const fetchFn = mkFetch(async (url, init) => {
      observedUrl = url;
      observedAuth = init.headers.Authorization ?? null;
      observedMethod = init.method;
      return new Response(
        JSON.stringify({
          projectId: "proj_1",
          orgSlug: "acme",
          repoOwner: "acme",
          repoName: "widgets",
          prodBranch: "main",
        }),
        { status: 200 },
      );
    });
    const result = await lookupProject({ ...baseArgs, fetchFn });
    expect(result.kind).toBe("found");
    if (result.kind === "found") {
      expect(result.project.projectId).toBe("proj_1");
      expect(result.project.orgSlug).toBe("acme");
      expect(result.project.prodBranch).toBe("main");
    }
    expect(observedMethod).toBe("GET");
    expect(observedUrl).toContain("/api/cli/projects");
    expect(observedUrl).toContain("repoOwner=acme");
    expect(observedUrl).toContain("repoName=widgets");
    expect(observedAuth).toBe("Bearer agl_proj_token");
  });

  it("returns not-found on 404", async () => {
    const fetchFn = mkFetch(
      async () => new Response("not found", { status: 404 }),
    );
    const result = await lookupProject({ ...baseArgs, fetchFn });
    expect(result.kind).toBe("not-found");
  });

  it("returns unauthorized on 401", async () => {
    const fetchFn = mkFetch(async () => new Response("no", { status: 401 }));
    const result = await lookupProject({ ...baseArgs, fetchFn });
    expect(result.kind).toBe("unauthorized");
  });

  it("returns unauthorized on 403", async () => {
    const fetchFn = mkFetch(async () => new Response("no", { status: 403 }));
    const result = await lookupProject({ ...baseArgs, fetchFn });
    expect(result.kind).toBe("unauthorized");
  });

  it("returns error on 5xx", async () => {
    const fetchFn = mkFetch(async () => new Response("boom", { status: 503 }));
    const result = await lookupProject({ ...baseArgs, fetchFn });
    expect(result.kind).toBe("error");
    if (result.kind === "error") expect(result.reason).toContain("503");
  });

  it("returns error on unexpected status", async () => {
    const fetchFn = mkFetch(
      async () => new Response("teapot", { status: 418 }),
    );
    const result = await lookupProject({ ...baseArgs, fetchFn });
    expect(result.kind).toBe("error");
    if (result.kind === "error") expect(result.reason).toContain("418");
  });

  it("returns error on network failure", async () => {
    const fetchFn = mkFetch(async () => {
      throw new Error("ECONNRESET");
    });
    const result = await lookupProject({ ...baseArgs, fetchFn });
    expect(result.kind).toBe("error");
    if (result.kind === "error") expect(result.reason).toContain("ECONNRESET");
  });

  it("returns error when response is missing projectId", async () => {
    const fetchFn = mkFetch(
      async () => new Response(JSON.stringify({}), { status: 200 }),
    );
    const result = await lookupProject({ ...baseArgs, fetchFn });
    expect(result.kind).toBe("error");
  });

  it("returns error on invalid JSON response", async () => {
    const fetchFn = mkFetch(
      async () => new Response("not json", { status: 200 }),
    );
    const result = await lookupProject({ ...baseArgs, fetchFn });
    expect(result.kind).toBe("error");
  });

  it("returns error on malformed endpoint URL", async () => {
    const result = await lookupProject({
      ...baseArgs,
      url: "not a url",
    });
    expect(result.kind).toBe("error");
  });
});

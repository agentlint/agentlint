import { describe, expect, it } from "vitest";
import { detectPrContext, type GetEnvFn } from "./pr-detect.js";

function makeEnv(map: Record<string, string | undefined>): GetEnvFn {
  return (name: string) => map[name];
}

describe("detectPrContext", () => {
  it("returns null when no signals are present", () => {
    expect(detectPrContext(makeEnv({}))).toBeNull();
  });

  it("happy path: GitHub Actions pull_request event", () => {
    const env = makeEnv({
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_REF: "refs/pull/42/merge",
      GITHUB_SHA: "cafef00d",
      GITHUB_BASE_REF: "main",
    });
    expect(detectPrContext(env)).toEqual({
      number: 42,
      baseSha: "main",
      headSha: "cafef00d",
    });
  });

  it("accepts the refs/pull/<n>/head form (forks, draft PRs)", () => {
    const env = makeEnv({
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_REF: "refs/pull/3/head",
      GITHUB_SHA: "deadbeef",
    });
    const ctx = detectPrContext(env);
    expect(ctx?.number).toBe(3);
    expect(ctx?.headSha).toBe("deadbeef");
  });

  it("accepts pull_request_target as a pull_request variant", () => {
    const env = makeEnv({
      GITHUB_EVENT_NAME: "pull_request_target",
      GITHUB_REF: "refs/pull/9/merge",
    });
    expect(detectPrContext(env)?.number).toBe(9);
  });

  it("returns null for malformed GITHUB_REF", () => {
    const env = makeEnv({
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_REF: "refs/heads/main",
    });
    expect(detectPrContext(env)).toBeNull();
  });

  it("returns null for refs/pull/<n>/<other>", () => {
    const env = makeEnv({
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_REF: "refs/pull/5/preview",
    });
    expect(detectPrContext(env)).toBeNull();
  });

  it("AGENTLINT_PR overrides GitHub Actions detection", () => {
    const env = makeEnv({
      AGENTLINT_PR: "100",
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_REF: "refs/pull/42/merge",
      GITHUB_SHA: "abc123",
      GITHUB_BASE_REF: "main",
    });
    expect(detectPrContext(env)).toEqual({
      number: 100,
      baseSha: "main",
      headSha: "abc123",
    });
  });

  it("AGENTLINT_PR alone (no GHA env) still produces a valid context", () => {
    const env = makeEnv({ AGENTLINT_PR: "7" });
    expect(detectPrContext(env)).toEqual({
      number: 7,
      baseSha: null,
      headSha: null,
    });
  });

  it("AGENTLINT_PR with non-numeric value returns null (does not fall through)", () => {
    const env = makeEnv({ AGENTLINT_PR: "not-a-number" });
    expect(detectPrContext(env)).toBeNull();
  });

  it("AGENTLINT_PR with 0 or negative value returns null", () => {
    expect(detectPrContext(makeEnv({ AGENTLINT_PR: "0" }))).toBeNull();
    expect(detectPrContext(makeEnv({ AGENTLINT_PR: "-1" }))).toBeNull();
  });

  it("returns null on a push event (not a PR)", () => {
    const env = makeEnv({
      GITHUB_EVENT_NAME: "push",
      GITHUB_REF: "refs/heads/main",
      GITHUB_SHA: "abc",
    });
    expect(detectPrContext(env)).toBeNull();
  });

  it("trims whitespace in env values", () => {
    const env = makeEnv({
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_REF: "  refs/pull/42/merge  ",
      GITHUB_SHA: "  cafef00d  ",
    });
    const ctx = detectPrContext(env);
    expect(ctx?.number).toBe(42);
    expect(ctx?.headSha).toBe("cafef00d");
  });

  it("treats empty-string env values as missing", () => {
    const env = makeEnv({ AGENTLINT_PR: "   " });
    expect(detectPrContext(env)).toBeNull();
  });
});

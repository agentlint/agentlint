import { describe, expect, it } from "vitest";
import { missingTokenMessage, resolveToken, TOKEN_ENV_VAR } from "./token.js";

describe("resolveToken", () => {
  it("returns null when AGENTLINT_TOKEN is unset and no file exists", async () => {
    const token = await resolveToken({
      getEnv: () => undefined,
      readTokenFile: async () => null,
    });
    expect(token).toBeNull();
  });

  it("returns the env var value when set", async () => {
    const token = await resolveToken({
      getEnv: (name) =>
        name === TOKEN_ENV_VAR
          ? "agl_proj_0123456789abcdef0123456789abcdef0123456789abcdef01"
          : undefined,
      readTokenFile: async () => null,
    });
    expect(token).toBe(
      "agl_proj_0123456789abcdef0123456789abcdef0123456789abcdef01",
    );
  });

  it("trims whitespace and newlines from the env value", async () => {
    const token = await resolveToken({
      getEnv: (name) =>
        name === TOKEN_ENV_VAR ? "  agl_proj_env_token \n" : undefined,
      readTokenFile: async () => null,
    });
    expect(token).toBe("agl_proj_env_token");
  });

  it("treats whitespace-only env value as unset and falls through", async () => {
    const token = await resolveToken({
      getEnv: (name) => (name === TOKEN_ENV_VAR ? "   " : undefined),
      readTokenFile: async () => null,
    });
    expect(token).toBeNull();
  });

  it("treats empty string env value as unset and falls through", async () => {
    const token = await resolveToken({
      getEnv: (name) => (name === TOKEN_ENV_VAR ? "" : undefined),
      readTokenFile: async () => null,
    });
    expect(token).toBeNull();
  });

  it("ignores unrelated env vars", async () => {
    const token = await resolveToken({
      getEnv: (name) =>
        name === "SOME_OTHER_VAR" ? "agl_proj_decoy" : undefined,
      readTokenFile: async () => null,
    });
    expect(token).toBeNull();
  });

  it("falls back to the token file when env is unset", async () => {
    const token = await resolveToken({
      getEnv: () => undefined,
      readTokenFile: async () => "agl_proj_from_file",
    });
    expect(token).toBe("agl_proj_from_file");
  });

  it("env wins over the token file", async () => {
    const token = await resolveToken({
      getEnv: (name) =>
        name === TOKEN_ENV_VAR ? "agl_proj_from_env" : undefined,
      readTokenFile: async () => "agl_proj_from_file",
    });
    expect(token).toBe("agl_proj_from_env");
  });

  it("--token flag wins over env and file", async () => {
    const token = await resolveToken({
      flag: "agl_proj_from_flag",
      getEnv: (name) =>
        name === TOKEN_ENV_VAR ? "agl_proj_from_env" : undefined,
      readTokenFile: async () => "agl_proj_from_file",
    });
    expect(token).toBe("agl_proj_from_flag");
  });

  it("ignores whitespace-only --token flag and falls through", async () => {
    const token = await resolveToken({
      flag: "   ",
      getEnv: () => undefined,
      readTokenFile: async () => "agl_proj_from_file",
    });
    expect(token).toBe("agl_proj_from_file");
  });
});

describe("missingTokenMessage", () => {
  it("mentions the env var and the login command", () => {
    const msg = missingTokenMessage();
    expect(msg).toContain(TOKEN_ENV_VAR);
    expect(msg).toContain("agentlint login");
  });
});

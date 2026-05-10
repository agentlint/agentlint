import { describe, expect, it } from "vitest";
import { missingTokenMessage, resolveToken, TOKEN_ENV_VAR } from "./token.js";

describe("resolveToken", () => {
  it("returns null when AGENTLINT_TOKEN is unset", async () => {
    const token = await resolveToken({ getEnv: () => undefined });
    expect(token).toBeNull();
  });

  it("returns the env var value when set", async () => {
    const token = await resolveToken({
      getEnv: (name) =>
        name === TOKEN_ENV_VAR
          ? "agl_proj_0123456789abcdef0123456789abcdef0123456789abcdef01"
          : undefined,
    });
    expect(token).toBe(
      "agl_proj_0123456789abcdef0123456789abcdef0123456789abcdef01",
    );
  });

  it("trims whitespace and newlines from the env value", async () => {
    const token = await resolveToken({
      getEnv: (name) =>
        name === TOKEN_ENV_VAR ? "  agl_proj_env_token \n" : undefined,
    });
    expect(token).toBe("agl_proj_env_token");
  });

  it("treats whitespace-only env value as unset", async () => {
    const token = await resolveToken({
      getEnv: (name) => (name === TOKEN_ENV_VAR ? "   " : undefined),
    });
    expect(token).toBeNull();
  });

  it("treats empty string env value as unset", async () => {
    const token = await resolveToken({
      getEnv: (name) => (name === TOKEN_ENV_VAR ? "" : undefined),
    });
    expect(token).toBeNull();
  });

  it("ignores unrelated env vars", async () => {
    const token = await resolveToken({
      getEnv: (name) =>
        name === "SOME_OTHER_VAR" ? "agl_proj_decoy" : undefined,
    });
    expect(token).toBeNull();
  });
});

describe("missingTokenMessage", () => {
  it("mentions the env var and the init command", () => {
    const msg = missingTokenMessage();
    expect(msg).toContain(TOKEN_ENV_VAR);
    expect(msg).toContain("agentlint init");
  });
});

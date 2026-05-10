import { describe, expect, it } from "vitest";
import { resolveToken, TOKEN_ENV_VAR, tokenFilePath } from "./token.js";

const NOT_FOUND = (path: string) =>
  Promise.reject(new Error(`ENOENT: ${path}`));

describe("resolveToken", () => {
  it("returns null when neither env nor file is set", async () => {
    const token = await resolveToken({
      getEnv: () => undefined,
      readFileFn: NOT_FOUND,
      homeDir: "/home/test",
    });
    expect(token).toBeNull();
  });

  it("returns the env var when set, even if a token file also exists", async () => {
    const token = await resolveToken({
      getEnv: (name) => (name === TOKEN_ENV_VAR ? "agl_env_token" : undefined),
      readFileFn: async () => "agl_file_token\n",
      homeDir: "/home/test",
    });
    expect(token).toBe("agl_env_token");
  });

  it("trims whitespace and newlines from the env value", async () => {
    const token = await resolveToken({
      getEnv: (name) =>
        name === TOKEN_ENV_VAR ? "  agl_env_token \n" : undefined,
      readFileFn: NOT_FOUND,
      homeDir: "/home/test",
    });
    expect(token).toBe("agl_env_token");
  });

  it("falls back to the token file when env is unset", async () => {
    const token = await resolveToken({
      getEnv: () => undefined,
      readFileFn: async () => "agl_file_token\n",
      homeDir: "/home/test",
    });
    expect(token).toBe("agl_file_token");
  });

  it("treats an empty env value as unset and reads the file", async () => {
    const token = await resolveToken({
      getEnv: (name) => (name === TOKEN_ENV_VAR ? "   " : undefined),
      readFileFn: async () => "agl_file_token",
      homeDir: "/home/test",
    });
    expect(token).toBe("agl_file_token");
  });

  it("returns null when the token file is empty / whitespace", async () => {
    const token = await resolveToken({
      getEnv: () => undefined,
      readFileFn: async () => "   \n",
      homeDir: "/home/test",
    });
    expect(token).toBeNull();
  });

  it("returns null when reading the token file throws", async () => {
    const token = await resolveToken({
      getEnv: () => undefined,
      readFileFn: NOT_FOUND,
      homeDir: "/home/test",
    });
    expect(token).toBeNull();
  });

  it("reads the token file from ~/.config/agentlint/token", async () => {
    let observed: string | null = null;
    await resolveToken({
      getEnv: () => undefined,
      readFileFn: async (path) => {
        observed = path;
        return "agl_t";
      },
      homeDir: "/home/test",
    });
    expect(observed).toBe("/home/test/.config/agentlint/token");
  });
});

describe("tokenFilePath", () => {
  it("joins home with .config/agentlint/token", () => {
    expect(tokenFilePath("/home/alice")).toBe(
      "/home/alice/.config/agentlint/token",
    );
  });
});

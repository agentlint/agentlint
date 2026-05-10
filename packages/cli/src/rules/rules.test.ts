import { describe, expect, it } from "vitest";
import { mockCtx } from "../test-helpers.js";
import { editorconfig, linterConfig } from "./conventions.js";
import { agentsMdExists } from "./discoverability.js";
import { llmsTxtPresent } from "./documentation.js";
import { envExampleNoEnv, licenseDeclared } from "./safety.js";

describe("agents-md-exists", () => {
  it("passes when AGENTS.md exists with canonical name", async () => {
    const ctx = mockCtx({ files: { "AGENTS.md": "# AGENTS.md\n..." } });
    const r = await agentsMdExists.check(ctx);
    expect(r.status).toBe("pass");
    expect(r.points).toBe(10);
  });

  it("warns and gives partial credit for lowercase variant", async () => {
    const ctx = mockCtx({ files: { "agents.md": "# agents.md\n..." } });
    const r = await agentsMdExists.check(ctx);
    expect(r.status).toBe("warn");
    expect(r.points).toBe(7);
  });

  it("fails when missing", async () => {
    const ctx = mockCtx({ files: {} });
    const r = await agentsMdExists.check(ctx);
    expect(r.status).toBe("fail");
    expect(r.points).toBe(0);
    expect(r.fix?.docsUrl).toBe("https://agents.md/");
  });
});

describe("editorconfig", () => {
  it("passes when .editorconfig exists", async () => {
    const ctx = mockCtx({ files: { ".editorconfig": "root = true" } });
    const r = await editorconfig.check(ctx);
    expect(r.status).toBe("pass");
  });

  it("fails when missing", async () => {
    const r = await editorconfig.check(mockCtx());
    expect(r.status).toBe("fail");
  });
});

describe("linter-config", () => {
  it("detects biome.json", async () => {
    const ctx = mockCtx({ files: { "biome.json": "{}" } });
    const r = await linterConfig.check(ctx);
    expect(r.status).toBe("pass");
  });

  it("detects ruff config in pyproject.toml", async () => {
    const ctx = mockCtx({
      files: { "pyproject.toml": "[tool.ruff]\nline-length = 100\n" },
    });
    const r = await linterConfig.check(ctx);
    expect(r.status).toBe("pass");
  });

  it("fails when none present", async () => {
    const r = await linterConfig.check(mockCtx());
    expect(r.status).toBe("fail");
  });
});

describe("license-declared", () => {
  it("passes when LICENSE present", async () => {
    const ctx = mockCtx({ files: { LICENSE: "MIT License..." } });
    const r = await licenseDeclared.check(ctx);
    expect(r.status).toBe("pass");
  });

  it("fails when no license file", async () => {
    const r = await licenseDeclared.check(mockCtx());
    expect(r.status).toBe("fail");
  });
});

describe("env-example-no-env", () => {
  it("fails when .env is committed", async () => {
    const ctx = mockCtx({
      files: { ".env": "SECRET=123", ".env.example": "SECRET=" },
    });
    const r = await envExampleNoEnv.check(ctx);
    expect(r.status).toBe("fail");
    expect(r.message).toContain("committed");
  });

  it("passes when only .env.example present", async () => {
    const ctx = mockCtx({ files: { ".env.example": "SECRET=" } });
    const r = await envExampleNoEnv.check(ctx);
    expect(r.status).toBe("pass");
  });

  it("warns when no env files at all", async () => {
    const r = await envExampleNoEnv.check(mockCtx());
    expect(r.status).toBe("warn");
  });
});

describe("llms-txt-present", () => {
  it("skips when no URL provided", async () => {
    const r = await llmsTxtPresent.check(mockCtx());
    expect(r.status).toBe("skip");
  });
});

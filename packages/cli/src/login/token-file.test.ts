import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  readTokenFile,
  tokenFilePath,
  unlinkTokenFile,
  writeTokenFile,
} from "./token-file.js";

async function makeHome(): Promise<string> {
  return mkdtemp(join(tmpdir(), "agentlint-token-test-"));
}

describe("tokenFilePath", () => {
  it("joins under the provided home", () => {
    const p = tokenFilePath("/tmp/fakehome");
    expect(p).toBe("/tmp/fakehome/.config/agentlint/token");
  });
});

describe("writeTokenFile", () => {
  it("creates the file with mode 0600 and trailing newline", async () => {
    const home = await makeHome();
    await writeTokenFile("agl_proj_secret", { home });

    const path = tokenFilePath(home);
    const contents = await readFile(path, "utf-8");
    expect(contents).toBe("agl_proj_secret\n");

    if (process.platform !== "win32") {
      const st = await stat(path);
      const mode = st.mode & 0o777;
      expect(mode).toBe(0o600);
    }
  });

  it("trims whitespace and newlines from the token before writing", async () => {
    const home = await makeHome();
    await writeTokenFile("  agl_proj_padded  \n", { home });
    const contents = await readFile(tokenFilePath(home), "utf-8");
    expect(contents).toBe("agl_proj_padded\n");
  });

  it("overwrites and re-enforces mode 0600 if the existing file is world-readable", async () => {
    if (process.platform === "win32") return;
    const home = await makeHome();
    const path = tokenFilePath(home);
    await mkdir(join(home, ".config", "agentlint"), {
      recursive: true,
      mode: 0o700,
    });
    await writeFile(path, "old\n", { mode: 0o644 });

    await writeTokenFile("new_token", { home });
    const st = await stat(path);
    const mode = st.mode & 0o777;
    expect(mode).toBe(0o600);
    const contents = await readFile(path, "utf-8");
    expect(contents).toBe("new_token\n");
  });
});

describe("readTokenFile", () => {
  it("returns the trimmed content when the file is present and 0600", async () => {
    const home = await makeHome();
    await writeTokenFile("agl_proj_value", { home });
    const v = await readTokenFile({ home });
    expect(v).toBe("agl_proj_value");
  });

  it("returns null when the file is missing", async () => {
    const home = await makeHome();
    const v = await readTokenFile({ home });
    expect(v).toBeNull();
  });

  it("returns null when the file is empty", async () => {
    const home = await makeHome();
    const path = tokenFilePath(home);
    await mkdir(join(home, ".config", "agentlint"), {
      recursive: true,
      mode: 0o700,
    });
    await writeFile(path, "   \n", { mode: 0o600 });
    const v = await readTokenFile({ home });
    expect(v).toBeNull();
  });

  it("refuses to read when mode is wider than 0600 and warns", async () => {
    if (process.platform === "win32") return;
    const home = await makeHome();
    const path = tokenFilePath(home);
    await mkdir(join(home, ".config", "agentlint"), {
      recursive: true,
      mode: 0o700,
    });
    await writeFile(path, "secret\n", { mode: 0o644 });

    const warnings: string[] = [];
    const v = await readTokenFile({ home, log: (l) => warnings.push(l) });
    expect(v).toBeNull();
    expect(warnings.join("\n")).toContain("0600");
  });
});

describe("unlinkTokenFile", () => {
  it("removes the token file when it exists", async () => {
    const home = await makeHome();
    await writeTokenFile("agl_proj_value", { home });
    const removed = await unlinkTokenFile({ home });
    expect(removed).toBe(true);
    const v = await readTokenFile({ home });
    expect(v).toBeNull();
  });

  it("is idempotent when the file is missing", async () => {
    const home = await makeHome();
    const removed = await unlinkTokenFile({ home });
    expect(removed).toBe(false);
  });
});

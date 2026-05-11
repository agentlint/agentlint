import { describe, expect, it } from "vitest";
import type { InstallSecretOutcome } from "../install-secret/index.js";
import type { LoginOutcome } from "../login/index.js";
import type { FetchFn } from "../push/project-lookup.js";
import type { ExecFn } from "../push/repo-detect.js";
import { githubActionsSnippet, type InitDeps, runInit } from "./index.js";

type WrittenFile = { path: string; contents: string };

function makeDeps(overrides: Partial<InitDeps> = {}): {
  deps: InitDeps;
  logs: string[];
  prompts: string[];
  written: WrittenFile[];
} {
  const logs: string[] = [];
  const prompts: string[] = [];
  const written: WrittenFile[] = [];

  const deps: InitDeps = {
    cwd: "/repo",
    log: (line) => logs.push(line),
    prompt: async (q) => {
      prompts.push(q);
      return "";
    },
    writeFileFn: async (path, contents) => {
      written.push({ path, contents });
    },
    getEnv: () => undefined,
    execFn: async () => ({ stdout: "" }),
    fetchFn: async () => new Response("", { status: 200 }),
    readTokenFile: async () => null,
    statFn: async () => null,
    mkdirFn: async () => {},
    runLoginFn: async (): Promise<LoginOutcome> => ({
      kind: "network-error",
      reason: "no login fn in test",
    }),
    runInstallSecretFn: async (): Promise<InstallSecretOutcome> => ({
      kind: "no-token",
    }),
    ...overrides,
  };
  return { deps, logs, prompts, written };
}

const goodFetch =
  (
    project: Record<string, unknown> = {
      projectId: "proj_123",
      orgSlug: "acme",
      repoOwner: "acme",
      repoName: "widgets",
      prodBranch: "main",
    },
  ): FetchFn =>
  async () =>
    new Response(JSON.stringify(project), { status: 200 });

const gitOriginExec =
  (url: string): ExecFn =>
  async () => ({ stdout: `${url}\n` });

describe("runInit", () => {
  it("writes .agentlint.json when token, repo, and project are all available", async () => {
    const { deps, written, logs } = makeDeps({
      getEnv: (n) => (n === "AGENTLINT_TOKEN" ? "agl_proj_token" : undefined),
      execFn: gitOriginExec("https://github.com/acme/widgets.git"),
      fetchFn: goodFetch(),
    });
    const outcome = await runInit({ noWorkflow: true }, deps);
    expect(outcome.kind).toBe("wrote-config");
    expect(written).toHaveLength(1);
    expect(written[0]?.path).toBe("/repo/.agentlint.json");
    const parsed = JSON.parse(written[0]?.contents ?? "");
    expect(parsed.projectId).toBe("proj_123");
    expect(parsed.orgSlug).toBe("acme");
    expect(parsed.repoOwner).toBe("acme");
    expect(parsed.repoName).toBe("widgets");
    expect(parsed.prodBranch).toBe("main");
    expect(parsed.version).toBe(1);
    expect(written[0]?.contents.endsWith("\n")).toBe(true);
    expect(logs.join("\n")).toContain("Wrote .agentlint.json");
    expect(logs.join("\n")).toContain("AGENTLINT_TOKEN");
  });

  it("prefers --token flag over the env var", async () => {
    let observedAuth: string | null = null;
    const { deps } = makeDeps({
      getEnv: (n) => (n === "AGENTLINT_TOKEN" ? "env_token" : undefined),
      execFn: gitOriginExec("https://github.com/acme/widgets.git"),
      fetchFn: async (_url, init) => {
        observedAuth = init.headers.Authorization ?? null;
        return new Response(
          JSON.stringify({
            projectId: "p",
            repoOwner: "acme",
            repoName: "widgets",
          }),
          { status: 200 },
        );
      },
    });
    await runInit({ token: "flag_token" }, deps);
    expect(observedAuth).toBe("Bearer flag_token");
  });

  it("prompts for paste when user declines the inline login", async () => {
    const seen: string[] = [];
    let calls = 0;
    const { deps } = makeDeps({
      prompt: async (q) => {
        seen.push(q);
        calls += 1;
        // First prompt asks about login; decline. Second asks for paste.
        return calls === 1 ? "n" : "agl_proj_prompted";
      },
      execFn: gitOriginExec("https://github.com/acme/widgets.git"),
      fetchFn: goodFetch(),
    });
    const outcome = await runInit({}, deps);
    expect(outcome.kind).toBe("wrote-config");
    expect(seen[0]).toContain("agentlint login");
    expect(seen[1]).toContain("Paste your token");
  });

  it("returns no-token when --yes is set and env is missing", async () => {
    const { deps, written } = makeDeps();
    const outcome = await runInit({ yes: true }, deps);
    expect(outcome.kind).toBe("no-token");
    expect(written).toHaveLength(0);
  });

  it("returns no-token when user declines login and paste is empty", async () => {
    let calls = 0;
    const { deps, written } = makeDeps({
      prompt: async () => {
        calls += 1;
        return calls === 1 ? "n" : "";
      },
    });
    const outcome = await runInit({}, deps);
    expect(outcome.kind).toBe("no-token");
    expect(written).toHaveLength(0);
  });

  it("accepts --repo override and uses it as repoOwner/repoName", async () => {
    let observedUrl: string | null = null;
    const { deps, written } = makeDeps({
      getEnv: (n) => (n === "AGENTLINT_TOKEN" ? "t" : undefined),
      fetchFn: async (url) => {
        observedUrl = url;
        return new Response(
          JSON.stringify({ projectId: "p", repoOwner: "x", repoName: "y" }),
          { status: 200 },
        );
      },
    });
    await runInit({ repo: "myorg/myrepo" }, deps);
    expect(observedUrl).toContain("repoOwner=myorg");
    expect(observedUrl).toContain("repoName=myrepo");
    const parsed = JSON.parse(written[0]?.contents ?? "{}");
    expect(parsed.repoOwner).toBe("myorg");
    expect(parsed.repoName).toBe("myrepo");
  });

  it("prompts for repo when git remote detection fails", async () => {
    const prompts: string[] = [];
    const { deps, written } = makeDeps({
      getEnv: (n) => (n === "AGENTLINT_TOKEN" ? "t" : undefined),
      execFn: async () => ({ stdout: "" }),
      prompt: async (q) => {
        prompts.push(q);
        return "myorg/myrepo";
      },
      fetchFn: goodFetch({
        projectId: "p",
        repoOwner: "myorg",
        repoName: "myrepo",
      }),
    });
    const outcome = await runInit({}, deps);
    expect(outcome.kind).toBe("wrote-config");
    expect(prompts.some((p) => p.includes("owner/name"))).toBe(true);
    const parsed = JSON.parse(written[0]?.contents ?? "{}");
    expect(parsed.repoOwner).toBe("myorg");
  });

  it("returns no-repo when --yes is set and no remote is configured", async () => {
    const { deps, written } = makeDeps({
      getEnv: (n) => (n === "AGENTLINT_TOKEN" ? "t" : undefined),
      execFn: async () => ({ stdout: "" }),
    });
    const outcome = await runInit({ yes: true }, deps);
    expect(outcome.kind).toBe("no-repo");
    expect(written).toHaveLength(0);
  });

  it("returns no-project on 404 and prints the dashboard hint", async () => {
    const { deps, logs, written } = makeDeps({
      getEnv: (n) => (n === "AGENTLINT_TOKEN" ? "t" : undefined),
      execFn: gitOriginExec("git@github.com:acme/widgets.git"),
      fetchFn: async () => new Response("not found", { status: 404 }),
    });
    const outcome = await runInit({}, deps);
    expect(outcome.kind).toBe("no-project");
    if (outcome.kind === "no-project") {
      expect(outcome.repoOwner).toBe("acme");
      expect(outcome.repoName).toBe("widgets");
    }
    expect(written).toHaveLength(0);
    expect(logs.join("\n")).toContain("agentlint.sh/dashboard/projects/new");
  });

  it("returns unauthorized on 401 and points the user back to the auth page", async () => {
    const { deps, logs, written } = makeDeps({
      getEnv: (n) => (n === "AGENTLINT_TOKEN" ? "bad" : undefined),
      execFn: gitOriginExec("https://github.com/acme/widgets.git"),
      fetchFn: async () => new Response("nope", { status: 401 }),
    });
    const outcome = await runInit({}, deps);
    expect(outcome.kind).toBe("unauthorized");
    expect(written).toHaveLength(0);
    expect(logs.join("\n")).toContain("/cli/auth");
  });

  it("returns error on server failure", async () => {
    const { deps, written } = makeDeps({
      getEnv: (n) => (n === "AGENTLINT_TOKEN" ? "t" : undefined),
      execFn: gitOriginExec("https://github.com/acme/widgets.git"),
      fetchFn: async () => new Response("boom", { status: 503 }),
    });
    const outcome = await runInit({}, deps);
    expect(outcome.kind).toBe("error");
    expect(written).toHaveLength(0);
  });

  it("honors --endpoint to choose the API base URL", async () => {
    let observedUrl: string | null = null;
    const { deps } = makeDeps({
      getEnv: (n) => (n === "AGENTLINT_TOKEN" ? "t" : undefined),
      execFn: gitOriginExec("https://github.com/acme/widgets.git"),
      fetchFn: async (url) => {
        observedUrl = url;
        return new Response(
          JSON.stringify({
            projectId: "p",
            repoOwner: "acme",
            repoName: "widgets",
          }),
          { status: 200 },
        );
      },
    });
    await runInit({ endpoint: "http://localhost:3000" }, deps);
    expect(observedUrl).toContain("http://localhost:3000/api/cli/projects");
  });

  it("reads AGENTLINT_URL when no flag is set", async () => {
    let observedUrl: string | null = null;
    const { deps } = makeDeps({
      getEnv: (n) =>
        n === "AGENTLINT_TOKEN"
          ? "t"
          : n === "AGENTLINT_URL"
            ? "http://localhost:9999"
            : undefined,
      execFn: gitOriginExec("https://github.com/acme/widgets.git"),
      fetchFn: async (url) => {
        observedUrl = url;
        return new Response(
          JSON.stringify({
            projectId: "p",
            repoOwner: "acme",
            repoName: "widgets",
          }),
          { status: 200 },
        );
      },
    });
    await runInit({}, deps);
    expect(observedUrl).toContain("http://localhost:9999");
  });

  it("returns error and does not crash if writing the config fails", async () => {
    const { deps, written } = makeDeps({
      getEnv: (n) => (n === "AGENTLINT_TOKEN" ? "t" : undefined),
      execFn: gitOriginExec("https://github.com/acme/widgets.git"),
      fetchFn: goodFetch(),
      writeFileFn: async () => {
        throw new Error("EACCES");
      },
    });
    const outcome = await runInit({}, deps);
    expect(outcome.kind).toBe("error");
    expect(written).toHaveLength(0);
  });

  it("trims whitespace from a prompted token", async () => {
    let observedAuth: string | null = null;
    let calls = 0;
    const { deps } = makeDeps({
      prompt: async () => {
        calls += 1;
        return calls === 1 ? "n" : "  agl_proj_padded  \n";
      },
      execFn: gitOriginExec("https://github.com/acme/widgets.git"),
      fetchFn: async (_u, init) => {
        observedAuth = init.headers.Authorization ?? null;
        return new Response(
          JSON.stringify({
            projectId: "p",
            repoOwner: "acme",
            repoName: "widgets",
          }),
          { status: 200 },
        );
      },
    });
    await runInit({}, deps);
    expect(observedAuth).toBe("Bearer agl_proj_padded");
  });

  it("falls back to the token file when env is unset", async () => {
    let observedAuth: string | null = null;
    const { deps } = makeDeps({
      readTokenFile: async () => "agl_proj_from_file",
      execFn: gitOriginExec("https://github.com/acme/widgets.git"),
      fetchFn: async (_u, init) => {
        observedAuth = init.headers.Authorization ?? null;
        return new Response(
          JSON.stringify({
            projectId: "p",
            repoOwner: "acme",
            repoName: "widgets",
          }),
          { status: 200 },
        );
      },
    });
    const outcome = await runInit({}, deps);
    expect(outcome.kind).toBe("wrote-config");
    expect(observedAuth).toBe("Bearer agl_proj_from_file");
  });

  it("runs login inline when the user accepts the prompt", async () => {
    let loginCalled = false;
    let observedAuth: string | null = null;
    const { deps } = makeDeps({
      prompt: async () => "Y",
      runLoginFn: async () => {
        loginCalled = true;
        return {
          kind: "success",
          token: "agl_proj_via_login",
          project: { id: "p", orgSlug: "acme" },
        };
      },
      execFn: gitOriginExec("https://github.com/acme/widgets.git"),
      fetchFn: async (_u, init) => {
        observedAuth = init.headers.Authorization ?? null;
        return new Response(
          JSON.stringify({
            projectId: "p",
            repoOwner: "acme",
            repoName: "widgets",
          }),
          { status: 200 },
        );
      },
    });
    const outcome = await runInit({}, deps);
    expect(loginCalled).toBe(true);
    expect(observedAuth).toBe("Bearer agl_proj_via_login");
    expect(outcome.kind).toBe("wrote-config");
  });

  it("writes the GitHub Actions workflow by default", async () => {
    const { deps, written } = makeDeps({
      getEnv: (n) => (n === "AGENTLINT_TOKEN" ? "t" : undefined),
      execFn: gitOriginExec("https://github.com/acme/widgets.git"),
      fetchFn: goodFetch(),
    });
    const outcome = await runInit({}, deps);
    expect(outcome.kind).toBe("wrote-config");
    const workflow = written.find((w) =>
      w.path.endsWith(".github/workflows/agentlint.yml"),
    );
    expect(workflow).toBeDefined();
    expect(workflow?.contents).toContain("npx -y @agentlinthq/cli@latest");
  });

  it("skips the workflow when --no-workflow is set", async () => {
    const { deps, written, logs } = makeDeps({
      getEnv: (n) => (n === "AGENTLINT_TOKEN" ? "t" : undefined),
      execFn: gitOriginExec("https://github.com/acme/widgets.git"),
      fetchFn: goodFetch(),
    });
    const outcome = await runInit({ noWorkflow: true }, deps);
    expect(outcome.kind).toBe("wrote-config");
    const workflow = written.find((w) =>
      w.path.endsWith(".github/workflows/agentlint.yml"),
    );
    expect(workflow).toBeUndefined();
    expect(logs.join("\n")).toContain("--no-workflow");
  });

  it("refuses to overwrite an existing workflow file", async () => {
    const { deps, written, logs } = makeDeps({
      getEnv: (n) => (n === "AGENTLINT_TOKEN" ? "t" : undefined),
      execFn: gitOriginExec("https://github.com/acme/widgets.git"),
      fetchFn: goodFetch(),
      statFn: async (p) =>
        p.endsWith(".github/workflows/agentlint.yml") ? { isFile: true } : null,
    });
    const outcome = await runInit({}, deps);
    expect(outcome.kind).toBe("wrote-config");
    const workflow = written.find((w) =>
      w.path.endsWith(".github/workflows/agentlint.yml"),
    );
    expect(workflow).toBeUndefined();
    expect(logs.join("\n")).toContain("already exists");
    expect(logs.join("\n")).toContain("--force-workflow");
  });

  it("overwrites an existing workflow file with --force-workflow", async () => {
    const { deps, written } = makeDeps({
      getEnv: (n) => (n === "AGENTLINT_TOKEN" ? "t" : undefined),
      execFn: gitOriginExec("https://github.com/acme/widgets.git"),
      fetchFn: goodFetch(),
      statFn: async (p) =>
        p.endsWith(".github/workflows/agentlint.yml") ? { isFile: true } : null,
    });
    const outcome = await runInit({ forceWorkflow: true }, deps);
    expect(outcome.kind).toBe("wrote-config");
    const workflow = written.find((w) =>
      w.path.endsWith(".github/workflows/agentlint.yml"),
    );
    expect(workflow).toBeDefined();
  });

  it("calls runInstallSecret by default after writing the workflow", async () => {
    let installCalled = 0;
    const { deps, logs } = makeDeps({
      getEnv: (n) => (n === "AGENTLINT_TOKEN" ? "t" : undefined),
      execFn: gitOriginExec("https://github.com/acme/widgets.git"),
      fetchFn: goodFetch(),
      runInstallSecretFn: async (_flags, depsArg) => {
        installCalled += 1;
        depsArg.log("✓ Set AGENTLINT_TOKEN secret on acme/widgets");
        return {
          kind: "installed",
          repo: "acme/widgets",
          installedAt: "2026-05-10T22:14:09.812Z",
        };
      },
    });
    const outcome = await runInit({}, deps);
    expect(outcome.kind).toBe("wrote-config");
    expect(installCalled).toBe(1);
    expect(logs.join("\n")).toContain(
      "✓ Set AGENTLINT_TOKEN secret on acme/widgets",
    );
  });

  it("does not call runInstallSecret when --no-install-secret is set", async () => {
    let installCalled = 0;
    const { deps } = makeDeps({
      getEnv: (n) => (n === "AGENTLINT_TOKEN" ? "t" : undefined),
      execFn: gitOriginExec("https://github.com/acme/widgets.git"),
      fetchFn: goodFetch(),
      runInstallSecretFn: async () => {
        installCalled += 1;
        return { kind: "no-token" };
      },
    });
    const outcome = await runInit({ noInstallSecret: true }, deps);
    expect(outcome.kind).toBe("wrote-config");
    expect(installCalled).toBe(0);
  });

  it("does not call runInstallSecret when --no-workflow is set", async () => {
    let installCalled = 0;
    const { deps } = makeDeps({
      getEnv: (n) => (n === "AGENTLINT_TOKEN" ? "t" : undefined),
      execFn: gitOriginExec("https://github.com/acme/widgets.git"),
      fetchFn: goodFetch(),
      runInstallSecretFn: async () => {
        installCalled += 1;
        return { kind: "no-token" };
      },
    });
    const outcome = await runInit({ noWorkflow: true }, deps);
    expect(outcome.kind).toBe("wrote-config");
    expect(installCalled).toBe(0);
  });

  it("still returns wrote-config when runInstallSecret fails (non-fatal)", async () => {
    const { deps, logs } = makeDeps({
      getEnv: (n) => (n === "AGENTLINT_TOKEN" ? "t" : undefined),
      execFn: gitOriginExec("https://github.com/acme/widgets.git"),
      fetchFn: goodFetch(),
      runInstallSecretFn: async (_flags, depsArg) => {
        depsArg.log("GitHub App not installed on this repo. Install it at:");
        return {
          kind: "app-not-installed",
          installUrl: "https://github.com/apps/agentlint-ci/installations/new",
        };
      },
    });
    const outcome = await runInit({}, deps);
    expect(outcome.kind).toBe("wrote-config");
    expect(logs.join("\n")).toContain("GitHub App not installed");
  });
});

describe("githubActionsSnippet", () => {
  it("includes id-token: write and AGENTLINT_TOKEN secret", () => {
    const snippet = githubActionsSnippet();
    expect(snippet).toContain("id-token: write");
    // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions interpolation syntax, not a JS template literal.
    const secretRef = "AGENTLINT_TOKEN: ${{ secrets.AGENTLINT_TOKEN }}";
    expect(snippet).toContain(secretRef);
    expect(snippet).toContain("npx @agentlinthq/cli --push");
  });
});

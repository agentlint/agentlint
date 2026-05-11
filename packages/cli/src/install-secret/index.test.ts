import { describe, expect, it } from "vitest";
import type { InstallSecretDeps } from "./index.js";
import { runInstallSecret } from "./index.js";

type Logs = string[];

interface Harness {
  deps: InstallSecretDeps;
  logs: Logs;
}

function makeDeps(overrides: Partial<InstallSecretDeps> = {}): Harness {
  const logs: Logs = [];
  const baseConfig = JSON.stringify({
    projectId: "proj_test",
    orgSlug: "acme",
    repoOwner: "acme",
    repoName: "widgets",
    prodBranch: "main",
    version: 1,
  });
  const deps: InstallSecretDeps = {
    cwd: "/repo",
    log: (line) => logs.push(line),
    getEnv: (n) => (n === "AGENTLINT_TOKEN" ? "agl_proj_test" : undefined),
    readConfigFn: async () => baseConfig,
    fetchFn: async () =>
      new Response(
        JSON.stringify({
          installed: true,
          installedAt: "2026-05-10T22:14:09.812Z",
          repo: "acme/widgets",
        }),
        { status: 200 },
      ),
    ...overrides,
  };
  return { deps, logs };
}

describe("runInstallSecret", () => {
  it("returns installed and logs the success line on 200", async () => {
    const { deps, logs } = makeDeps();
    const outcome = await runInstallSecret({}, deps);
    expect(outcome.kind).toBe("installed");
    if (outcome.kind === "installed") {
      expect(outcome.repo).toBe("acme/widgets");
      expect(outcome.installedAt).toBe("2026-05-10T22:14:09.812Z");
    }
    expect(logs.join("\n")).toContain(
      "✓ Set AGENTLINT_TOKEN secret on acme/widgets",
    );
  });

  it("POSTs to the correct URL with bearer token and empty body", async () => {
    let observedUrl: string | null = null;
    let observedAuth: string | null = null;
    let observedBody: string | null = null;
    let observedMethod: string | null = null;
    const { deps } = makeDeps({
      fetchFn: async (url, init) => {
        observedUrl = url;
        observedAuth = init.headers.Authorization ?? null;
        observedBody = init.body;
        observedMethod = init.method;
        return new Response(
          JSON.stringify({
            installed: true,
            installedAt: "now",
            repo: "acme/widgets",
          }),
          { status: 200 },
        );
      },
    });
    await runInstallSecret({ endpoint: "https://agentlint.sh" }, deps);
    expect(observedMethod).toBe("POST");
    expect(observedUrl).toBe(
      "https://agentlint.sh/api/projects/proj_test/install-secret",
    );
    expect(observedAuth).toBe("Bearer agl_proj_test");
    expect(observedBody).toBe("{}");
  });

  it("returns no-token when token cannot be resolved", async () => {
    const { deps, logs } = makeDeps({
      getEnv: () => undefined,
    });
    const outcome = await runInstallSecret({}, deps);
    expect(outcome.kind).toBe("no-token");
    expect(logs.join("\n")).toContain("No AGENTLINT_TOKEN");
    expect(logs.join("\n")).toContain("agentlint login");
  });

  it("returns no-config when .agentlint.json is missing", async () => {
    const { deps, logs } = makeDeps({
      readConfigFn: async () => {
        throw new Error("ENOENT");
      },
    });
    const outcome = await runInstallSecret({}, deps);
    expect(outcome.kind).toBe("no-config");
    expect(logs.join("\n")).toContain("No .agentlint.json");
    expect(logs.join("\n")).toContain("agentlint init");
  });

  it("returns no-project-id when config is missing projectId", async () => {
    const { deps, logs } = makeDeps({
      readConfigFn: async () =>
        JSON.stringify({
          orgSlug: "acme",
          repoOwner: "acme",
          repoName: "widgets",
        }),
    });
    const outcome = await runInstallSecret({}, deps);
    expect(outcome.kind).toBe("no-project-id");
    expect(logs.join("\n")).toContain("projectId");
  });

  it("maps 409 app_not_installed to outcome + install URL hint", async () => {
    const { deps, logs } = makeDeps({
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            error: "app_not_installed",
            install_url:
              "https://github.com/apps/agentlint-ci/installations/new?state=acme",
          }),
          { status: 409 },
        ),
    });
    const outcome = await runInstallSecret({}, deps);
    expect(outcome.kind).toBe("app-not-installed");
    if (outcome.kind === "app-not-installed") {
      expect(outcome.installUrl).toBe(
        "https://github.com/apps/agentlint-ci/installations/new?state=acme",
      );
    }
    const joined = logs.join("\n");
    expect(joined).toContain("GitHub App not installed");
    expect(joined).toContain(
      "https://github.com/apps/agentlint-ci/installations/new?state=acme",
    );
    expect(joined).toContain("agentlint install-secret");
  });

  it("maps 403 app_lacks_permission to outcome + re-authorize URL hint", async () => {
    const reauthUrl =
      "https://github.com/apps/agentlint-ci/installations/42/permissions/update";
    const { deps, logs } = makeDeps({
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            error: "app_lacks_permission",
            re_authorize_url: reauthUrl,
          }),
          { status: 403 },
        ),
    });
    const outcome = await runInstallSecret({}, deps);
    expect(outcome.kind).toBe("app-lacks-permission");
    if (outcome.kind === "app-lacks-permission") {
      expect(outcome.reAuthorizeUrl).toBe(reauthUrl);
    }
    const joined = logs.join("\n");
    expect(joined).toContain("Actions secrets: write");
    expect(joined).toContain(reauthUrl);
  });

  it("maps 502 to github-api-failed", async () => {
    const { deps, logs } = makeDeps({
      fetchFn: async () =>
        new Response(
          JSON.stringify({ error: "github_api_failed", status: 502 }),
          { status: 502 },
        ),
    });
    const outcome = await runInstallSecret({}, deps);
    expect(outcome.kind).toBe("github-api-failed");
    if (outcome.kind === "github-api-failed") {
      expect(outcome.status).toBe(502);
    }
    expect(logs.join("\n")).toContain("GitHub API failed");
  });

  it("maps thrown fetch errors to network-error", async () => {
    const { deps, logs } = makeDeps({
      fetchFn: async () => {
        throw new Error("ECONNRESET");
      },
    });
    const outcome = await runInstallSecret({}, deps);
    expect(outcome.kind).toBe("network-error");
    if (outcome.kind === "network-error") {
      expect(outcome.reason).toContain("ECONNRESET");
    }
    expect(logs.join("\n")).toContain("Network error");
  });

  it("maps 401 to unauthorized", async () => {
    const { deps, logs } = makeDeps({
      fetchFn: async () =>
        new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
        }),
    });
    const outcome = await runInstallSecret({}, deps);
    expect(outcome.kind).toBe("unauthorized");
    expect(logs.join("\n")).toContain("Token rejected");
    expect(logs.join("\n")).toContain("agentlint login");
  });

  it("maps 404 project_not_found to a generic github-api-failed-style error", async () => {
    const { deps, logs } = makeDeps({
      fetchFn: async () =>
        new Response(JSON.stringify({ error: "project_not_found" }), {
          status: 404,
        }),
    });
    const outcome = await runInstallSecret({}, deps);
    // 404 is not specifically modeled — render as github-api-failed so the
    // user gets a useful status code in the log.
    expect(outcome.kind).toBe("github-api-failed");
    expect(logs.join("\n")).toContain("GitHub API failed (404)");
  });

  it("uses AGENTLINT_URL env when no endpoint flag is set", async () => {
    let observedUrl: string | null = null;
    const { deps } = makeDeps({
      getEnv: (n) => {
        if (n === "AGENTLINT_TOKEN") return "agl_proj_test";
        if (n === "AGENTLINT_URL") return "http://localhost:9999";
        return undefined;
      },
      fetchFn: async (url) => {
        observedUrl = url;
        return new Response(
          JSON.stringify({
            installed: true,
            installedAt: "now",
            repo: "acme/widgets",
          }),
          { status: 200 },
        );
      },
    });
    await runInstallSecret({}, deps);
    expect(observedUrl).toBe(
      "http://localhost:9999/api/projects/proj_test/install-secret",
    );
  });
});

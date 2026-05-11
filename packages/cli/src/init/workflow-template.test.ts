import { describe, expect, it } from "vitest";
import { WORKFLOW_PATH, workflowYaml } from "./workflow-template.js";

describe("workflowYaml", () => {
  it("includes the required OIDC permission", () => {
    expect(workflowYaml()).toContain("id-token: write");
  });

  it("checks out the repo with actions/checkout@v4", () => {
    expect(workflowYaml()).toContain("actions/checkout@v4");
  });

  it("invokes the CLI via npx", () => {
    expect(workflowYaml()).toContain("npx -y @agentlinthq/cli@latest --push");
  });

  it("does not interpolate any GitHub Actions secret (OIDC-only)", () => {
    // CI auth is OIDC-only (ADR-0026). The workflow must not reference
    // any `secrets.*` value — the runner authenticates against /api/runs
    // using the OIDC JWT requested via `id-token: write` instead.
    expect(workflowYaml()).not.toContain("secrets.");
  });

  it("requests the OIDC id-token permission required by /api/runs", () => {
    expect(workflowYaml()).toContain("id-token: write");
  });

  it("matches the snapshot", () => {
    expect(workflowYaml()).toMatchInlineSnapshot(`
      "name: agentlint
      on:
        pull_request:
        push:
          branches: [main]
      permissions:
        id-token: write
        contents: read
        pull-requests: write
      jobs:
        scan:
          runs-on: ubuntu-latest
          steps:
            - uses: actions/checkout@v4
            - uses: actions/setup-node@v4
              with:
                node-version: 20
            - run: npx -y @agentlinthq/cli@latest --push
      "
    `);
  });
});

describe("WORKFLOW_PATH", () => {
  it("points at the conventional GitHub Actions location", () => {
    expect(WORKFLOW_PATH).toBe(".github/workflows/agentlint.yml");
  });
});

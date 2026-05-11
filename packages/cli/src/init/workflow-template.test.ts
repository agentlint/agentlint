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

  it("interpolates AGENTLINT_TOKEN as a GitHub Actions secret", () => {
    // Note: we deliberately compare against a literal escaped form so the
    // test file itself does not contain a real GitHub Actions ${{ ... }}
    // interpolation that some toolchains rewrite.
    const secretRef = [
      "AGENTLINT_TOKEN: $",
      "{{ secrets.AGENTLINT_TOKEN }}",
    ].join("");
    expect(workflowYaml()).toContain(secretRef);
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
              env:
                AGENTLINT_TOKEN: \${{ secrets.AGENTLINT_TOKEN }}
      "
    `);
  });
});

describe("WORKFLOW_PATH", () => {
  it("points at the conventional GitHub Actions location", () => {
    expect(WORKFLOW_PATH).toBe(".github/workflows/agentlint.yml");
  });
});

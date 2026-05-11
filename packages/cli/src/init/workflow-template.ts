// GitHub Actions workflow template emitted by `agentlint init`.
//
// `agentlint init` writes this file at `.github/workflows/agentlint.yml`
// in the user's repo so CI scans run automatically on PRs and pushes.
//
// `id-token: write` is required for the OIDC-verified provenance flow
// (ADR-0019). The `AGENTLINT_TOKEN` secret is a GitHub Actions
// interpolation — the user still has to add it as a repo secret manually
// (the cli-secret-autoupload PRD is a follow-up that removes that step).

export const WORKFLOW_PATH = ".github/workflows/agentlint.yml";

/**
 * Render the GitHub Actions workflow YAML.
 *
 * Exposed as a function (rather than a const) so tests can snapshot it
 * and so future variations (e.g. self-hosted runners, custom node version)
 * can be parameterized without changing the call site.
 */
export function workflowYaml(): string {
  return `name: agentlint
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
`;
}

# @agentlinthq/cli

> The Lighthouse for AI coding agents. Audit any repo for how ready it is for Claude Code, Cursor, Codex, Copilot, and Gemini CLI. Get a 0–100 score and a fix list in 30 seconds.

## Install

```bash
npx @agentlinthq/cli         # one-shot
npm i -g @agentlinthq/cli    # then `agentlint`
```

The installed binary is `agentlint`. End-users invoke it via `npx`/`pnpm dlx`/`bunx` regardless of what package manager their project uses.

## Usage

```bash
agentlint                      # scan current directory
agentlint ./packages/api       # scan a specific path
agentlint --json > out.json    # machine-readable output (for CI / agents)
agentlint --markdown           # markdown report (for AI agents to consume)
agentlint --url https://docs.example.com  # also audit a docs site
agentlint --output report.html # custom HTML output path
agentlint --no-html            # skip HTML report
```

Exit code: 0 if score ≥ 80, 1 otherwise. Use this to gate CI.

## `--push` (opt-in upload to agentlint.sh)

In v2 the dashboard is **org-centric**: every project lives under an org and
authenticates the CLI with a **project-scoped token**. The recommended flow is
to run `--push` from CI so the server can verify provenance with GitHub Actions
OIDC.

### One-time setup with `agentlint init`

From the repo root:

```bash
# 1. Generate a project token at https://agentlint.sh/cli/auth
#    (it starts with `agl_proj_` and is 61 chars long).
export AGENTLINT_TOKEN=agl_proj_...

# 2. Link this repo to a dashboard project.
agentlint init
# → Wrote .agentlint.json:
#     projectId: proj_abc123
#     orgSlug:   acme
#     repo:      acme/widgets
#     branch:    main
```

`init` reads the git remote (`git config --get remote.origin.url`) to
preselect the repo, calls `GET /api/cli/projects?repoOwner=…&repoName=…`
with the token, and writes `.agentlint.json` when a matching project is
found. If the lookup returns 404, it prints the URL to create one in the
dashboard.

`agentlint init` flags:

- `--token <value>` — supply the token without exporting it (or pipe it on
  stdin instead).
- `--repo owner/name` — skip git remote detection (useful in monorepos or
  when the remote isn't GitHub).
- `--endpoint <url>` — override the API base URL (defaults to
  `AGENTLINT_URL` or `https://agentlint.sh`).
- `--yes, -y` — non-interactive; fail rather than prompting.

Commit `.agentlint.json` to your repo. The token itself **never** goes in
the file — only in CI secrets / `AGENTLINT_TOKEN`.

### Pushing a run

```bash
export AGENTLINT_TOKEN=agl_proj_...
agentlint --push
# → Pushed: https://agentlint.sh/dashboard/runs/run_abc123
```

`--push` requires either `.agentlint.json` at the repo root **or** an
explicit `--project <id>` flag.

Branch / commit metadata is resolved in this order:

| Field      | Resolution order                                                                |
| ---------- | ------------------------------------------------------------------------------- |
| Branch     | `--branch` → `GITHUB_REF_NAME` → `git rev-parse --abbrev-ref HEAD` → `null`     |
| Commit SHA | `--commit` → `GITHUB_SHA` → `git rev-parse HEAD` → `null`                       |
| Endpoint   | `--url` (bare origin) → `AGENTLINT_URL` → `https://agentlint.sh`                |

### Token resolution

`AGENTLINT_TOKEN` env var only. (v1's `~/.config/agentlint/token` file
fallback is removed in v2 — project tokens are short-lived and belong in
CI secrets, not in dotfiles.)

If the env var is missing, `--push` prints
`Push failed: Set AGENTLINT_TOKEN env var. Run \`agentlint init\` to set up.`
and exits 0. The local audit is unaffected.

### Security model

- The token is **never** passed on the command line — only via env. Argument
  vectors are visible in `ps`; the env is not.
- The CLI **refuses** to send the token over a non-HTTPS URL. The only
  exceptions are `http://localhost` / `http://127.0.0.1` (so the web side can
  be tested locally) and `AGENTLINT_INSECURE=1` for explicit opt-in.
- Failed pushes (`401`, `429`, `5xx`, network errors) print one line and
  **exit 0**. The local audit already succeeded; push is a side effect and
  must not break your CI.
- Request timeout is 15 seconds.

### GitHub Actions: OIDC-verified provenance

If your workflow grants `id-token: write`, the CLI fetches a GitHub Actions
OIDC token with `audience=agentlint` and forwards it in the `x-github-oidc`
header. The server validates the JWT against GitHub's JWKS and tags the run
`provenance: oidc-verified`, `source: ci`. Without the OIDC header (e.g.
running locally), the server tags the run `provenance: unverified`,
`source: local`. OIDC fetch failure is non-fatal — the push still proceeds.

```yaml
# .github/workflows/agentlint.yml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  agentlint:
    runs-on: ubuntu-latest
    permissions:
      id-token: write    # required for OIDC-verified provenance
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npx @agentlinthq/cli --push
        env:
          AGENTLINT_TOKEN: ${{ secrets.AGENTLINT_TOKEN }}
```

Store the token as the `AGENTLINT_TOKEN` repo (or org) secret. Never echo it,
never commit it.

## PR comments via the agentlint GitHub App

When a `--push` run is associated with a pull request, the agentlint GitHub
App will post (or update) a single comment on the PR showing the score, a diff
versus the previous run on the same repo, and links to the dashboard and
badge. Subsequent pushes update the same comment instead of stacking new ones.

To enable:

1. Install the [agentlint GitHub App](https://github.com/apps/agentlint-ci)
   on the repository (or on the org). Permissions requested are pull-request
   read/write and metadata read — nothing else.
2. Push from CI as usual. PR detection works automatically on GitHub Actions
   `pull_request` and `pull_request_target` events; `GITHUB_REF`,
   `GITHUB_SHA`, and `GITHUB_BASE_REF` are read directly.
3. For other CI vendors (or to test locally), set `AGENTLINT_PR=<n>` or pass
   `--pr <n>` so the CLI attaches PR metadata to the upload.

If the App is not installed on the repo, the score still uploads but no
comment is posted.

## What it checks

Five categories, ~30 checks, 0–100 score. See the project's [`AGENTS.md`](https://github.com/agentlint/agentlint/blob/main/AGENTS.md) for the full conventions and rule list.

## License

MIT.

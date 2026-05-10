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

Upload the report to your dashboard at <https://agentlint.sh>. Off by default — without `--push`, the CLI never makes a network call beyond what the optional `--url` docs audit already does.

```bash
# 1. Generate a token at https://agentlint.sh/dashboard/tokens
# 2. Export it (or write it to ~/.config/agentlint/token, chmod 600)
export AGENTLINT_TOKEN=agl_...
agentlint --push
# → Pushed: https://agentlint.sh/dashboard
```

### Token resolution

The CLI looks for the token in this order:

1. `AGENTLINT_TOKEN` environment variable.
2. `~/.config/agentlint/token` (single-line file, trimmed; recommended `chmod 600`).

If neither is set, `--push` prints `Push failed: no token` and exits 0. The local audit is unaffected.

### Endpoint resolution

1. `--url <https://...>` if it's a bare origin (no path).
2. `AGENTLINT_URL` environment variable.
3. Default: `https://agentlint.sh`.

The `--url` flag is also used for the documentation rules' docs-site audit, so it's only treated as the push endpoint when it has no meaningful path component (e.g. `--url https://staging.agentlint.sh` works; `--url https://docs.example.com/v2` does not).

### Security model

- The token is **never** passed on the command line — only via env or the token file. Argument vectors are visible in `ps`; the env and the file are not.
- The CLI **refuses** to send the token over a non-HTTPS URL. The only exceptions are `http://localhost` and `http://127.0.0.1` (so the web side can be tested locally).
- Failed pushes (`401`, `429`, `5xx`, network errors) print one line and **exit 0**. The local audit already succeeded; push is a side effect and must not break your CI.
- Request timeout is 15 seconds.

### CI usage

```yaml
# .github/workflows/agentlint.yml
- name: Run agentlint
  env:
    AGENTLINT_TOKEN: ${{ secrets.AGENTLINT_TOKEN }}
  run: npx @agentlinthq/cli --push
```

Store the token as a secret. Never echo it, never commit it.

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

```yaml
# Example: GitHub Actions on a PR — comment appears automatically.
on:
  pull_request:
    branches: [main]
jobs:
  agentlint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx @agentlinthq/cli --push
        env:
          AGENTLINT_TOKEN: ${{ secrets.AGENTLINT_TOKEN }}
```

If the App is not installed on the repo, the score still uploads but no
comment is posted.

## What it checks

Five categories, ~30 checks, 0–100 score. See the project's [`AGENTS.md`](https://github.com/agentlint/agentlint/blob/main/AGENTS.md) for the full conventions and rule list.

## License

MIT.

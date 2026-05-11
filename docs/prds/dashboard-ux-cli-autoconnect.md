# PRD — dashboard UX + CLI auto-connect

**Status:** approved by the autonomous pipeline (2026-05-10).
**Repo split:** web (`agentlint-sh`) + CLI (`agentlint`).
**Slug:** `dashboard-ux-cli-autoconnect`.

## Problem

The v2 cutover shipped the org/project/token model but the **end-to-end
setup is still a copy-paste fest.** A new user has to (1) sign in, (2)
click through to create a project, (3) mint a token, (4) copy the token
string out of the dashboard, (5) paste it into `AGENTLINT_TOKEN`, (6)
manually configure `agentlint init`, (7) hand-write the GitHub Actions
workflow file. Each step is a failure point — and the dashboard itself
gives only a thin score-trend with no headline metrics, so once the
user is set up there is little reason to come back.

This feature collapses (3)–(7) into one `agentlint login &&
agentlint init` flow and gives the dashboard real metrics so the
hosted product earns the subscription it's trying to charge for.

## Non-goals

- **Auto-uploading the `AGENTLINT_TOKEN` repo secret** via the GitHub App
  API. That requires the `secrets:write` permission, which needs every
  installed App user to re-consent. Punted to a follow-up PRD
  (`cli-secret-autoupload.md`) so this slice ships cleanly.
- **Stripe re-enable.** Separate gate (ADR-0012).
- **Slack / Discord notifications.** Future feature.
- **Custom score thresholds / org policy.** Slice 9 in PROJECT_STATE.
- **SSO orgs / SAML.** Out of scope.
- **Mobile-responsive redesign.** Cards must not break on mobile but a
  full mobile rework is out.

## Success metric

A new user can complete the full happy path **without copying any
string by hand**:

```
$ npx @agentlinthq/cli login          # opens browser, returns token
$ npx @agentlinthq/cli init           # writes .agentlint.json + workflow
$ npx @agentlinthq/cli --push         # 201 + row in run
```

…and within 60 seconds of finishing `init`, a CI run on push triggers
the workflow and lands a row tagged `source=ci, provenance=oidc-verified`.

Measured: end-to-end smoke run on a fresh GitHub user against
`preview.agentlint.sh`, no manual paste anywhere, p95 < 120s wall.

Secondary metric: dashboard `/dashboard/orgs/<slug>` shows four headline
cards (7d avg score, runs this week, pass rate, top failing rule)
populated for any org with at least one ingested run.

## Schema diff

### Forward (`db/migrations/0001_cli_auth_grant.sql` on web repo)

```sql
CREATE TABLE cli_auth_grant (
  id              text PRIMARY KEY,
  device_code     text NOT NULL UNIQUE,
  user_code       text NOT NULL UNIQUE,
  status          text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','approved','denied','expired')),
  user_id         text REFERENCES "user"(id) ON DELETE SET NULL,
  org_id          text REFERENCES organization(id) ON DELETE SET NULL,
  project_id      text REFERENCES project(id) ON DELETE SET NULL,
  token_plaintext text,    -- only set briefly between approve and first poll-read; cleared after
  token_id        text REFERENCES project_token(id) ON DELETE SET NULL,
  expires_at      timestamptz NOT NULL,
  approved_at     timestamptz,
  redeemed_at     timestamptz,
  ip_hash         text,    -- sha256(initiating IP) — anti-abuse only, no PII
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cli_auth_grant_user_code_idx ON cli_auth_grant(user_code);
CREATE INDEX cli_auth_grant_expires_at_idx ON cli_auth_grant(expires_at);
```

### Rollback

```sql
DROP TABLE cli_auth_grant;
```

Standalone table; no FK from existing rows to it. Safe to drop.

### Drizzle side

Add `cliAuthGrant` to `db/schema.ts`. No migration of existing tables.

## API surface

All routes live in `agentlint-sh`.

### `POST /api/cli/auth/device` — start device flow (no auth)

**Request body**

```json
{ "client_name": "agentlint-cli/2.1.0" }
```

**Response 200**

```json
{
  "device_code":              "<64-hex>",
  "user_code":                "ABCD-1234",
  "verification_uri":         "https://agentlint.sh/cli/auth",
  "verification_uri_complete":"https://agentlint.sh/cli/auth?user_code=ABCD-1234",
  "interval":                 5,
  "expires_in":               600
}
```

Rate limit: 10/min/IP.

### `POST /api/cli/auth/poll` — CLI polls (no auth)

**Request body**

```json
{ "device_code": "<64-hex>" }
```

**Responses**

- `200 { "status": "pending" }` — keep polling.
- `200 { "status": "approved", "token": "agl_proj_...", "project": {...} }` — only returned **once**; subsequent polls return `404 grant_redeemed`.
- `400 { "error": "expired_token" }`
- `400 { "error": "access_denied" }`
- `429 { "error": "slow_down" }` — when caller polls faster than `interval`.

Rate limit: 30/min/device_code.

### `GET /cli/auth?user_code=ABCD-1234` — browser page (session required)

Renders a confirmation page: shows the `user_code` (echoed from query
string so the user verifies it matches their terminal), an org-picker
(if user has >1 org), the scope (`read+write on org <slug>`), and an
"Authorize" button. Anonymous users are redirected to `/login` and
back.

### `POST /api/cli/auth/approve` — user clicks Authorize (session required)

**Request body**

```json
{ "user_code": "ABCD-1234", "org_slug": "personal" }
```

**Responses**

- `200 { "status": "approved" }` — grant marked approved, token minted on the server.
- `404 { "error": "grant_not_found" }`
- `410 { "error": "grant_expired" }`
- `403 { "error": "not_org_member" }`

Rate limit: 5/min/user.

### `POST /api/cli/auth/deny` — user clicks Deny (session required)

Marks grant `denied`. CLI poll then returns `access_denied`.

### `GET /api/cli/projects` (existing, no change in shape)

Still used by `agentlint init` once a token is available.

## CLI surface

### `agentlint login`

Runs device flow. Default endpoint `https://agentlint.sh`, override via
`--endpoint` or `AGENTLINT_URL`.

```
$ agentlint login
Open this URL in your browser:
  https://agentlint.sh/cli/auth?user_code=ABCD-1234

Or enter the code manually at https://agentlint.sh/cli/auth
Code: ABCD-1234

Waiting for authorization...
✓ Authorized. Token saved to ~/.config/agentlint/token.
```

- Opens browser automatically via `open` / `xdg-open` on TTY; suppresses
  on `--no-browser` or non-TTY.
- Polls every `interval` seconds (default 5).
- On success: writes token to `~/.config/agentlint/token` (mode `0600`),
  plus a one-line summary. Token still readable from
  `AGENTLINT_TOKEN` env (env wins over file).
- Exit codes: `0` success, `2` expired, `3` denied, `4` network error.

### `agentlint init` — enhanced

When no token resolvable from env or `~/.config/agentlint/token`,
prompt: `Run 'agentlint login' first? (Y/n)`. On `Y`, run `login`
inline, then continue.

After writing `.agentlint.json`, also write
`.github/workflows/agentlint.yml` from a template — unless
`--no-workflow` is passed or the file already exists, in which case
print a hint.

Workflow template (note: `${{ secrets.AGENTLINT_TOKEN }}` is GitHub
Actions interpolation syntax, not a shell variable):

```yaml
name: agentlint
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
        with: { node-version: 20 }
      - run: npx -y @agentlinthq/cli@latest --push
        env:
          AGENTLINT_TOKEN: ${{ secrets.AGENTLINT_TOKEN }}
```

`init` ends with a copy-pasteable hint for the still-manual step:

```
Next: add AGENTLINT_TOKEN as a repo secret on GitHub:
  https://github.com/<owner>/<repo>/settings/secrets/actions/new
  Name:   AGENTLINT_TOKEN
  Secret: (your token from `~/.config/agentlint/token`)
```

(That manual step is what the follow-up `cli-secret-autoupload` PRD
removes.)

### `agentlint logout`

Deletes `~/.config/agentlint/token`. One-liner.

## UI surface

### New: `/cli/auth`

- Hero: "Authorize agentlint CLI".
- Echo of `user_code` from query string, large font, monospace.
- Org picker (defaults to user's only org if 1; visible if >1).
- Scope description: "This will create a project token (`agl_proj_…`)
  scoped to the org you pick. You can revoke it anytime from the
  dashboard."
- Two buttons: **Authorize** (primary) and **Deny**.
- Post-Authorize state: "✓ You can close this tab and return to your
  terminal."
- Anonymous: redirect to `/login?next=/cli/auth?user_code=…`.

### Updated: `/dashboard/orgs/[slug]`

Add a 4-card metrics row above the existing sparkline and runs list:

| Card | Value | Source |
|---|---|---|
| 7-day avg score | `avg(run.score) WHERE org_id=$1 AND created_at > now()-7d` | server query |
| Runs this week | `count(*) WHERE org_id=$1 AND created_at > date_trunc('week', now())` | server query |
| Pass rate | `count(score >= 80) / count(*)` over 30d | server query |
| Top failing rule | most-common `rules[*].id WHERE status='fail'` aggregated over 30d | server query |

Empty-state copy when no runs yet: "Run `agentlint --push` on a
project to see metrics."

### Updated: `/dashboard/orgs/[slug]/projects/new`

Keep the Vercel-style repo picker (PR #6). Add a second tab:

- **GitHub** (existing repo picker)
- **CLI** — instructions block: `npx @agentlinthq/cli login` →
  `npx @agentlinthq/cli init`. The CLI path is now equivalent to
  creating a project from the web.

### Updated: `/dashboard/orgs/[slug]/projects/[projectId]`

Above the mint/revoke token UI, add a callout: "Prefer the CLI? Run
`agentlint login` then `agentlint init` in your repo — it creates the
token and the workflow file for you."

## Security

- **device_code** is 32 bytes of `randomBytes` hex (64 chars). High
  entropy. Indexed.
- **user_code** is 8 random alphanumerics (excluding `O,0,I,1,L`)
  formatted `XXXX-XXXX` for readability. Indexed. Collision check on
  insert (retry up to 5 times).
- **Token is minted server-side at approve-time** and stored briefly
  in `token_plaintext` on the grant row so the CLI's *first* poll can
  fetch it. The `token_plaintext` column is `NULL`-ed on first
  successful poll-redeem. After `redeemed_at` is set, the grant returns
  `404 grant_redeemed`.
- **Grant TTL: 10 min.** `expires_at` enforced on every poll and on
  the approve route.
- **CSRF**: the `/api/cli/auth/approve` and `/deny` routes are POSTs
  with the session cookie and require the `Origin: https://agentlint.sh`
  header to match. The Authorize button posts via fetch with
  `credentials: 'include'` and `X-Requested-With: agentlint-web`.
- **Rate limits** as per the API table.
- **No PII logged.** `ip_hash` is `sha256(ip + server-secret)`,
  retained for 24h max (cleaned by a cron we'll add in a follow-up;
  not in this slice).
- **Replay protection**: `redeemed_at` makes the grant single-use.
- **Token-file mode**: CLI writes `~/.config/agentlint/token` with
  `chmod 0600`. On read, refuses to use the file if mode is wider.
- **GitHub Actions workflow file generation**: writes only relative to
  cwd, refuses to overwrite if file exists (use `--force-workflow`).

## Rollback

- **Web:** delete the new routes; drop `cli_auth_grant` table. The
  rest of the dashboard works without it. Dashboard metric cards are
  additive — feature-flag `NEXT_PUBLIC_METRICS_ENABLED` defaults true
  but can be set false to hide them server-side.
- **CLI:** revert the `login` subcommand; `init` reverts to v2.0.0
  behavior (no workflow write). Published as a `2.0.x` patch if a
  rollback is needed mid-release; the new functionality ships in
  `2.1.0`.

Documented revert commits live on each PR's description.

## Open questions

All `RESOLVED:` here — the pipeline answered them autonomously per the
charter's disagree-and-commit principle.

- **RESOLVED:** OAuth Device Authorization Grant (RFC 8628) shape
  chosen over a custom setup-link flow. Rationale: spec'd, well-known
  for users, matches `gh auth login` UX. Logged as ADR-0023.
- **RESOLVED:** workflow-file generation defaults **on**. Rationale:
  user complaint was "manual paste-fest"; the workflow file is the
  biggest paste. Opt-out via `--no-workflow` for power users.
- **RESOLVED:** secret auto-upload via GitHub App **deferred** to a
  follow-up slice. Rationale: requires `secrets:write` perm bump and
  every existing install needs to re-consent — a separate, reversible
  decision. Tracked in `docs/prds/cli-secret-autoupload.md` (TBD).
- **RESOLVED:** dashboard metrics computed via raw SQL queries (no
  separate metrics table) for simplicity. If the 4 queries become
  slow at scale, the follow-up is a materialized view or a denormalized
  `org_metrics` cache — not in this slice.
- **RESOLVED:** token file location is `~/.config/agentlint/token`,
  same convention as v1. Brought back specifically for `agentlint
  login` write target; env still wins.

## Issues

Filled in by the `to-issues` step. See below.

---

## Issues (vertical slices)

Five vertical issues. Issues 1, 2, 3 are independent and can run in
parallel. Issue 4 depends on 1+2. Issue 5 depends on 4. The first
three slices are dispatched in parallel; the last two run
sequentially.

### Issue 1 — `feat(web): device-flow CLI auth endpoints + table`

**Repo:** web (`agentlint-sh`)
**Independence:** independent.
**Files in scope:**
- `db/schema.ts` — `cliAuthGrant` table.
- `db/migrations/000X_cli_auth_grant.sql` — generated by `drizzle-kit`.
- `lib/cli-auth/grant.ts` — pure helpers: `generateDeviceCode`,
  `generateUserCode`, collision-aware insert, expire check, redeem.
- `app/api/cli/auth/device/route.ts` — POST start.
- `app/api/cli/auth/poll/route.ts` — POST poll.
- `app/api/cli/auth/approve/route.ts` — POST approve (session).
- `app/api/cli/auth/deny/route.ts` — POST deny (session).
- Tests in `*.test.ts` next to each module.

**Definition of done:**
- `vitest run` shows ≥15 new tests passing (helpers + each route's
  happy + error paths).
- Migration runs cleanly on the Neon **dev** branch via
  `scripts/run-migration.mjs`.
- Manual curl: `POST /api/cli/auth/device` returns the documented
  shape; immediately polling returns `pending`; approve via a logged-in
  session (curl with cookie) flips status; next poll returns the token
  once; next poll after that returns `404 grant_redeemed`.

### Issue 2 — `feat(web): /cli/auth browser page`

**Repo:** web (`agentlint-sh`)
**Independence:** independent (uses Issue 1's routes only after they
ship — but UI can be built against a mock fetch).
**Files in scope:**
- `app/cli/auth/page.tsx` — server component that loads orgs, renders
  the approval form.
- `app/cli/auth/auth-form.tsx` — client component handling the POST
  to `/api/cli/auth/approve`.
- `app/cli/auth/auth-form.test.tsx` — component tests.

**Definition of done:**
- Anonymous users redirect to `/login?next=...` (covered by an
  integration test).
- Logged-in single-org users see the org auto-selected.
- Multi-org users see the org picker.
- Authorize POSTs to `/api/cli/auth/approve` and renders the success
  state on `200`.
- ≥6 new tests passing.

### Issue 3 — `feat(dashboard): metric cards on /dashboard/orgs/[slug]`

**Repo:** web (`agentlint-sh`)
**Independence:** independent.
**Files in scope:**
- `lib/metrics/org-metrics.ts` — pure functions taking a Drizzle DB
  handle (mockable in tests).
- `app/dashboard/orgs/[slug]/metric-cards.tsx` — server component.
- Tests for each of the four queries with an in-test pg fixture (or a
  query-shape test if integration is too slow).

**Definition of done:**
- Four cards render with correct values against seeded fixture data.
- Empty state ("Run `agentlint --push` …") renders when no runs.
- ≥8 new tests passing.
- Visual integration: the cards land above the existing sparkline
  without breaking mobile width.

### Issue 4 — `feat(cli): agentlint login subcommand + token file`

**Repo:** CLI (`agentlint`)
**Independence:** blocked by Issue 1 (device-flow endpoints must
exist).
**Files in scope:**
- `packages/cli/src/login/index.ts` — pure `runLogin` with injectable
  IO (fetch, openBrowser, writeFile, sleep, log).
- `packages/cli/src/login/token-file.ts` — read/write
  `~/.config/agentlint/token` with `0600` enforcement.
- `packages/cli/src/index.ts` — wire `login` subcommand.
- `packages/cli/src/push/token.ts` — fall back to token file when env
  is unset.
- `packages/cli/src/logout/index.ts` — `logout` subcommand.
- Tests next to source.

**Definition of done:**
- `vitest run` shows ≥12 new tests covering happy path (pending →
  approved), expired, denied, network error, file-mode check.
- `pnpm run agentlint .` still reports 100/100 (rules not changed).
- `agentlint login --endpoint http://localhost:3000` against a local
  web dev server completes end-to-end (manual smoke; not asserted by
  CI).

### Issue 5 — `feat(cli): agentlint init writes GitHub Actions workflow`

**Repo:** CLI (`agentlint`)
**Independence:** blocked by Issue 4 (token resolver changes land
together).
**Files in scope:**
- `packages/cli/src/init/index.ts` — extend `runInit` to call into
  `login` when no token is resolvable, then write `.agentlint.json`,
  then write `.github/workflows/agentlint.yml` (unless
  `--no-workflow`).
- `packages/cli/src/init/workflow-template.ts` — pure string template
  + tests.
- Update existing `init/index.test.ts` for the new branches.

**Definition of done:**
- `agentlint init` on a fresh repo with no token prompts to login,
  then writes both files.
- `--no-workflow` skips workflow-file write.
- Refuses to overwrite an existing `.github/workflows/agentlint.yml`
  unless `--force-workflow`.
- ≥6 new tests passing.
- `pnpm run agentlint .` still 100/100.

### Optional Issue 6 — `feat(dashboard): callout + CLI tab on project pages`

**Repo:** web (`agentlint-sh`)
**Independence:** independent.
**Files in scope:**
- `app/dashboard/orgs/[slug]/projects/new/new-project-form.tsx` — add
  CLI tab.
- `app/dashboard/orgs/[slug]/projects/[projectId]/page.tsx` — add the
  callout above the tokens panel.
- Tests for tab toggling.

**Definition of done:** copy renders, tab switching works, no
regressions in the existing repo-picker flow.

This is the smallest issue — a polish pass — and is the last to run.

---

## Dispatch plan

Pipeline executes the issues in this order:

1. **Phase A (parallel):** Issues 1, 2, 3 in three independent
   sub-agents, each with its own worktree on the web repo (or a single
   coordinated branch — see operational note below).
2. **Phase B (sequential):** Issue 4 (depends on 1), then Issue 5
   (depends on 4).
3. **Phase C (optional):** Issue 6 as a polish pass at the end.

**Operational note on worktrees.** The web repo is private and only
checked out once locally at `~/Code/agentlint-sh/`. Three parallel web
issues touching different files can land on a single feature branch
sequentially under one orchestrating agent without a worktree split;
file isolation is enforced by the explicit "files in scope" list per
issue. This is faster than three worktrees for changes this small.

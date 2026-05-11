# PRD — CLI auto-upload of `AGENTLINT_TOKEN` repo secret

**Status:** approved by the autonomous pipeline (2026-05-10, follow-up to `dashboard-ux-cli-autoconnect`).
**Repo split:** web (`agentlint-sh`) + CLI (`agentlint`).
**Slug:** `cli-secret-autoupload`.

## Problem

`dashboard-ux-cli-autoconnect` removed the manual token paste from the
CLI side, but the user still has to open
`https://github.com/<owner>/<repo>/settings/secrets/actions/new` in a
browser, type `AGENTLINT_TOKEN`, paste the token string, click Save. On
multi-repo accounts that's the friction point that kills adoption. The
agentlint GitHub App is already installed for PR-comment posting; it
has the install token; nothing actually stops us from PUT-ing the
secret automatically.

## Non-goals

- **Org-level secrets.** Only repo secrets in this slice. Org secrets
  raise the perm bump higher and need a different UI surface.
- **Other CI providers.** No GitLab, no CircleCI. GitHub Actions only.
- **Auto-removing the secret** on project delete or token revoke. We
  leave the encrypted value in the repo; rotating means re-running
  `install-secret`.
- **Forcing existing App installations to re-consent.** GitHub
  surfaces the new permission prompt on the user's next App-aware
  page-load; we'll add a one-line banner on the dashboard if the App
  is detected without the new scope, but we will not block the rest
  of the dashboard on it.
- **Encrypting on the client.** All encryption happens server-side
  using the install token. The CLI never sees the secret API.

## Success metric

From a fresh user against a repo where the App is installed:

```
$ agentlint login           # device-flow OAuth, writes ~/.config/agentlint/token
$ agentlint init            # writes .agentlint.json + workflow + installs secret
✓ Set AGENTLINT_TOKEN secret on octocat/repo
$ git push                  # CI run lands a row in `run` with provenance=oidc-verified
```

Measured: `GET /repos/<owner>/<repo>/actions/secrets/AGENTLINT_TOKEN`
returns `200 { name: "AGENTLINT_TOKEN", … }` after `agentlint init`
completes, p95 wall under 8s end-to-end (init writes config + workflow
+ uploads secret).

## Schema diff

### Forward (`db/migrations/0002_project_actions_secret.sql`)

```sql
ALTER TABLE project
  ADD COLUMN actions_secret_installed_at timestamptz,
  ADD COLUMN actions_secret_last_error   text;
```

No new table. The column is null until the first successful upload.
`actions_secret_last_error` is set on failure so the dashboard can
show "last attempt failed: <reason>" without storing a full audit
trail.

### Rollback

```sql
ALTER TABLE project
  DROP COLUMN actions_secret_installed_at,
  DROP COLUMN actions_secret_last_error;
```

### Drizzle side

Extend the `project` table in `db/schema.ts`.

## API surface

### `POST /api/projects/:id/install-secret`

**Auth:** session (org admin on the project's org) OR project token
(`Authorization: Bearer agl_proj_…`). Either path checks the project
belongs to the auth context's org.

**Request body**

```json
{}
```

(All required context derives from the project row + auth identity.
No client-supplied secret value — the server mints a fresh project
token for the secret if needed, or reuses the calling project token
when the caller is a CLI.)

**Response 200**

```json
{
  "installed":   true,
  "installedAt": "2026-05-10T22:14:09.812Z",
  "repo":        "octocat/repo"
}
```

**Errors**

| Status | Body | Meaning |
|---|---|---|
| `401` | `{ "error": "unauthorized" }` | Missing/invalid auth. |
| `403` | `{ "error": "not_org_admin" }` | Session user not an admin of the project's org. |
| `403` | `{ "error": "app_lacks_permission", "re_authorize_url": "https://github.com/apps/<slug>/installations/<id>/permissions/update" }` | App installation is on an older permission set. |
| `404` | `{ "error": "project_not_found" }` | Project doesn't exist or auth context can't see it. |
| `409` | `{ "error": "app_not_installed", "install_url": "https://github.com/apps/<slug>/installations/new?state=<orgSlug>" }` | No `installation` row for this repo's org. |
| `502` | `{ "error": "github_api_failed", "status": <github_status> }` | GitHub responded with 5xx or a non-2xx the route can't classify. |

**Rate limit:** 5/min/project.

**Idempotency:** PUT-ing the secret is idempotent on the GitHub side
(the value is overwritten). Our route's effect on `project.actions_secret_installed_at`
is "always set to `now()` on success."

### Server-side encryption helper

`lib/github-app/secrets.ts`:

```ts
export async function setRepoActionsSecret(args: {
  installationId: number;
  owner:          string;
  repo:           string;
  name:           "AGENTLINT_TOKEN";
  value:          string;
  fetchFn?:       typeof fetch;
}): Promise<{ ok: true } | { ok: false; status: number; reason: string }>;
```

Uses `libsodium-wrappers` `crypto_box_seal` against the public key
fetched from
`GET /repos/:owner/:repo/actions/secrets/public-key`, then PUTs to
`/repos/:owner/:repo/actions/secrets/<name>`.

## CLI surface

### `agentlint install-secret`

New subcommand. Looks up the project from `.agentlint.json`, calls
`POST /api/projects/:id/install-secret` with the configured token,
prints the outcome.

### `agentlint init` — integrated

After writing `.agentlint.json` and `.github/workflows/agentlint.yml`,
`init` calls the install-secret route (unless `--no-install-secret`
or `INIT` was invoked with `--no-workflow`, which implies the user
isn't using GitHub Actions). On success:

```
✓ Set AGENTLINT_TOKEN secret on octocat/repo (App installation token).
```

On `409 app_not_installed`:

```
✗ GitHub App not installed on this repo. Install it at:
  https://github.com/apps/agentlint-ci/installations/new?state=<orgSlug>
Then run: agentlint install-secret
```

On `403 app_lacks_permission`:

```
✗ The agentlint App needs the "Actions secrets: write" permission.
  Re-authorize the App at:
  https://github.com/apps/agentlint-ci/installations/<id>/permissions/update
Then run: agentlint install-secret
```

New flags:

- `--no-install-secret` — skip the secret upload step (and skip the
  workflow file too if the user has their own deploy method).

## UI surface

### `/dashboard/orgs/[slug]/projects/[projectId]` — new panel

New card "GitHub Actions secret" above the existing "Project tokens"
panel:

| State | Render |
|---|---|
| `actions_secret_installed_at` is set | "✓ `AGENTLINT_TOKEN` installed on `<owner>/<repo>` — `<relative time>` ago" + a "Re-install" button. |
| `actions_secret_installed_at` is null AND App is installed | "Install `AGENTLINT_TOKEN` on this repo" button. POSTs to `/api/projects/:id/install-secret` then refreshes. |
| `actions_secret_installed_at` is null AND App is **not** installed | Install-App CTA pointing at the App's install URL. |
| `actions_secret_last_error` is set | Render the previous "ready" or "App missing" state plus a red error chip with the last error message. |

### Banner on the org dashboard

If any `installation` row for this org has `permissions_actions_secrets` not equal to `"write"` (we'll detect during the `installation_repositories` webhook handler from now on, and via a one-shot check on the existing rows), render a banner:

> agentlint now installs your CI secret automatically. Re-authorize the
> App to enable it: [Update permissions →]

This banner is informational; it doesn't block the dashboard.

## Security

- **The secret value is generated server-side.** When the route is
  called with a session, the server mints a fresh project token
  (`agl_proj_…`) and uses *that* as the secret value. When the route
  is called with a project token, the server reuses the calling
  token's underlying project record but mints a fresh secret value
  (we never write the *first* token back into a repo secret because
  the user already has it on disk; rotating is a good default).

  **Pragmatic alternative considered and rejected**: pass the
  existing token value through. Rejected because once the secret is
  written, the user no longer needs the local token file — they can
  `agentlint logout` and the workflow still works. Minting a fresh
  one keeps the local copy a "dev only" credential.

- **Token at rest.** The server-side flow writes the freshly minted
  token to the GitHub Actions encrypted secret API and immediately
  drops the plaintext from memory (no logs, no return body except the
  installed timestamp).

- **App permission bump.** The agentlint App needs `Secrets: Read &
  write` on Actions. Existing installations have only `Pull requests:
  R/W`, `Contents: R`, `Checks: R/W`, `Metadata: R`. The maintainer
  must bump perms on the App's Settings page in GitHub UI — that
  triggers a re-consent prompt on the user's next App-aware
  interaction. **This is the manual step that cannot be automated.**

- **CSRF.** The route accepts POST with session cookie + `Origin:
  https://<env>.agentlint.sh` check. Project-token auth bypasses
  CSRF (no cookie involved).

- **Rate limit.** 5/min/project.

- **What's logged.** Outcome only (`installed | failed`), reason
  enum, project ID. No token, no public-key, no repo content.

- **App private key.** Already lives in
  `GITHUB_APP_PRIVATE_KEY_B64`. No change.

- **libsodium-wrappers.** ~30KB minified, pure JS, no native build.
  Pulled in at server-runtime only.

## Rollback

- **Web:** delete the new route file; drop the two columns; revert
  `db/schema.ts`. The dashboard's existing project page works
  without the new panel. `libsodium-wrappers` dep can stay (idle) or
  be removed in the same revert PR.
- **CLI:** revert the `install-secret` subcommand; revert the
  one-call addition to `runInit`. `agentlint init` falls back to
  printing the manual paste hint.
- **App permission bump:** the bump itself is a GitHub-side action
  on the App settings page, not in code. To revert, the maintainer
  downgrades the permission back to the previous set; existing
  installs get the next re-consent prompt to confirm.

The rollback is fully reversible. Documented revert commit:
`git revert <merge-sha>`.

## Open questions

All resolved by the pipeline. Recorded as ADR-0025.

- **RESOLVED:** Fresh token per install-secret call (not pass-through).
  Rationale above.
- **RESOLVED:** `libsodium-wrappers` over `tweetnacl-sealedbox-js`. The
  former is what GitHub's official docs reference; both implement the
  same primitive.
- **RESOLVED:** Schema is two new columns on `project`, not a separate
  table. Simpler; no FK; no migration races.
- **RESOLVED:** The App permission bump cannot be automated — the App
  owner clicks in GitHub UI. Manual step documented in the close-out.

---

## Issues (vertical slices)

Three issues; web 1+2 land together as a single PR, CLI is its own
PR. Issue 4 (dashboard panel) is a small polish issue bundled into
the web PR. Total: 1 web PR, 1 CLI PR.

### Issue 1 — `feat(web): GitHub App secrets helper + libsodium dep`

**Repo:** web (`agentlint-sh`).
**Files in scope:**
- `package.json` — add `libsodium-wrappers` and its `@types/libsodium-wrappers`.
- `lib/github-app/secrets.ts` — `setRepoActionsSecret` helper.
- `lib/github-app/secrets.test.ts` — unit tests with mocked fetch (≥6).

**Definition of done:**
- Helper accepts inputs documented above and returns the documented
  result shape.
- Tests cover: happy path, missing public key, encryption deterministic
  shape, GitHub PUT 5xx → `ok:false`.

### Issue 2 — `feat(api,db): install-secret route + project schema bump`

**Repo:** web.
**Files in scope:**
- `db/schema.ts` — add `actionsSecretInstalledAt`, `actionsSecretLastError`.
- `db/migrations/0002_project_actions_secret.sql` — ALTER TABLE.
- `app/api/projects/[id]/install-secret/route.ts` — POST handler.
- `app/api/projects/[id]/install-secret/route.test.ts` — ≥10 tests.

**Definition of done:**
- Migration generates cleanly.
- Route covers all eight outcomes in the API table (200, 401, 403×2,
  404, 409, 502, and rate-limit 429).
- Token minted server-side at PUT-time; not echoed in response body.

### Issue 3 — `feat(dashboard): GitHub Actions secret panel on project page`

**Repo:** web.
**Files in scope:**
- `app/dashboard/orgs/[slug]/projects/[projectId]/page.tsx` — new
  panel above the existing token panel.
- `app/dashboard/orgs/[slug]/projects/[projectId]/secret-panel.tsx`
  — client component (button + state).
- Tests for the four render states (≥4).

**Definition of done:**
- All four states render with seeded fixture data.
- Clicking the install button POSTs to the route and updates state on
  success.
- Re-install button visible when already installed.

### Issue 4 — `feat(cli): agentlint install-secret subcommand + init integration`

**Repo:** CLI (`agentlint`).
**Files in scope:**
- `packages/cli/src/install-secret/index.ts` — pure
  `runInstallSecret(deps)`.
- `packages/cli/src/install-secret/index.test.ts` — ≥8 tests.
- `packages/cli/src/index.ts` — wire subcommand.
- `packages/cli/src/init/index.ts` — call `runInstallSecret` after
  writing the workflow, unless `--no-install-secret`. Render the 409
  / 403 hints documented above.
- `packages/cli/src/init/index.test.ts` — extend.

**Definition of done:**
- `agentlint install-secret` POSTs to
  `/api/projects/:id/install-secret` and renders the outcome.
- `agentlint init` calls the route by default; `--no-install-secret`
  skips.
- 409 + 403 + 502 paths render the hinted action.
- `pnpm run agentlint .` still reports 100/100.

---

## Dispatch plan

1. **Phase A (parallel):**
   - Sub-agent W on web — issues 1 + 2 + 3, single branch
     `feat/cli-secret-autoupload`, single PR into `dev`.
   - Sub-agent C on CLI — issue 4, branch
     `feat/cli-install-secret`, PR into `main`. CLI agent reads the
     API contract from this PRD and writes against it with mocked
     fetch (server doesn't need to be live for CLI tests to pass).
2. **Phase B (sequential):** Close-out. Apply the new web migration to
   Neon dev branch is a manual maintainer step (same posture as
   slice-7 schema cutover).
3. **Manual hand:** App permission bump on the GitHub App settings
   page (cannot be automated). Documented in the close-out summary.

# PRD: `agentlint --push` + report ingest

**Slice:** P1 #4 (PROJECT_STATE)
**Status:** in flight (2026-05-10)
**Owner:** Claude Code (autonomous)
**Repos touched:** `agentlint/agentlint` (CLI), `agentlint/agentlint.sh` (web)

## Problem

Pro/Team subscriptions are pulled (ADR-0012). The first feature on
the unblock list is "the CLI uploads a report somewhere the user can
look at later." Nothing about scoring or dashboarding works without
this pipe. It is the foundation for slices 5–9.

## Non-goals

- No org-level dashboards. Single-user only this slice.
- No PR comments, no GitHub App. That is slice 7.
- No public score badge. That is slice 6.
- No retention policies. Runs persist forever for now; cleanup is
  a future ops chore.
- No token rotation UI. Generate a token once, copy it, never see
  it again. Revoke = delete + regenerate.
- No rate limiting beyond a hard per-token cap (10 req/min).

## Success metric

A user with a session can:

1. Visit `/dashboard/tokens`, generate a token, copy it.
2. From any directory: `AGENTLINT_TOKEN=<t> agentlint --push .`
3. The CLI prints the score, posts the JSON report, and prints a
   link to `/dashboard` where the run is listed with score + date.
4. End-to-end p95 < 3 seconds on a small repo, < 10 seconds on a
   medium one.

Verifiable check: a fresh test user can complete the loop in under
two minutes from a cold start.

## Schema diff

Two new tables in `agentlint-sh/db/schema.ts`:

```ts
// api_tokens — one row per generated token, the plaintext token
// is shown to the user exactly once
export const apiToken = pgTable("api_token", {
  id: text("id").primaryKey(),                   // ulid-like
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),                  // user label, e.g. "ci"
  tokenHash: text("token_hash").notNull(),       // sha256(token)
  prefix: text("prefix").notNull(),              // first 8 chars for UI display
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
  revokedAt: timestamp("revoked_at"),
});

// runs — one row per `agentlint --push`
export const run = pgTable("run", {
  id: text("id").primaryKey(),                   // ulid-like
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  tokenId: text("token_id")
    .references(() => apiToken.id, { onDelete: "set null" }),
  repoOwner: text("repo_owner"),                 // nullable until detected
  repoName: text("repo_name"),
  score: integer("score").notNull(),             // 0–100
  passes: integer("passes").notNull(),
  fails: integer("fails").notNull(),
  warnings: integer("warnings").notNull(),
  skipped: integer("skipped").notNull(),
  reportJson: jsonb("report_json").notNull(),    // full report
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

Indexes: `(userId, createdAt desc)` on `run`, `(userId, revokedAt)`
on `apiToken`.

Forward via `pnpm db:push` against both Neon prod and dev branches.
Rollback: `drop table run; drop table api_token;`. Both cascade
from the user table; deleting a user removes both.

## API surface

All paths under `agentlint.sh/app/api/`. JSON request/response.
Errors follow `{ error: string }` envelope.

### `POST /api/tokens`

Auth: session cookie.
Body: `{ name: string }` (1–32 chars).
Response 201: `{ token: string, prefix: string, id: string }`.
The `token` field is shown once and never returned again.

### `GET /api/tokens`

Auth: session cookie.
Response 200: `{ tokens: Array<{ id, name, prefix, createdAt, lastUsedAt, revoked }> }`.

### `DELETE /api/tokens/:id`

Auth: session cookie. User must own the token.
Effect: sets `revokedAt = now`. Does not delete the row, so old
runs can still link to it for audit.
Response 204.

### `POST /api/runs`

Auth: `Authorization: Bearer <token>` header.
Body:
```json
{
  "score": 0-100,
  "passes": int,
  "fails": int,
  "warnings": int,
  "skipped": int,
  "repo": { "owner": "string|null", "name": "string|null" },
  "report": { ...full agentlint JSON report... }
}
```
Response 201: `{ id: string, url: "/dashboard" }`.
Validation: zod schema, body size < 1 MB.
Rate limit: 10 req/min/token (in-memory bucket, fine for now —
single instance).
On success: insert row, update `apiToken.lastUsedAt`.

## CLI surface

New flag in `packages/cli/src/index.ts`:

```
agentlint --push [path]
agentlint --push --url https://agentlint.sh [path]
```

Behavior:
- Runs the normal scan.
- If `--push` is present:
  - Read token: `AGENTLINT_TOKEN` env var first, then
    `~/.config/agentlint/token` (file with `chmod 600`).
  - Read endpoint: `--url` flag, then `AGENTLINT_URL` env var,
    then default `https://agentlint.sh`.
  - Detect repo owner/name from `git config --get remote.origin.url`
    if available; otherwise null.
  - POST `/api/runs` with the report JSON.
  - On 201: print `Pushed: https://agentlint.sh/dashboard`.
  - On 401/403: print `Push failed: invalid or revoked token` and
    exit 0 (the local audit still ran fine; push is a side
    effect).
  - On 5xx or network error: print `Push failed: <reason>` and
    exit 0. Never block the user's CI.

Local-first invariant intact: the flag is **opt-in**. Without
`--push`, no network call.

## UI surface

### `/dashboard` (existing page, modified)

Add a `Recent runs` section above the existing `Subscription`
section. Renders the last 20 runs:

```
| date         | repo               | score | passes | fails |
| 2026-05-10   | agentlint/x        |  92   | 22     |  2    |
| ...
```

Empty state: "No runs yet. `npm i -g @agentlinthq/cli` and run
`agentlint --push` to get started."

### `/dashboard/tokens` (new page)

- "Create token" button → modal with `name` input → POST → shows
  the token in a copyable box with a one-time-display warning.
- List of existing tokens: `name | prefix… | created | last used |
  revoke button`.
- Empty state: explanatory copy + button.

## Security

- Token: 32 random bytes, base32-encoded, prefixed with `agl_`.
  Total length 56 chars.
- Storage: `tokenHash = sha256(token)`. Never log the plaintext.
  `prefix = token.slice(0, 8)` for UI display only.
- Comparisons use `crypto.timingSafeEqual`. Rate limit per token to
  cap brute force.
- Bearer token over HTTPS only. The CLI refuses to send to a
  non-https URL unless the user passes `--insecure` (undocumented
  escape for local testing).
- Report payloads are bounded to 1 MB. Reject larger.
- Audit fields: `lastUsedAt` updated atomically with insert.
  `revokedAt` set on DELETE; revoked tokens fail with 401.

## Rollback

- Feature flag `NEXT_PUBLIC_PUSH_ENABLED` gates the UI sections in
  `/dashboard` and `/dashboard/tokens`. Setting it to `false`
  hides the entry points without code changes.
- The CLI flag stays opt-in, so a server-side revert (drop tables)
  doesn't strand any users — `--push` simply returns
  "endpoint unavailable" and the local scan still succeeds.
- Drop migration committed alongside the up migration so the
  rollback is one `psql -f` away.

## Open questions

None.

## Issues

Vertical, in dispatch order:

1. **Web — schema + tokens API.** `db/schema.ts` migration, three
   token routes (POST/GET/DELETE under `/api/tokens`), unit tests
   for token generation + hashing, integration test for the route
   with a mocked auth session.

2. **Web — ingest route.** `POST /api/runs` with bearer auth,
   token-bucket rate limit, zod validation, repo+score row insert,
   `lastUsedAt` update. Tests for happy path, 401, 413 (oversized),
   429 (rate-limited).

3. **Web — `/dashboard/tokens` page + dashboard run list.** Server
   component fetches tokens via the API; client component for the
   create-token modal + revoke button. Run list is a server query
   directly against drizzle.

4. **CLI — `--push` flag.** New flag in
   `packages/cli/src/index.ts`. Token resolver
   (`packages/cli/src/push/token.ts`) reads env then file. POST
   helper (`packages/cli/src/push/client.ts`) with a fetch timeout.
   Wired into the existing report flow after the local report is
   computed. Tests cover env-only, file-only, both, neither (no
   push), HTTP success, HTTP failure (must not exit non-zero).

5. **Cross-repo smoke test.** Manual: a developer (or the agent in
   a follow-up session) generates a token on a deployed preview,
   runs the CLI built from the slice 4 branch, and confirms the
   row lands. No automated cross-repo test — that's a slice 4.5.

Issue #5 is human-verifiable and runs after the four PRs ship.

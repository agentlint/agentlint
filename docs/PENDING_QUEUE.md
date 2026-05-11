# Pending queue — overnight autonomous loop

> Source of truth for `scripts/loop/run.sh`. Machine-readable companion lives at
> `scripts/loop/dag.json`. Per-slice precise instructions live under
> `scripts/loop/briefs/<slug>.md`.
>
> This file is the human-readable digest. When a slice ships, the loop moves the
> entry to `docs/PROJECT_STATE.md` § "Done — recent" and crosses it out here.

## How the loop walks this list

The loop walks tiers in order. Within a tier, slices marked `parallel: true`
dispatch concurrently — each in its own `git worktree`. The next tier starts
only after every slice in the current tier has reported back (success or fail).

A slice failure does **not** block its tier siblings, but **does** block any
downstream slice that depends on it. (Today no slice has a hard dependency on
another — that's the point of vertical slicing.)

## DAG

### Tier 0 — small, surgical, fully independent (parallel)

These four touch disjoint files. Safe to run concurrently.

1. **`cli-runscan-export`** — CLI repo. Promote `runScan` to a programmatic
   export on `@agentlinthq/cli`. Unblocks the deep-import workaround in the
   web scan-worker (ADR-0030 follow-up).
2. **`failed-scans-log`** — web repo. New `scan_failure` table + admin view +
   per-run "Why did this fail?" panel. Replaces the current `report_json =
   { version: "server-failed", error }` shoehorn (ADR-0030).
3. **`run-public-toggle`** — web repo. POST/DELETE
   `/api/runs/:id/public` so the dashboard can flip a run public/private
   after the fact (currently only the CLI `--public` flag does this; carry-over
   from slice 6).
4. **`github-app-install-card`** — web repo. Dashboard card on
   `/dashboard/orgs/:slug/projects/:projectId` that detects whether the
   App is installed for the project's owner and shows an install CTA when
   not (carry-over from slice 7).

### Tier 1 — small but touches shared files (parallel)

5. **`dependabot-triage`** — web repo. Walk the 4 dependabot alerts on
   `agentlint/agentlint.sh`, auto-merge those whose blast radius is trivial,
   open ADRs for the rest.
6. **`leaderboard-runner`** — both repos. Bin entrypoint at
   `tools/leaderboard/src/run.ts`, weekly GitHub Action, public
   `/leaderboard` page in `agentlint.sh`. First public run at top 100.

### Tier 2 — Team tier, sequential

7. **`org-dashboard-team`** — web repo. List of repos in an org with their
   latest scores; gated by Team subscription (slice 8 from PROJECT_STATE).

### Tier 3 — Team tier, depends on Tier 2 schema

8. **`policy-thresholds-team`** — CLI + web. Org admins set a minimum
   passing score; CLI reads the org policy via `--push` response and exits
   non-zero if below threshold (slice 9 from PROJECT_STATE).

### Tier 4 — Stripe live products (no charges)

9. **`stripe-live-products`** — web repo. Create live-mode Stripe products
   and prices matching the test-mode set. Land the four `STRIPE_*` env vars
   on Vercel **production target only**. Do **not** flip the UI to live yet.
   This is structural plumbing — no customer is ever charged.

### Tier 5 — flip paid tiers back on

10. **`revert-adr-0012`** — web repo. Revert ADR-0012: re-enable Pro/Team
    on `/pricing` and `/dashboard`. Append ADR-00XX referencing what shipped
    in tiers 2–4 as the gating criteria the original ADR called out.

### Tier 6 — CLI release roll-up

11. **`cli-release-2-2-0`** — CLI repo. Roll up tier 0 / tier 3 CLI changes
    into a minor release. Bump version, regenerate changelog, tag, run the
    `publish-cli.yml` workflow. (`NPM_TOKEN` secret is already set; the
    workflow handles the publish step.)

## Out of scope tonight (charter §3.2 hard line)

The loop **will not**:

- Publish any post, tweet, HN submission, Product Hunt listing, or
  changelog entry to a public-facing channel.
- Reply to issues or Discussions on behalf of the project.
- Send transactional or marketing emails.
- Charge a Stripe customer or move any money.
- Purchase domains, SaaS subscriptions, or any paid service.

If a slice's pipeline tries to draft a public post, the loop drafts it
into `docs/marketing/drafts/<slug>.md` and logs `ESCALATE: human sign-off
required for <slug>` — the human ships it in the morning.

## How to start the loop

```bash
./scripts/loop/run.sh           # full DAG
./scripts/loop/run.sh --tier 0  # only tier 0
./scripts/loop/run.sh --dry-run # print plan, run no slices
./scripts/loop/run.sh --resume  # skip slices already marked done in state/
```

Live progress: tail `scripts/loop/logs/<timestamp>-<slug>.log` per slice and
`scripts/loop/state/run.jsonl` for the run journal.

To kill mid-flight: `pkill -f overnight-loop` then inspect
`scripts/loop/state/in-flight.json` for any stranded worktrees.

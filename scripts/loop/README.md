# Overnight autonomous loop

> Mechanism that ships pending agentlint slices unattended. Walks the DAG in
> `dag.json`, dispatches each slice to a `claude -p` subprocess inside an
> isolated git worktree, integrates results, and journals everything to
> disk for morning review.

## Files

```
scripts/loop/
├── dag.json              # DAG declaration (tiers + slices)
├── guardrails.md         # system prompt addendum (tonight's overrides)
├── run.sh                # DAG walker
├── dispatch.sh           # single-slice subprocess wrapper
├── briefs/<slug>.md      # per-slice precise instructions
├── logs/<ts>-<slug>.log  # per-slice transcript (created at runtime)
└── state/
    ├── done.txt          # line-separated list of completed slugs
    └── run.jsonl         # append-only journal (one JSON per line)
```

Companion human-readable queue: [`docs/PENDING_QUEUE.md`](../../docs/PENDING_QUEUE.md).

## Prereqs

- `claude` CLI in `$PATH` (Claude Code, logged in with the user's Anthropic
  subscription — no `ANTHROPIC_API_KEY` required).
- `jq` (`brew install jq`).
- `gh` CLI authenticated with the agentlint org (`gh auth status` must
  show `keyring` token).
- Both repos present on disk:
  - `~/Code/agentlint` (this repo)
  - `~/Code/agentlint-sh` (web repo)
- Both repos clean (no uncommitted changes on the parent worktree). The
  loop creates new worktrees in `~/Code/agentlint-loop/<slug>` and
  `~/Code/agentlint-sh-loop/<slug>` so the parent is never touched.

## Launching

From the CLI repo root:

```bash
# Print the plan, run nothing
./scripts/loop/run.sh --dry-run

# Run tier 0 only (the four small, independent slices in parallel)
./scripts/loop/run.sh --tier 0

# Run a single slice
./scripts/loop/run.sh --slug cli-runscan-export

# Full overnight run
./scripts/loop/run.sh

# Resume from where the loop stopped (skips slices already marked done)
./scripts/loop/run.sh --resume
```

## Monitoring while the loop runs

```bash
# Tail the run journal
tail -F scripts/loop/state/run.jsonl

# Tail a specific slice's transcript
tail -F scripts/loop/logs/*cli-runscan-export.log

# See what's shipped vs. pending
cat scripts/loop/state/done.txt
```

## Stopping

```bash
# Graceful: Ctrl-C in the foreground terminal. Kills in-flight dispatchers,
#          journals an "interrupt" event, exits.

# Hard: pkill -f overnight-loop  (then clean up stranded worktrees by hand:
#       git -C ~/Code/agentlint worktree list
#       git -C ~/Code/agentlint worktree remove <path>)
```

## After the loop

In the morning, inspect:

1. `cat scripts/loop/state/done.txt` — what shipped
2. `jq -c 'select(.event == "slice_escalate" or .event == "slice_fail")'
   scripts/loop/state/run.jsonl` — what needs attention
3. `gh pr list --search "author:@me feat/"` — open PRs across both repos
4. `git -C ~/Code/agentlint worktree list` and
   `git -C ~/Code/agentlint-sh worktree list` — clean up stale worktrees

The standard close-out (`pnpm run ci`, `pnpm run agentlint .`,
`PROJECT_STATE` update) happens **inside** each slice's subprocess
already — you should not need to re-run them at the parent level unless
a slice failed.

## How a slice is dispatched

Per slice, `dispatch.sh`:

1. Creates `feat/<slug>` in the appropriate repo (CLI or web).
2. Adds a `git worktree` for that branch under `~/Code/agentlint-loop/`
   or `~/Code/agentlint-sh-loop/`.
3. Invokes:
   ```bash
   claude \
     --dangerously-skip-permissions \
     --append-system-prompt "$(cat scripts/loop/guardrails.md)" \
     --add-dir <both repos and both worktrees> \
     -p "<assembled prompt with brief + skill invocation>"
   ```
4. Captures stdout/stderr to `scripts/loop/logs/<ts>-<slug>.log`.
5. On rate-limit error: sleeps to the next hour boundary, retries once.
6. Returns the subprocess exit code; `run.sh` greps the log for
   `SHIPPED:` / `ESCALATE:` to score the slice.

## Failure handling

| Outcome | Detection | Action |
|---------|-----------|--------|
| Slice ships | log contains `SHIPPED:` | mark done, continue |
| Slice escalates | log contains `ESCALATE:` | mark not-done, continue, tier siblings still run |
| Slice fails | subprocess exit != 0 OR no summary line | journal `slice_fail`, continue, but 3 consecutive fails in a tier abort the run |
| Rate limit | claude exit != 0 + log matches rate-limit regex | sleep to next hour, retry once per slice |
| Ctrl-C | SIGINT to runner | kill all in-flight dispatchers, journal `interrupt`, exit 130 |

## Safety invariants the loop enforces

- **Worktree isolation.** Each slice has its own checkout; concurrent
  slices can't stomp on each other's files.
- **Branch namespace.** All loop branches live under `feat/<slug>`.
- **No force-push to main.** Guardrails forbid it; merges are squash
  via PR.
- **No public comms.** Guardrails forbid HN/X/PH/blog posts; drafts
  only.
- **No money movement.** Guardrails forbid charging Stripe customers
  or buying paid services.

## Adding a new slice

1. Write `scripts/loop/briefs/<slug>.md` with the same shape as the
   existing briefs (one-line goal, repo, DoD, scope in/out, charter check).
2. Add the slice to the appropriate tier in `dag.json`.
3. Update the digest in `docs/PENDING_QUEUE.md`.
4. Done. The runner will pick it up on the next pass.

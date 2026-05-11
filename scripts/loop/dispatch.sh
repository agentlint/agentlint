#!/usr/bin/env bash
# Single-slice dispatcher.
#
# Creates an isolated git worktree, invokes claude -p with the brief +
# guardrails, captures the transcript, integrates the result.
#
# Called by scripts/loop/run.sh as:
#   dispatch.sh <slug> <repo> <brief-path-relative-to-cli-repo> <log-path>
#
# repo: "cli" | "web" | "both"
#   "cli"  → worktree under ~/Code/agentlint-loop/<slug>      from ~/Code/agentlint
#   "web"  → worktree under ~/Code/agentlint-sh-loop/<slug>   from ~/Code/agentlint-sh
#   "both" → both worktrees created; subprocess starts in the CLI worktree
#            and is told via env about the web worktree path.
#
# Exit codes:
#   0  → slice subprocess exited cleanly (caller still greps log for SHIPPED:/ESCALATE:)
#   1  → setup failure (couldn't create worktree, etc.)
#   2  → bad args
#  124 → wall-clock timeout
#  130 → SIGINT propagated

set -euo pipefail

SLUG="${1:-}"
REPO="${2:-}"
BRIEF_PATH="${3:-}"
LOG="${4:-}"

if [[ -z "$SLUG" || -z "$REPO" || -z "$BRIEF_PATH" || -z "$LOG" ]]; then
  echo "usage: dispatch.sh <slug> <repo> <brief-path> <log-path>" >&2
  exit 2
fi

CLI_REPO="$HOME/Code/agentlint"
WEB_REPO="$HOME/Code/agentlint-sh"
CLI_WT_ROOT="$HOME/Code/agentlint-loop"
WEB_WT_ROOT="$HOME/Code/agentlint-sh-loop"

CLI_WT="$CLI_WT_ROOT/$SLUG"
WEB_WT="$WEB_WT_ROOT/$SLUG"
BRANCH="feat/$SLUG"

GUARDRAILS="$CLI_REPO/scripts/loop/guardrails.md"
ABS_BRIEF="$CLI_REPO/$BRIEF_PATH"

if [[ ! -f "$ABS_BRIEF" ]]; then
  echo "dispatch: brief not found at $ABS_BRIEF" >&2
  exit 1
fi
if [[ ! -f "$GUARDRAILS" ]]; then
  echo "dispatch: guardrails not found at $GUARDRAILS" >&2
  exit 1
fi

mkdir -p "$CLI_WT_ROOT" "$WEB_WT_ROOT"

# --------------------------------------------------------------------- worktrees
create_worktree() {
  local repo_root="$1"
  local wt_path="$2"
  if [[ -d "$wt_path" ]]; then
    echo "dispatch: worktree already exists at $wt_path — reusing"
    return 0
  fi
  # If the branch already exists from a previous run, check it out into the worktree.
  if git -C "$repo_root" rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
    git -C "$repo_root" worktree add "$wt_path" "$BRANCH"
  else
    # Create from the repo's default upstream (main for CLI, dev for web).
    local base="main"
    if [[ "$repo_root" == "$WEB_REPO" ]]; then
      base="dev"
    fi
    git -C "$repo_root" fetch origin "$base" --quiet || true
    git -C "$repo_root" worktree add -b "$BRANCH" "$wt_path" "origin/$base"
  fi
}

START_CWD=""
case "$REPO" in
  cli)
    create_worktree "$CLI_REPO" "$CLI_WT"
    START_CWD="$CLI_WT"
    ;;
  web)
    create_worktree "$WEB_REPO" "$WEB_WT"
    START_CWD="$WEB_WT"
    ;;
  both)
    create_worktree "$CLI_REPO" "$CLI_WT"
    create_worktree "$WEB_REPO" "$WEB_WT"
    START_CWD="$CLI_WT"
    ;;
  *)
    echo "dispatch: bad repo: $REPO" >&2
    exit 2
    ;;
esac

# --------------------------------------------------------------------- prompt
USER_PROMPT="$(cat <<EOF
You are running the agentlint overnight loop for slice: ${SLUG}

## Worktree

You are in: ${START_CWD}
$( [[ "$REPO" == "both" ]] && echo "Web repo worktree: ${WEB_WT}" )

Branch: ${BRANCH}

## Brief

$(cat "$ABS_BRIEF")

## Pipeline

Run the agentlint-feature-pipeline skill on this slice. Mode A —
feature is explicitly described above. Do NOT pick from
PROJECT_STATE; do what's in this brief. When the skill says
"close-out", actually open and merge the PR per the guardrails.

End your run with the three-bullet SHIPPED/PENDING/NEXT summary as
the final lines of output.
EOF
)"

# --------------------------------------------------------------------- invoke
echo "dispatch: $SLUG starting at $(date -u +%H:%M:%SZ) in $START_CWD" | tee -a "$LOG"

# We invoke claude -p with --dangerously-skip-permissions per tonight's
# overrides. The CLI subprocess inherits our env, including any
# ANTHROPIC_* and GH_TOKEN tokens.
#
# Rate-limit handling: if claude exits non-zero AND the log shows a
# rate-limit phrase, sleep to the next hour boundary and retry once.

attempt=1
max_attempts=2
rc=0

while [[ $attempt -le $max_attempts ]]; do
  echo "dispatch: attempt $attempt/$max_attempts at $(date -u +%H:%M:%SZ)" | tee -a "$LOG"

  set +e
  (
    cd "$START_CWD"
    AGENTLINT_LOOP_SLUG="$SLUG" \
    AGENTLINT_LOOP_CLI_WT="$CLI_WT" \
    AGENTLINT_LOOP_WEB_WT="$WEB_WT" \
    claude \
      --dangerously-skip-permissions \
      --append-system-prompt "$(cat "$GUARDRAILS")" \
      --add-dir "$CLI_REPO" "$WEB_REPO" "$CLI_WT" "$WEB_WT" \
      -p "$USER_PROMPT"
  ) >> "$LOG" 2>&1
  rc=$?
  set -e

  if [[ $rc -eq 0 ]]; then
    break
  fi

  # Rate-limit detection.
  if grep -iE "rate.?limit|too many requests|usage.?limit" "$LOG" >/dev/null 2>&1; then
    next_hour=$(($(date +%s) + 3600 - $(date +%s) % 3600 + 60))
    sleep_for=$((next_hour - $(date +%s)))
    echo "dispatch: rate-limit detected — sleeping ${sleep_for}s until next window" | tee -a "$LOG"
    sleep "$sleep_for"
    ((attempt++))
    continue
  fi

  # Non-rate-limit failure — no retry.
  break
done

echo "dispatch: $SLUG finished at $(date -u +%H:%M:%SZ) rc=$rc" | tee -a "$LOG"

# Surface the SHIPPED / ESCALATE line near the end of the transcript so
# the runner's grep finds it.
tail -200 "$LOG" | grep -E "^(SHIPPED|ESCALATE|PENDING|NEXT):" >> "$LOG" 2>/dev/null || true

exit "$rc"

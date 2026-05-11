#!/usr/bin/env bash
# Overnight autonomous loop — DAG walker.
#
# Walks scripts/loop/dag.json tier-by-tier. Within a tier, dispatches
# slices in parallel if the tier declares parallel:true. Each slice runs
# in its own git worktree via scripts/loop/dispatch.sh.
#
# Usage:
#   ./scripts/loop/run.sh                # full DAG
#   ./scripts/loop/run.sh --tier 0       # only tier 0
#   ./scripts/loop/run.sh --dry-run      # print plan, no slices
#   ./scripts/loop/run.sh --resume       # skip slices marked done
#   ./scripts/loop/run.sh --slug <slug>  # single slice
#
# State files:
#   scripts/loop/state/run.jsonl   — append-only journal (one JSON per line)
#   scripts/loop/state/done.txt    — line-separated list of completed slugs
#   scripts/loop/logs/<ts>-<slug>.log — per-slice transcript
#
# Hard stops:
#   - 3 consecutive slice failures in the same tier abort the run.
#   - Any slice that prints "ESCALATE:" exits 0 but marks downstream skipped.
#   - SIGINT (Ctrl-C) kills all in-flight dispatchers and exits.

set -euo pipefail

# --------------------------------------------------------------------- paths
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOOP_DIR="$ROOT/scripts/loop"
STATE_DIR="$LOOP_DIR/state"
LOG_DIR="$LOOP_DIR/logs"
DAG_FILE="$LOOP_DIR/dag.json"
DISPATCH="$LOOP_DIR/dispatch.sh"

mkdir -p "$STATE_DIR" "$LOG_DIR"
touch "$STATE_DIR/done.txt"

JOURNAL="$STATE_DIR/run.jsonl"

# --------------------------------------------------------------------- flags
TIER_FILTER=""
SLUG_FILTER=""
DRY_RUN=0
RESUME=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tier) TIER_FILTER="$2"; shift 2 ;;
    --slug) SLUG_FILTER="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --resume) RESUME=1; shift ;;
    -h|--help)
      grep -E '^# ' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
done

# --------------------------------------------------------------------- helpers
log_journal() {
  printf '{"ts":"%s","event":"%s","slug":"%s","tier":%s,"detail":%s}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    "$1" "$2" "${3:-null}" "${4:-null}" >> "$JOURNAL"
}

slice_done() {
  grep -Fxq "$1" "$STATE_DIR/done.txt" 2>/dev/null
}

mark_done() {
  echo "$1" >> "$STATE_DIR/done.txt"
}

# --------------------------------------------------------------------- preflight
if ! command -v jq >/dev/null; then
  echo "error: jq is required (brew install jq)" >&2
  exit 2
fi
if ! command -v claude >/dev/null; then
  echo "error: claude CLI is required" >&2
  exit 2
fi
if [[ ! -f "$DAG_FILE" ]]; then
  echo "error: $DAG_FILE not found" >&2
  exit 2
fi
if [[ ! -x "$DISPATCH" ]]; then
  chmod +x "$DISPATCH" 2>/dev/null || true
fi

# --------------------------------------------------------------------- plan
tier_count=$(jq '.tiers | length' "$DAG_FILE")
echo "loop: $tier_count tiers loaded from $DAG_FILE"
echo "loop: state dir: $STATE_DIR"
echo "loop: log dir:   $LOG_DIR"
echo "loop: dry-run=$DRY_RUN  resume=$RESUME  tier-filter=${TIER_FILTER:-all}  slug-filter=${SLUG_FILTER:-none}"
echo

# --------------------------------------------------------------------- signals
declare -a CHILD_PIDS=()
on_interrupt() {
  echo
  echo "loop: SIGINT received — killing ${#CHILD_PIDS[@]} dispatcher(s)"
  for pid in "${CHILD_PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  log_journal "interrupt" "" "null" "null"
  exit 130
}
trap on_interrupt INT

# --------------------------------------------------------------------- main loop
TOTAL_SHIPPED=0
TOTAL_FAILED=0
TOTAL_ESCALATED=0
TOTAL_SKIPPED=0

for ((tier=0; tier<tier_count; tier++)); do
  if [[ -n "$TIER_FILTER" && "$TIER_FILTER" != "$tier" ]]; then
    continue
  fi

  parallel=$(jq -r ".tiers[$tier].parallel" "$DAG_FILE")
  slice_count=$(jq ".tiers[$tier].slices | length" "$DAG_FILE")

  echo "==================================================================="
  echo "TIER $tier  (slices=$slice_count, parallel=$parallel)"
  echo "==================================================================="
  log_journal "tier_start" "" "$tier" "{\"parallel\":$parallel,\"slices\":$slice_count}"

  CHILD_PIDS=()
  consecutive_fails=0

  for ((s=0; s<slice_count; s++)); do
    slug=$(jq -r ".tiers[$tier].slices[$s].slug" "$DAG_FILE")
    repo=$(jq -r ".tiers[$tier].slices[$s].repo" "$DAG_FILE")
    brief=$(jq -r ".tiers[$tier].slices[$s].brief" "$DAG_FILE")

    if [[ -n "$SLUG_FILTER" && "$SLUG_FILTER" != "$slug" ]]; then
      continue
    fi

    if [[ "$RESUME" == "1" ]] && slice_done "$slug"; then
      echo "  ↳ $slug — already done (resume), skipping"
      ((TOTAL_SKIPPED++))
      continue
    fi

    ts=$(date -u +%Y%m%dT%H%M%SZ)
    log="$LOG_DIR/${ts}-${slug}.log"

    echo "  ↳ $slug  (repo=$repo, brief=$brief, log=$log)"

    if [[ "$DRY_RUN" == "1" ]]; then
      log_journal "slice_dry_run" "$slug" "$tier" "null"
      continue
    fi

    log_journal "slice_start" "$slug" "$tier" "null"

    if [[ "$parallel" == "true" ]]; then
      "$DISPATCH" "$slug" "$repo" "$brief" "$log" &
      CHILD_PIDS+=("$!")
    else
      if "$DISPATCH" "$slug" "$repo" "$brief" "$log"; then
        rc=0
      else
        rc=$?
      fi

      if [[ "$rc" == "0" ]]; then
        if grep -q "^SHIPPED:" "$log" 2>/dev/null; then
          mark_done "$slug"
          log_journal "slice_shipped" "$slug" "$tier" "null"
          ((TOTAL_SHIPPED++))
          consecutive_fails=0
        elif grep -q "^ESCALATE:" "$log" 2>/dev/null; then
          log_journal "slice_escalate" "$slug" "$tier" "null"
          ((TOTAL_ESCALATED++))
          consecutive_fails=0
        else
          log_journal "slice_no_summary" "$slug" "$tier" "null"
          ((TOTAL_FAILED++))
          ((consecutive_fails++))
        fi
      else
        log_journal "slice_fail" "$slug" "$tier" "{\"rc\":$rc}"
        ((TOTAL_FAILED++))
        ((consecutive_fails++))
      fi

      if [[ "$consecutive_fails" -ge 3 ]]; then
        echo "loop: 3 consecutive failures in tier $tier — aborting"
        log_journal "tier_abort" "" "$tier" "{\"reason\":\"consecutive_fails\"}"
        break 2
      fi
    fi
  done

  # If parallel, wait for all dispatchers in this tier then collect results.
  if [[ "$parallel" == "true" && "$DRY_RUN" != "1" && ${#CHILD_PIDS[@]} -gt 0 ]]; then
    echo "  ↳ waiting for ${#CHILD_PIDS[@]} parallel dispatcher(s)…"
    for pid in "${CHILD_PIDS[@]}"; do
      wait "$pid" || true
    done

    # Re-walk this tier to score results from the per-slice logs.
    for ((s=0; s<slice_count; s++)); do
      slug=$(jq -r ".tiers[$tier].slices[$s].slug" "$DAG_FILE")
      if [[ -n "$SLUG_FILTER" && "$SLUG_FILTER" != "$slug" ]]; then
        continue
      fi
      if slice_done "$slug"; then
        continue
      fi
      latest_log=$(ls -t "$LOG_DIR"/*"$slug".log 2>/dev/null | head -1 || true)
      if [[ -z "$latest_log" ]]; then
        log_journal "slice_no_log" "$slug" "$tier" "null"
        ((TOTAL_FAILED++))
        continue
      fi
      if grep -q "^SHIPPED:" "$latest_log"; then
        mark_done "$slug"
        log_journal "slice_shipped" "$slug" "$tier" "null"
        ((TOTAL_SHIPPED++))
      elif grep -q "^ESCALATE:" "$latest_log"; then
        log_journal "slice_escalate" "$slug" "$tier" "null"
        ((TOTAL_ESCALATED++))
      else
        log_journal "slice_no_summary" "$slug" "$tier" "null"
        ((TOTAL_FAILED++))
      fi
    done
  fi

  log_journal "tier_end" "" "$tier" "{\"shipped\":$TOTAL_SHIPPED,\"failed\":$TOTAL_FAILED,\"escalated\":$TOTAL_ESCALATED}"
done

# --------------------------------------------------------------------- summary
echo
echo "==================================================================="
echo "LOOP COMPLETE"
echo "  shipped:   $TOTAL_SHIPPED"
echo "  failed:    $TOTAL_FAILED"
echo "  escalated: $TOTAL_ESCALATED"
echo "  skipped:   $TOTAL_SKIPPED"
echo "==================================================================="
echo "journal: $JOURNAL"
echo "logs:    $LOG_DIR"
echo

log_journal "run_end" "" "null" "{\"shipped\":$TOTAL_SHIPPED,\"failed\":$TOTAL_FAILED,\"escalated\":$TOTAL_ESCALATED,\"skipped\":$TOTAL_SKIPPED}"

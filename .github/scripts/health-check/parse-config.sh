#!/usr/bin/env bash
# parse-config.sh — Reads the latest /config comment from the most recent health-report issue.
# Outputs a file (enabled_checks.txt) listing which checks are enabled.
# Falls back to defaults if no config comment is found.
set -euo pipefail

OUTPUT_DIR="${1:-.}"
ENABLED_FILE="$OUTPUT_DIR/enabled_checks.txt"

DEFAULTS=(
  "Codebase hygiene"
  "Consistency"
  "CI/CD improvements"
  "Accessibility"
  "Svelte v5 migration readiness"
  "API/data handling"
  "Commit changelog analysis"
)

# Find the latest health-report issue number
ISSUE_NUMBER=$(gh issue list --label "health-report" --state all --limit 1 --json number --jq '.[0].number // empty' 2>/dev/null || true)

if [[ -z "$ISSUE_NUMBER" ]]; then
  echo "No previous health-report issue found, using defaults."
  printf '%s\n' "${DEFAULTS[@]}" > "$ENABLED_FILE"
  echo "$ENABLED_FILE"
  exit 0
fi

# Get the last /config comment from that issue
CONFIG_BODY=$(gh issue view "$ISSUE_NUMBER" --comments --json comments \
  --jq '[.comments[] | select(.body | startswith("/config"))] | last | .body // empty' 2>/dev/null || true)

if [[ -z "$CONFIG_BODY" ]]; then
  echo "No /config comment found on issue #$ISSUE_NUMBER, using defaults."
  printf '%s\n' "${DEFAULTS[@]}" > "$ENABLED_FILE"
  echo "$ENABLED_FILE"
  exit 0
fi

echo "Found /config comment on issue #$ISSUE_NUMBER, parsing..."

# Parse checked items: [x] or [X] Some Check Name → "Some Check Name"
echo "$CONFIG_BODY" | grep -ioP '\[x\]\s+\K.*' | sed 's/[[:space:]]*$//' > "$ENABLED_FILE"

if [[ ! -s "$ENABLED_FILE" ]]; then
  echo "Config comment had no enabled checks, using defaults."
  printf '%s\n' "${DEFAULTS[@]}" > "$ENABLED_FILE"
fi

echo "Enabled checks:"
cat "$ENABLED_FILE"
echo "$ENABLED_FILE"

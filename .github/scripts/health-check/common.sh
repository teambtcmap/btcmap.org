#!/usr/bin/env bash
# common.sh — shared helpers for health-check scan scripts.
# Source this file after initializing FINDINGS="[]".

add_finding() {
  local severity="$1" title="$2" details="$3" files="$4"
  FINDINGS=$(echo "$FINDINGS" | jq \
    --arg sev "$severity" --arg title "$title" --arg details "$details" --arg files "$files" \
    '. + [{"severity": $sev, "title": $title, "details": $details, "files": $files}]')
}

# Strip non-numeric characters and default to 0.
# Useful for sanitizing grep -c output which may include warnings or whitespace.
sanitize_count() { local n="${1//[^0-9]/}"; printf '%d\n' "$((10#${n:-0}))"; }

# Count non-empty lines in piped input and return a clean integer.
count_lines() { awk 'NF' | wc -l | tr -d ' '; }

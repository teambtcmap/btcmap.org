#!/usr/bin/env bash
# common.sh — shared helpers for health-check scan scripts.
# Source this file after initializing FINDINGS="[]".

add_finding() {
  local severity="$1" title="$2" details="$3" files="$4"
  FINDINGS=$(echo "$FINDINGS" | jq \
    --arg sev "$severity" --arg title "$title" --arg details "$details" --arg files "$files" \
    '. + [{"severity": $sev, "title": $title, "details": $details, "files": $files}]')
}

#!/usr/bin/env bash
# scan-api.sh — Reviews API and data handling patterns for potential issues.
set -euo pipefail

OUTPUT_DIR="${1:-.}"
OUTPUT_FILE="$OUTPUT_DIR/api.json"

FINDINGS="[]"

# shellcheck source=common.sh
source "$(dirname "$0")/common.sh"

# 1. Axios calls without error handling (no .catch or try/catch)
# Find axios.get/post/put/delete calls
AXIOS_CALLS=$(grep -rn 'axios\.\(get\|post\|put\|delete\|patch\)' src/ \
  --include='*.ts' --include='*.svelte' 2>/dev/null || true)
if [[ -n "$AXIOS_CALLS" ]]; then
  TOTAL_CALLS=$(echo "$AXIOS_CALLS" | wc -l | tr -d ' ')
  # Check for calls not inside try blocks or without .catch
  # Heuristic: lines with axios calls that don't have 'catch' within 5 lines
  UNHANDLED=""
  while IFS=: read -r file line _rest; do
    [[ -z "$file" ]] && continue
    # Check surrounding context for try/catch
    CONTEXT=$(sed -n "$((line > 3 ? line - 3 : 1)),$((line + 5))p" "$file" 2>/dev/null || true)
    if ! echo "$CONTEXT" | grep -q 'catch\|\.catch'; then
      UNHANDLED="${UNHANDLED}${file}:${line}\n"
    fi
  done <<< "$AXIOS_CALLS"

  if [[ -n "$UNHANDLED" ]]; then
    UNHANDLED_COUNT=$(echo -e "$UNHANDLED" | grep -c '.' || echo 0)
    add_finding "medium" "Axios calls potentially missing error handling ($UNHANDLED_COUNT)" \
      "Found $TOTAL_CALLS total axios calls, $UNHANDLED_COUNT appear to lack try/catch or .catch() error handling." \
      "$(echo -e "$UNHANDLED" | head -10)"
  fi
fi

# 2. LocalForage operations without error handling
LF_CALLS=$(grep -rn 'localforage\.\(getItem\|setItem\|removeItem\|clear\)' src/ \
  --include='*.ts' --include='*.svelte' 2>/dev/null || true)
if [[ -n "$LF_CALLS" ]]; then
  UNHANDLED_LF=""
  while IFS=: read -r file line _rest; do
    [[ -z "$file" ]] && continue
    CONTEXT=$(sed -n "$((line > 3 ? line - 3 : 1)),$((line + 5))p" "$file" 2>/dev/null || true)
    if ! echo "$CONTEXT" | grep -q 'catch\|\.catch\|try'; then
      UNHANDLED_LF="${UNHANDLED_LF}${file}:${line}\n"
    fi
  done <<< "$LF_CALLS"

  if [[ -n "$UNHANDLED_LF" ]]; then
    COUNT=$(echo -e "$UNHANDLED_LF" | grep -c '.' || echo 0)
    add_finding "medium" "LocalForage calls potentially missing error handling ($COUNT)" \
      "IndexedDB operations can fail (storage full, private browsing). Consider adding error handling." \
      "$(echo -e "$UNHANDLED_LF" | head -10)"
  fi
fi

# 3. Place vs Element type misuse
# Place = v4 API type, Element = v2 API type
# Check for Element type usage in non-v2 contexts
ELEMENT_USAGE=$(grep -rn '\bElement\b' src/ --include='*.ts' --include='*.svelte' 2>/dev/null \
  | grep -v 'HTMLElement\|SVGElement\|node_modules\|MapElement\|DOMElement\|ElementEvent' \
  | grep -v 'import.*Element' | grep -v '// ' || true)

PLACE_USAGE=$(grep -rn '\bPlace\b' src/ --include='*.ts' --include='*.svelte' 2>/dev/null \
  | grep -v 'node_modules\|Marketplace\|placeholder\|places\|placement' \
  | grep -v 'import.*Place' | grep -v '// ' || true)

if [[ -n "$ELEMENT_USAGE" ]]; then
  ELEM_COUNT=$(echo "$ELEMENT_USAGE" | wc -l | tr -d ' ')
  PLACE_COUNT=0
  [[ -n "$PLACE_USAGE" ]] && PLACE_COUNT=$(echo "$PLACE_USAGE" | wc -l | tr -d ' ')
  add_finding "info" "API type usage: Element ($ELEM_COUNT refs) vs Place ($PLACE_COUNT refs)" \
    "Project prefers Place type (v4 API). Element type (v2 API) should be migrated where possible." \
    "$(echo "$ELEMENT_USAGE" | head -5)"
fi

# 4. Hardcoded API URLs (should use constants)
HARDCODED_URLS=$(grep -rnP "https?://api\.btcmap\.org" src/ \
  --include='*.ts' --include='*.svelte' 2>/dev/null \
  | grep -v 'constants\|config\|\.env' || true)
if [[ -n "$HARDCODED_URLS" ]]; then
  COUNT=$(echo "$HARDCODED_URLS" | wc -l | tr -d ' ')
  add_finding "low" "Hardcoded API URLs ($COUNT)" \
    "API base URLs should use constants or environment variables for maintainability." \
    "$(echo "$HARDCODED_URLS" | head -10)"
fi

# 5. Missing loading states — async operations without loading indicators
# Heuristic: components with await/fetch/axios but no loading variable
ASYNC_COMPONENTS=$(grep -rlP 'await\s+(axios|fetch)\b' src/ --include='*.svelte' 2>/dev/null || true)
if [[ -n "$ASYNC_COMPONENTS" ]]; then
  NO_LOADING=""
  for file in $ASYNC_COMPONENTS; do
    if ! grep -qP 'loading|isLoading|pending|spinner|Loading' "$file" 2>/dev/null; then
      NO_LOADING="${NO_LOADING}${file}\n"
    fi
  done
  if [[ -n "$NO_LOADING" ]]; then
    COUNT=$(echo -e "$NO_LOADING" | grep -c '.' || echo 0)
    add_finding "low" "Async components potentially missing loading states ($COUNT)" \
      "Components with async data fetching should show loading indicators." \
      "$(echo -e "$NO_LOADING" | head -10)"
  fi
fi

# 6. Sync module patterns
SYNC_FILES=$(find src/lib/sync/ -name '*.ts' -not -name '*.test.*' 2>/dev/null || true)
if [[ -n "$SYNC_FILES" ]]; then
  NO_UPDATED_SINCE=""
  for file in $SYNC_FILES; do
    if ! grep -q 'updated_since' "$file" 2>/dev/null; then
      NO_UPDATED_SINCE="${NO_UPDATED_SINCE}${file}\n"
    fi
  done
  if [[ -n "$NO_UPDATED_SINCE" ]]; then
    COUNT=$(echo -e "$NO_UPDATED_SINCE" | grep -c '.' || echo 0)
    add_finding "info" "Sync modules without updated_since optimization ($COUNT)" \
      "Some sync modules may be fetching full datasets instead of incremental updates." \
      "$(echo -e "$NO_UPDATED_SINCE" | head -10)"
  fi
fi

echo "$FINDINGS" | jq '.' > "$OUTPUT_FILE"
echo "API/data scan complete: $OUTPUT_FILE ($(echo "$FINDINGS" | jq length) findings)"

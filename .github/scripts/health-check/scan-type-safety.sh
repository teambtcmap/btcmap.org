#!/usr/bin/env bash
# scan-type-safety.sh — Runs svelte-check and tsc to detect TypeScript errors and warnings.
# Requires Node.js and yarn dependencies to be installed.
set -euo pipefail

OUTPUT_DIR="${1:-.}"
OUTPUT_FILE="$OUTPUT_DIR/type-safety.json"

FINDINGS="[]"

# shellcheck source=common.sh
source "$(dirname "$0")/common.sh"

# Run svelte-check with machine-parseable output, capturing both errors and warnings.
# svelte-check exits non-zero when errors are found, so we allow that.
SVELTE_OUTPUT=$(npx svelte-check --output machine --threshold warning 2>&1 || true)

# Parse the COMPLETED line for totals
COMPLETED_LINE=$(echo "$SVELTE_OUTPUT" | { grep 'COMPLETED' || true; })
TOTAL_ERRORS=0
TOTAL_WARNINGS=0
FILES_WITH_PROBLEMS=0

if [[ -n "$COMPLETED_LINE" ]]; then
  TOTAL_ERRORS=$(echo "$COMPLETED_LINE" | grep -oP '\d+ ERRORS' | grep -oP '\d+' || echo 0)
  TOTAL_WARNINGS=$(echo "$COMPLETED_LINE" | grep -oP '\d+ WARNINGS' | grep -oP '\d+' || echo 0)
  FILES_WITH_PROBLEMS=$(echo "$COMPLETED_LINE" | grep -oP '\d+ FILES_WITH_PROBLEMS' | grep -oP '\d+' || echo 0)
fi

TOTAL_ERRORS=$(sanitize_count "$TOTAL_ERRORS")
TOTAL_WARNINGS=$(sanitize_count "$TOTAL_WARNINGS")
FILES_WITH_PROBLEMS=$(sanitize_count "$FILES_WITH_PROBLEMS")

# Extract individual error lines (format: TIMESTAMP ERROR filepath line:col message)
ERROR_LINES=$(echo "$SVELTE_OUTPUT" | { grep ' ERROR ' || true; })
WARNING_LINES=$(echo "$SVELTE_OUTPUT" | { grep ' WARNING ' || true; })

if [[ "$TOTAL_ERRORS" -gt 0 ]]; then
  # Group errors by file to find which files have the most problems
  ERROR_FILES=$(echo "$ERROR_LINES" | awk '{print $3}' | sort | uniq -c | sort -rn | head -10 || true)

  add_finding "high" "TypeScript errors ($TOTAL_ERRORS) across $FILES_WITH_PROBLEMS files" \
    "svelte-check found $TOTAL_ERRORS type errors. These will cause build failures and should be fixed promptly." \
    "$(echo "$ERROR_LINES" | head -15 | awk '{$1=""; print substr($0,2)}')"
fi

if [[ "$TOTAL_WARNINGS" -gt 0 ]]; then
  add_finding "medium" "TypeScript warnings ($TOTAL_WARNINGS)" \
    "svelte-check found $TOTAL_WARNINGS warnings. These indicate potential issues that should be reviewed." \
    "$(echo "$WARNING_LINES" | head -10 | awk '{$1=""; print substr($0,2)}')"
fi

# Run tsc --noEmit separately for non-Svelte TS files if available
if command -v npx &>/dev/null && [[ -f "tsconfig.json" ]]; then
  TSC_OUTPUT=$(npx tsc --noEmit 2>&1 || true)
  TSC_ERRORS=$(echo "$TSC_OUTPUT" | { grep -c ': error TS' || true; })
  TSC_ERRORS=$(sanitize_count "$TSC_ERRORS")

  if [[ "$TSC_ERRORS" -gt 0 ]]; then
    TSC_FILES=$(echo "$TSC_OUTPUT" | { grep ': error TS' || true; } | cut -d'(' -f1 | sort -u | head -10)
    add_finding "high" "tsc errors ($TSC_ERRORS)" \
      "TypeScript compiler found $TSC_ERRORS errors in non-Svelte files." \
      "$(echo "$TSC_OUTPUT" | { grep ': error TS' || true; } | head -10)"
  fi
fi

# Check for 'any' type usage (explicit and implicit)
EXPLICIT_ANY=$({ grep -rnP ':\s*any\b|as\s+any\b|<any>' src/ \
  --include='*.ts' --include='*.svelte' 2>/dev/null || true; } | count_lines)

if [[ "$EXPLICIT_ANY" -gt 0 ]]; then
  ANY_FILES=$(grep -rnP ':\s*any\b|as\s+any\b|<any>' src/ \
    --include='*.ts' --include='*.svelte' 2>/dev/null | head -10 || true)
  add_finding "medium" "Explicit 'any' type usage ($EXPLICIT_ANY)" \
    "Using 'any' bypasses type safety. Consider using specific types, 'unknown', or generics." \
    "$ANY_FILES"
fi

# Check for @ts-ignore / @ts-expect-error suppressions
TS_IGNORE=$({ grep -rn '@ts-ignore\|@ts-expect-error' src/ \
  --include='*.ts' --include='*.svelte' 2>/dev/null || true; } | count_lines)

if [[ "$TS_IGNORE" -gt 0 ]]; then
  IGNORE_FILES=$(grep -rn '@ts-ignore\|@ts-expect-error' src/ \
    --include='*.ts' --include='*.svelte' 2>/dev/null | head -10 || true)
  add_finding "low" "TypeScript error suppressions ($TS_IGNORE)" \
    "@ts-ignore and @ts-expect-error suppress type checking. Review if these are still necessary." \
    "$IGNORE_FILES"
fi

# If everything is clean, note it
if [[ "$TOTAL_ERRORS" -eq 0 && "$TOTAL_WARNINGS" -eq 0 ]]; then
  add_finding "info" "Type safety: all clear" \
    "svelte-check found 0 errors and 0 warnings. The codebase is type-safe." \
    ""
fi

echo "$FINDINGS" | jq '.' > "$OUTPUT_FILE"
echo "Type safety scan complete: $OUTPUT_FILE ($(echo "$FINDINGS" | jq length) findings)"

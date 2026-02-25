#!/usr/bin/env bash
# scan-consistency.sh — Checks code style consistency against project conventions.
set -euo pipefail

OUTPUT_DIR="${1:-.}"
OUTPUT_FILE="$OUTPUT_DIR/consistency.json"

FINDINGS="[]"

# shellcheck source=common.sh
source "$(dirname "$0")/common.sh"

# 1. interface vs type — project prefers `type` over `interface`
INTERFACE_COUNT=$(grep -rnP '^\s*export\s+interface\b|^\s*interface\b' src/ \
  --include='*.ts' --include='*.svelte' 2>/dev/null | wc -l | tr -d ' ')
TYPE_COUNT=$(grep -rnP '^\s*export\s+type\b|^\s*type\b' src/ \
  --include='*.ts' --include='*.svelte' 2>/dev/null | grep -v 'import type' | wc -l | tr -d ' ')

if [[ "$INTERFACE_COUNT" -gt 0 ]]; then
  INTERFACE_FILES=$(grep -rnP '^\s*export\s+interface\b|^\s*interface\b' src/ \
    --include='*.ts' --include='*.svelte' 2>/dev/null | head -10)
  add_finding "medium" "interface usage ($INTERFACE_COUNT) — project prefers type" \
    "Project convention is to use 'type' over 'interface'. Found $INTERFACE_COUNT interface declarations vs $TYPE_COUNT type declarations." \
    "$INTERFACE_FILES"
fi

# 2. Mixed type and value imports (importing type and value in same statement)
MIXED_IMPORTS=$(grep -rnP 'import\s+\{[^}]*,\s*type\s+\w|import\s+\{\s*type\s+\w+[^}]*,\s*[^t]' src/ \
  --include='*.ts' --include='*.svelte' 2>/dev/null || true)
if [[ -n "$MIXED_IMPORTS" ]]; then
  MIXED_COUNT=$(echo "$MIXED_IMPORTS" | wc -l | tr -d ' ')
  add_finding "medium" "Mixed type/value imports ($MIXED_COUNT)" \
    "Project convention requires separate 'import type' and 'import' statements." \
    "$(echo "$MIXED_IMPORTS" | head -10)"
fi

# 3. JSDoc comments (project prefers inline // comments)
JSDOC_COUNT=$(grep -rn '/\*\*' src/ --include='*.ts' --include='*.svelte' 2>/dev/null \
  | grep -v 'node_modules' | wc -l | tr -d ' ')
if [[ "$JSDOC_COUNT" -gt 0 ]]; then
  JSDOC_FILES=$(grep -rn '/\*\*' src/ --include='*.ts' --include='*.svelte' 2>/dev/null \
    | grep -v 'node_modules' | head -10)
  add_finding "low" "JSDoc comments ($JSDOC_COUNT) — project prefers inline comments" \
    "Project convention avoids JSDoc in favor of inline // comments and TypeScript types." \
    "$JSDOC_FILES"
fi

# 4. Path alias consistency — relative imports that should use $components
RELATIVE_COMPONENTS=$(grep -rnP "from\s+['\"]\.+.*components/" src/ \
  --include='*.ts' --include='*.svelte' 2>/dev/null || true)
if [[ -n "$RELATIVE_COMPONENTS" ]]; then
  REL_COUNT=$(echo "$RELATIVE_COMPONENTS" | wc -l | tr -d ' ')
  add_finding "low" "Relative imports to components/ ($REL_COUNT) — use \$components alias" \
    "Project convention is to use the \$components path alias instead of relative paths to src/components/." \
    "$(echo "$RELATIVE_COMPONENTS" | head -10)"
fi

# 5. Relative imports that should use $lib
RELATIVE_LIB=$(grep -rnP "from\s+['\"]\.\.+/lib/" src/routes/ \
  --include='*.ts' --include='*.svelte' 2>/dev/null || true)
if [[ -n "$RELATIVE_LIB" ]]; then
  LIB_COUNT=$(echo "$RELATIVE_LIB" | wc -l | tr -d ' ')
  add_finding "low" "Relative imports to lib/ from routes ($LIB_COUNT) — use \$lib alias" \
    "Route files should use \$lib instead of relative paths to src/lib/." \
    "$(echo "$RELATIVE_LIB" | head -10)"
fi

# 6. Svelte v5 runes accidentally used (project is on v4)
RUNES=$(grep -rnP '\$state\b|\$derived\b|\$effect\b|\$props\b|\$bindable\b' src/ \
  --include='*.svelte' --include='*.ts' 2>/dev/null \
  | grep -v 'node_modules' | grep -v '.test.' || true)
if [[ -n "$RUNES" ]]; then
  RUNE_COUNT=$(echo "$RUNES" | wc -l | tr -d ' ')
  add_finding "high" "Svelte v5 runes detected in v4 codebase ($RUNE_COUNT)" \
    "The project intentionally uses Svelte v4. These v5 runes will not work." \
    "$(echo "$RUNES" | head -10)"
fi

echo "$FINDINGS" | jq '.' > "$OUTPUT_FILE"
echo "Consistency scan complete: $OUTPUT_FILE ($(echo "$FINDINGS" | jq length) findings)"

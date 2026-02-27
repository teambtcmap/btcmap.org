#!/usr/bin/env bash
# scan-hygiene.sh — Detects stale config references, dead code patterns, and codebase hygiene issues.
set -euo pipefail

OUTPUT_DIR="${1:-.}"
OUTPUT_FILE="$OUTPUT_DIR/hygiene.json"

FINDINGS="[]"

# shellcheck source=common.sh
source "$(dirname "$0")/common.sh"

# 1. Stale tool references in CI workflows
PRETTIER_REFS=$(grep -rn -i 'prettier' .github/workflows/ 2>/dev/null || true)
if [[ -n "$PRETTIER_REFS" ]]; then
  add_finding "medium" "Stale Prettier references in CI" \
    "The project uses Biome, but CI workflows still reference Prettier." \
    "$(echo "$PRETTIER_REFS" | head -5)"
fi

ESLINT_REFS=$(grep -rn -i 'eslint' .github/workflows/ 2>/dev/null || true)
if [[ -n "$ESLINT_REFS" ]]; then
  add_finding "medium" "Stale ESLint references in CI" \
    "The project uses Biome, but CI workflows still reference ESLint." \
    "$(echo "$ESLINT_REFS" | head -5)"
fi

# 2. Stale references in docs
PRETTIER_DOCS=$(grep -rn -i 'prettier' .github/copilot-instructions.md AGENTS.md README.md 2>/dev/null || true)
if [[ -n "$PRETTIER_DOCS" ]]; then
  add_finding "low" "Stale Prettier references in documentation" \
    "Documentation files reference Prettier but the project uses Biome." \
    "$(echo "$PRETTIER_DOCS" | head -5)"
fi

ESLINT_DOCS=$(grep -rn -i 'eslint' .github/copilot-instructions.md AGENTS.md README.md 2>/dev/null || true)
if [[ -n "$ESLINT_DOCS" ]]; then
  add_finding "low" "Stale ESLint references in documentation" \
    "Documentation files reference ESLint but the project uses Biome." \
    "$(echo "$ESLINT_DOCS" | head -5)"
fi

# 3. Tailwind v3 references (project uses v4)
TW3_REFS=$(grep -rn 'tailwindcss.*v3\|TailwindCSS v3\|tailwind\.config' \
  .github/ AGENTS.md README.md src/ --include='*.md' --include='*.ts' --include='*.js' --include='*.svelte' 2>/dev/null || true)
if [[ -n "$TW3_REFS" ]]; then
  add_finding "low" "Stale Tailwind v3 references" \
    "The project uses Tailwind v4 but some files reference v3 patterns or config." \
    "$(echo "$TW3_REFS" | head -5)"
fi

# 4. Unused exports — find exported functions/consts not imported elsewhere
# (lightweight heuristic: exported names in lib/ that appear only once in the codebase)
UNUSED_EXPORTS=()
while IFS= read -r line; do
  # Extract the exported name
  NAME=$(echo "$line" | grep -oP 'export\s+(const|function|let|class)\s+\K\w+' || true)
  [[ -z "$NAME" ]] && continue
  # Count occurrences across the codebase (excluding the definition file itself)
  FILE=$(echo "$line" | cut -d: -f1)
  COUNT=$({ grep -Frl "$NAME" src/ --include='*.ts' --include='*.svelte' --include='*.js' 2>/dev/null \
    | grep -Fv -- "$FILE" || true; } | count_lines)
  if [[ "$COUNT" -eq 0 ]]; then
    UNUSED_EXPORTS+=("$line")
  fi
done < <(grep -rn 'export \(const\|function\|let\|class\) ' src/lib/ --include='*.ts' 2>/dev/null | head -100)

if [[ "${#UNUSED_EXPORTS[@]}" -gt 0 ]]; then
  UNUSED_COUNT="${#UNUSED_EXPORTS[@]}"
  add_finding "low" "Potentially unused exports ($UNUSED_COUNT found)" \
    "Exported symbols in src/lib/ that don't appear to be imported elsewhere. Review and consider removing." \
    "$(printf '%s\n' "${UNUSED_EXPORTS[@]}" | head -10)"
fi

# 5. Console.log statements (excluding allowed console methods)
CONSOLE_LOGS=$(grep -rn 'console\.log\b' src/ --include='*.ts' --include='*.svelte' --include='*.js' 2>/dev/null || true)
if [[ -n "$CONSOLE_LOGS" ]]; then
  LOG_COUNT=$(echo "$CONSOLE_LOGS" | count_lines)
  add_finding "low" "console.log statements found ($LOG_COUNT)" \
    "Biome config allows console.info/warn/error/debug but console.log should be removed." \
    "$(echo "$CONSOLE_LOGS" | head -10)"
fi

# 6. TODO/FIXME/HACK comments
TODOS=$(grep -rnE 'TODO|FIXME|HACK|XXX' src/ --include='*.ts' --include='*.svelte' --include='*.js' 2>/dev/null || true)
if [[ -n "$TODOS" ]]; then
  TODO_COUNT=$(echo "$TODOS" | count_lines)
  add_finding "info" "TODO/FIXME/HACK comments ($TODO_COUNT found)" \
    "Tracked code annotations that may need attention." \
    "$(echo "$TODOS" | head -15)"
fi

echo "$FINDINGS" | jq '.' > "$OUTPUT_FILE"
echo "Hygiene scan complete: $OUTPUT_FILE ($(echo "$FINDINGS" | jq length) findings)"

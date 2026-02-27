#!/usr/bin/env bash
# scan-doc-drift.sh — Detects drift between documented conventions (AGENTS.md,
# copilot-instructions.md) and actual codebase patterns. Suggests additions or
# corrections to keep agent guidance accurate.
set -euo pipefail

OUTPUT_DIR="${1:-.}"
OUTPUT_FILE="$OUTPUT_DIR/doc-drift.json"

FINDINGS="[]"

# shellcheck source=common.sh
source "$(dirname "$0")/common.sh"

AGENTS_MD="AGENTS.md"
COPILOT_MD=".github/copilot-instructions.md"

# ── 1. Stale tooling references in copilot-instructions ───────────────────────

# Tailwind version mismatch: copilot-instructions says v3 but project uses v4
if [[ -f "$COPILOT_MD" ]]; then
  TW3_IN_COPILOT=$(grep -n 'TailwindCSS v3\|Tailwind.*v3\|tailwind.*version.*3' "$COPILOT_MD" 2>/dev/null || true)
  if [[ -n "$TW3_IN_COPILOT" ]]; then
    add_finding "medium" "copilot-instructions.md documents Tailwind v3 but project uses v4" \
      "The file references TailwindCSS v3. AGENTS.md already documents v4 correctly. Update copilot-instructions.md to match." \
      "$TW3_IN_COPILOT"
  fi

  # Prettier references in copilot-instructions (project uses Biome)
  PRETTIER_IN_COPILOT=$(grep -n 'prettier\|Prettier' "$COPILOT_MD" 2>/dev/null || true)
  if [[ -n "$PRETTIER_IN_COPILOT" ]]; then
    add_finding "medium" "copilot-instructions.md references Prettier but project uses Biome" \
      "The file mentions Prettier for formatting. The project migrated to Biome. Update the commands and descriptions." \
      "$(echo "$PRETTIER_IN_COPILOT" | head -5)"
  fi

  # ESLint references in copilot-instructions (project uses Biome)
  ESLINT_IN_COPILOT=$(grep -n 'eslint\|ESLint' "$COPILOT_MD" 2>/dev/null || true)
  if [[ -n "$ESLINT_IN_COPILOT" ]]; then
    add_finding "medium" "copilot-instructions.md references ESLint but project uses Biome" \
      "The file mentions ESLint for linting. The project migrated to Biome. Update the commands and descriptions." \
      "$(echo "$ESLINT_IN_COPILOT" | head -5)"
  fi
fi

# ── 2. Path aliases: check tsconfig/svelte.config vs what docs mention ────────

# Collect actual aliases from tsconfig.json paths
TSCONFIG_ALIASES=""
if [[ -f "tsconfig.json" ]]; then
  TSCONFIG_ALIASES=$(jq -r '.compilerOptions.paths // {} | keys[]' tsconfig.json 2>/dev/null \
    | sed 's|/\*$||' || true)
fi

# Collect aliases from svelte.config.js/ts
SVELTE_ALIASES=""
if [[ -f "svelte.config.js" || -f "svelte.config.ts" ]]; then
  CONFIG_FILE="svelte.config.js"
  [[ -f "svelte.config.ts" ]] && CONFIG_FILE="svelte.config.ts"
  SVELTE_ALIASES=$({ grep -oE "alias:[[:space:]]*\{[^}]+}" "$CONFIG_FILE" 2>/dev/null \
    | grep -oE "'[^']+'" \
    | tr -d "'" || true; })
fi

# Check each alias is mentioned in at least one doc file
UNDOCUMENTED_ALIASES=()
for alias in $TSCONFIG_ALIASES $SVELTE_ALIASES; do
  [[ -z "$alias" ]] && continue
  # Strip $ prefix for grep since docs may write $lib or lib
  bare="${alias#\$}"
  if ! grep -qF "$alias" "$AGENTS_MD" "$COPILOT_MD" 2>/dev/null && \
     ! grep -qF "\$$bare" "$AGENTS_MD" "$COPILOT_MD" 2>/dev/null; then
    UNDOCUMENTED_ALIASES+=("$alias")
  fi
done

if [[ "${#UNDOCUMENTED_ALIASES[@]}" -gt 0 ]]; then
  add_finding "low" "Undocumented path aliases (${#UNDOCUMENTED_ALIASES[@]})" \
    "These tsconfig/svelte.config path aliases are not mentioned in AGENTS.md or copilot-instructions.md. Consider documenting them so agents use them correctly." \
    "$(printf '%s\n' "${UNDOCUMENTED_ALIASES[@]}")"
fi

# ── 3. Commit types used in practice but missing from documented list ──────────

DOCUMENTED_TYPES=""
for doc in "$AGENTS_MD" "$COPILOT_MD"; do
  [[ -f "$doc" ]] && DOCUMENTED_TYPES="$DOCUMENTED_TYPES $(grep -oE '\`(feat|fix|refactor|perf|style|docs|test|chore|build|ci|revert)\`' "$doc" 2>/dev/null | tr -d '`' || true)"
done

# Collect commit types actually used in the last 200 commits
# Format: "abc1234 feat(scope): message" — extract the type word after the hash
USED_TYPES=$(git log --oneline -200 2>/dev/null \
  | grep -oE '^[a-f0-9]+ (feat|fix|refactor|perf|style|docs|test|chore|build|ci|revert)[(!:( ]' \
  | grep -oE '(feat|fix|refactor|perf|style|docs|test|chore|build|ci|revert)' \
  | sort -u || true)

MISSING_TYPES=()
for t in $USED_TYPES; do
  if ! echo "$DOCUMENTED_TYPES" | grep -qw "$t"; then
    MISSING_TYPES+=("$t")
  fi
done

if [[ "${#MISSING_TYPES[@]}" -gt 0 ]]; then
  add_finding "low" "Commit types used but not documented (${#MISSING_TYPES[@]})" \
    "These commit types appear in recent git history but are not listed in AGENTS.md or copilot-instructions.md: $(printf '%s ' "${MISSING_TYPES[@]}")" \
    "$(printf '%s\n' "${MISSING_TYPES[@]}")"
fi

# ── 4. Package manager drift ───────────────────────────────────────────────────

# Project uses yarn (yarn.lock present). Flag if npm lockfile also exists.
if [[ -f "yarn.lock" && -f "package-lock.json" ]]; then
  add_finding "high" "Both yarn.lock and package-lock.json present" \
    "The project uses Yarn but package-lock.json also exists. This can cause inconsistent installs. Remove package-lock.json and ensure AGENTS.md reflects the correct package manager." \
    "yarn.lock, package-lock.json"
fi

if [[ -f "yarn.lock" && -f "pnpm-lock.yaml" ]]; then
  add_finding "high" "Both yarn.lock and pnpm-lock.yaml present" \
    "The project uses Yarn but pnpm-lock.yaml also exists. Remove pnpm-lock.yaml." \
    "yarn.lock, pnpm-lock.yaml"
fi

# ── 5. New dependencies added to package.json not mentioned in any doc ─────────

# Check for significant new-ish direct dependencies that agents should know about
# by looking for packages that appear in package.json but not in any doc
PACKAGE_NAMES=$(jq -r '.dependencies // {} | keys[]' package.json 2>/dev/null | grep -v '^@' | head -30 || true)
UNDOCUMENTED_PKGS=()
for pkg in $PACKAGE_NAMES; do
  # Only flag substantial packages (not tiny utilities)
  case "$pkg" in
    axios|leaflet|localforage|svelte|sveltekit|tailwindcss|typescript|vite|vitest)
      if ! grep -qF "$pkg" "$AGENTS_MD" "$COPILOT_MD" 2>/dev/null; then
        UNDOCUMENTED_PKGS+=("$pkg")
      fi
      ;;
  esac
done

if [[ "${#UNDOCUMENTED_PKGS[@]}" -gt 0 ]]; then
  add_finding "info" "Core packages not mentioned in docs (${#UNDOCUMENTED_PKGS[@]})" \
    "These key dependencies appear in package.json but are not mentioned in AGENTS.md or copilot-instructions.md." \
    "$(printf '%s\n' "${UNDOCUMENTED_PKGS[@]}")"
fi

# ── 6. interface vs type: docs say prefer type, check if types.ts still uses interface ──

TYPES_FILE="src/lib/types.ts"
if [[ -f "$TYPES_FILE" ]]; then
  INTERFACE_COUNT_TYPES=$({ grep -c '^\s*export interface\|^\s*interface ' "$TYPES_FILE" 2>/dev/null || echo 0; })
  INTERFACE_COUNT_TYPES=$(sanitize_count "$INTERFACE_COUNT_TYPES")
  if [[ "$INTERFACE_COUNT_TYPES" -gt 0 ]]; then
    add_finding "info" "types.ts still uses interface declarations ($INTERFACE_COUNT_TYPES)" \
      "AGENTS.md documents a preference for 'type' over 'interface', but src/lib/types.ts still has $INTERFACE_COUNT_TYPES interface declarations. Consider adding a note to AGENTS.md to migrate gradually, or update the file." \
      "$(grep -n '^\s*export interface\|^\s*interface ' "$TYPES_FILE" 2>/dev/null | head -5 || true)"
  fi
fi

echo "$FINDINGS" | jq '.' > "$OUTPUT_FILE"
echo "Doc drift scan complete: $OUTPUT_FILE ($(echo "$FINDINGS" | jq length) findings)"

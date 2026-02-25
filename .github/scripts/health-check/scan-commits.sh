#!/usr/bin/env bash
# scan-commits.sh — Analyzes commits merged to main since the last health report.
# Outputs a JSON file with commit stats, hotspots, and quality signals.
set -euo pipefail

OUTPUT_DIR="${1:-.}"
OUTPUT_FILE="$OUTPUT_DIR/commits.json"

# Determine anchor date: last health-report issue creation date, or 14 days ago
LAST_REPORT_DATE=$(gh issue list --label "health-report" --state all --limit 1 \
  --json createdAt --jq '.[0].createdAt // empty' 2>/dev/null || true)

if [[ -z "$LAST_REPORT_DATE" ]]; then
  SINCE_DATE=$(date -u -d '14 days ago' '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null \
    || date -u -v-14d '+%Y-%m-%dT%H:%M:%SZ')
else
  SINCE_DATE="$LAST_REPORT_DATE"
fi

echo "Analyzing commits since: $SINCE_DATE"

# Get the oldest commit hash since the anchor date
OLDEST_HASH=$(git log --since="$SINCE_DATE" --format='%H' --reverse | head -1 || true)

if [[ -z "$OLDEST_HASH" ]]; then
  echo '{"total_commits":0,"message":"No commits found since last report."}' > "$OUTPUT_FILE"
  exit 0
fi

RANGE="${OLDEST_HASH}^..HEAD"

# Total commit count
TOTAL=$(git log --since="$SINCE_DATE" --oneline | wc -l | tr -d ' ')

# Commits by type (conventional commit prefix)
FEAT_COUNT=$(git log --since="$SINCE_DATE" --oneline | grep -ciP '^[a-f0-9]+ feat' || echo 0)
FIX_COUNT=$(git log --since="$SINCE_DATE" --oneline | grep -ciP '^[a-f0-9]+ fix' || echo 0)
REFACTOR_COUNT=$(git log --since="$SINCE_DATE" --oneline | grep -ciP '^[a-f0-9]+ refactor' || echo 0)
CHORE_COUNT=$(git log --since="$SINCE_DATE" --oneline | grep -ciP '^[a-f0-9]+ chore' || echo 0)
PERF_COUNT=$(git log --since="$SINCE_DATE" --oneline | grep -ciP '^[a-f0-9]+ perf' || echo 0)
STYLE_COUNT=$(git log --since="$SINCE_DATE" --oneline | grep -ciP '^[a-f0-9]+ style' || echo 0)
DOCS_COUNT=$(git log --since="$SINCE_DATE" --oneline | grep -ciP '^[a-f0-9]+ docs' || echo 0)
TEST_COUNT=$(git log --since="$SINCE_DATE" --oneline | grep -ciP '^[a-f0-9]+ test' || echo 0)

# Non-conventional commits (don't match type(scope): or type: pattern)
NON_CONVENTIONAL=$(git log --since="$SINCE_DATE" --pretty=format:'%s' \
  | grep -cvP '^\s*(feat|fix|refactor|chore|perf|style|docs|test|build|ci|revert)(\(.+\))?(!)?:\s' || echo 0)

# Commits missing issue references (#123)
MISSING_ISSUE_REF=$(git log --since="$SINCE_DATE" --pretty=format:'%h %s' \
  | grep -cv '#[0-9]' || echo 0)

# List commits missing issue refs (for the report)
MISSING_ISSUE_LIST=$(git log --since="$SINCE_DATE" --pretty=format:'%h %s' \
  | grep -v '#[0-9]' | head -20 || true)

# Non-conventional commit list
NON_CONVENTIONAL_LIST=$(git log --since="$SINCE_DATE" --pretty=format:'%h %s' \
  | grep -vP '^\s*[a-f0-9]+\s+(feat|fix|refactor|chore|perf|style|docs|test|build|ci|revert)(\(.+\))?(!)?:\s' \
  | head -20 || true)

# Unique contributors
CONTRIBUTORS=$(git log --since="$SINCE_DATE" --format='%an' | sort -u | wc -l | tr -d ' ')
CONTRIBUTOR_LIST=$(git log --since="$SINCE_DATE" --format='%an' | sort | uniq -c | sort -rn | head -10)

# File change frequency (hotspots) — top 15 most changed files
HOTSPOTS=$(git log --since="$SINCE_DATE" --name-only --pretty=format: \
  | grep -v '^$' | sort | uniq -c | sort -rn | head -15)

# Files changed count
FILES_CHANGED=$(git log --since="$SINCE_DATE" --name-only --pretty=format: \
  | grep -v '^$' | sort -u | wc -l | tr -d ' ')

# Detect new dependencies added in package.json
NEW_DEPS=""
if git log --since="$SINCE_DATE" --name-only --pretty=format: | grep -q 'package.json'; then
  # Get package.json diff for added dependency lines
  NEW_DEPS=$(git diff "$OLDEST_HASH^"..HEAD -- package.json \
    | grep '^+' | grep -vP '^\+\+\+' | grep -oP '"\K[^"]+(?="\s*:\s*")' || true)
fi

# Detect cosmetic-only commits (only whitespace, comments, or formatting changes)
COSMETIC_COMMITS=""
while IFS= read -r hash; do
  [[ -z "$hash" ]] && continue
  # Check if the diff only contains whitespace changes
  DIFF_CONTENT=$(git diff "$hash^".."$hash" -- '*.ts' '*.svelte' '*.js' 2>/dev/null \
    | grep '^[+-]' | grep -v '^[+-][+-][+-]' | sed 's/^[+-]//' | sed 's/[[:space:]]//g' || true)
  ADDED=$(git diff "$hash^".."$hash" -- '*.ts' '*.svelte' '*.js' 2>/dev/null \
    | grep '^+' | grep -v '^\+\+\+' | sed 's/^+//' | sed 's/[[:space:]]//g' || true)
  REMOVED=$(git diff "$hash^".."$hash" -- '*.ts' '*.svelte' '*.js' 2>/dev/null \
    | grep '^-' | grep -v '^\-\-\-' | sed 's/^-//' | sed 's/[[:space:]]//g' || true)
  if [[ "$ADDED" == "$REMOVED" && -n "$ADDED" ]]; then
    SUBJECT=$(git log -1 --format='%s' "$hash")
    COSMETIC_COMMITS="${COSMETIC_COMMITS}${hash:0:7} ${SUBJECT}\n"
  fi
done < <(git log --since="$SINCE_DATE" --format='%H')

# Detect commits that touch src/ but no test files
CODE_NO_TESTS=""
while IFS= read -r hash; do
  [[ -z "$hash" ]] && continue
  FILES=$(git diff-tree --no-commit-id --name-only -r "$hash" 2>/dev/null || true)
  HAS_SRC=$(echo "$FILES" | grep -c '^src/' || echo 0)
  HAS_TEST=$(echo "$FILES" | grep -cE '\.(test|spec)\.(ts|js)$' || echo 0)
  SUBJECT=$(git log -1 --format='%s' "$hash")
  # Only flag feat/fix commits that change src/ without tests
  if [[ "$HAS_SRC" -gt 0 && "$HAS_TEST" -eq 0 ]] && echo "$SUBJECT" | grep -qP '^(feat|fix)'; then
    CODE_NO_TESTS="${CODE_NO_TESTS}${hash:0:7} ${SUBJECT}\n"
  fi
done < <(git log --since="$SINCE_DATE" --format='%H')

# Detect quick-fix patterns (a commit followed by a fix to the same file within 24h)
QUICK_FIXES=""
PREV_HASH=""
PREV_DATE=""
PREV_FILES=""
while IFS='|' read -r hash date files subject; do
  [[ -z "$hash" ]] && continue
  if [[ -n "$PREV_HASH" && -n "$files" && -n "$PREV_FILES" ]]; then
    # Check for overlapping files
    OVERLAP=$(comm -12 <(echo "$files" | tr ' ' '\n' | sort) <(echo "$PREV_FILES" | tr ' ' '\n' | sort) | head -1 || true)
    if [[ -n "$OVERLAP" ]] && echo "$subject" | grep -qiP '(fix|patch|hotfix|oops|typo|revert)'; then
      QUICK_FIXES="${QUICK_FIXES}${hash:0:7} ${subject} (fixes ${PREV_HASH:0:7})\n"
    fi
  fi
  PREV_HASH="$hash"
  PREV_DATE="$date"
  PREV_FILES="$files"
done < <(git log --since="$SINCE_DATE" --pretty=format:'%H|%ad|' --date=unix --name-only \
  | awk 'BEGIN{RS=""} {gsub(/\n/, " "); print}' | head -100)

# Detect AI-generated commit signatures
AI_SIGNATURES=""
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  HASH="${line%% *}"
  MSG=$(git log -1 --format='%b' "$HASH" 2>/dev/null || true)
  SUBJECT=$(git log -1 --format='%s' "$HASH")
  if echo "$MSG $SUBJECT" | grep -qiP '(co-authored-by:.*copilot|generated by|chatgpt|claude|gemini|cursor|aider|opencode)'; then
    AI_SIGNATURES="${AI_SIGNATURES}${HASH:0:7} ${SUBJECT}\n"
  fi
done < <(git log --since="$SINCE_DATE" --format='%H %s')

# Build JSON output
cat > "$OUTPUT_FILE" << JSONEOF
{
  "since": "$SINCE_DATE",
  "total_commits": $TOTAL,
  "contributors": $CONTRIBUTORS,
  "files_changed": $FILES_CHANGED,
  "by_type": {
    "feat": $FEAT_COUNT,
    "fix": $FIX_COUNT,
    "refactor": $REFACTOR_COUNT,
    "chore": $CHORE_COUNT,
    "perf": $PERF_COUNT,
    "style": $STYLE_COUNT,
    "docs": $DOCS_COUNT,
    "test": $TEST_COUNT
  },
  "non_conventional_count": $NON_CONVENTIONAL,
  "missing_issue_ref_count": $MISSING_ISSUE_REF,
  "non_conventional_list": $(echo -e "$NON_CONVENTIONAL_LIST" | jq -Rs 'split("\n") | map(select(. != ""))'),
  "missing_issue_list": $(echo -e "$MISSING_ISSUE_LIST" | jq -Rs 'split("\n") | map(select(. != ""))'),
  "contributor_list": $(echo "$CONTRIBUTOR_LIST" | jq -Rs 'split("\n") | map(select(. != ""))'),
  "hotspots": $(echo "$HOTSPOTS" | jq -Rs 'split("\n") | map(select(. != ""))'),
  "new_dependencies": $(echo -e "$NEW_DEPS" | jq -Rs 'split("\n") | map(select(. != ""))'),
  "cosmetic_commits": $(echo -e "$COSMETIC_COMMITS" | jq -Rs 'split("\n") | map(select(. != ""))'),
  "code_without_tests": $(echo -e "$CODE_NO_TESTS" | jq -Rs 'split("\n") | map(select(. != ""))'),
  "quick_fixes": $(echo -e "$QUICK_FIXES" | jq -Rs 'split("\n") | map(select(. != ""))'),
  "ai_signatures": $(echo -e "$AI_SIGNATURES" | jq -Rs 'split("\n") | map(select(. != ""))')
}
JSONEOF

echo "Commit analysis complete: $OUTPUT_FILE"

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

# Total commit count
TOTAL=$(git log --since="$SINCE_DATE" --oneline | wc -l | tr -d ' ')

# Helper: run a grep -c pipeline safely, stripping whitespace and defaulting to 0
grep_count() { local n; n=$(eval "$@" 2>/dev/null || true); n="${n//[^0-9]/}"; echo "${n:-0}"; }

# Commits by type (conventional commit prefix)
FEAT_COUNT=$(grep_count "git log --since=\"$SINCE_DATE\" --oneline | grep -ciP '^[a-f0-9]+ feat'")
FIX_COUNT=$(grep_count "git log --since=\"$SINCE_DATE\" --oneline | grep -ciP '^[a-f0-9]+ fix'")
REFACTOR_COUNT=$(grep_count "git log --since=\"$SINCE_DATE\" --oneline | grep -ciP '^[a-f0-9]+ refactor'")
CHORE_COUNT=$(grep_count "git log --since=\"$SINCE_DATE\" --oneline | grep -ciP '^[a-f0-9]+ chore'")
PERF_COUNT=$(grep_count "git log --since=\"$SINCE_DATE\" --oneline | grep -ciP '^[a-f0-9]+ perf'")
STYLE_COUNT=$(grep_count "git log --since=\"$SINCE_DATE\" --oneline | grep -ciP '^[a-f0-9]+ style'")
DOCS_COUNT=$(grep_count "git log --since=\"$SINCE_DATE\" --oneline | grep -ciP '^[a-f0-9]+ docs'")
TEST_COUNT=$(grep_count "git log --since=\"$SINCE_DATE\" --oneline | grep -ciP '^[a-f0-9]+ test'")

# Non-conventional commits (don't match type(scope): or type: pattern)
NON_CONVENTIONAL=$(grep_count "git log --since=\"$SINCE_DATE\" --pretty=format:'%s' \
  | grep -cvP '^\s*(feat|fix|refactor|chore|perf|style|docs|test|build|ci|revert)(\(.+\))?(!)?:\s'")

# Commits missing issue references (#123)
MISSING_ISSUE_REF=$(grep_count "git log --since=\"$SINCE_DATE\" --pretty=format:'%h %s' \
  | grep -cv '#[0-9]'")

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
  ADDED=$(git diff "${hash}^".."${hash}" -- '*.ts' '*.svelte' '*.js' 2>/dev/null \
    | grep '^+' | grep -v '^\+\+\+' | sed 's/^+//' | sed 's/[[:space:]]//g' || true)
  REMOVED=$(git diff "${hash}^".."${hash}" -- '*.ts' '*.svelte' '*.js' 2>/dev/null \
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
  HAS_SRC=$(grep_count "echo \"\$FILES\" | grep -c '^src/'")
  HAS_TEST=$(grep_count "echo \"\$FILES\" | grep -cE '\.(test|spec)\.(ts|js)\$'")
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
while IFS='|' read -r hash date subject files; do
  [[ -z "$hash" ]] && continue
  if [[ -n "$PREV_HASH" && -n "$files" && -n "$PREV_FILES" ]]; then
    # Check for overlapping files
    OVERLAP=$(comm -12 <(echo "$files" | tr ' ' '\n' | sort) <(echo "$PREV_FILES" | tr ' ' '\n' | sort) | head -1 || true)
    if [[ -n "$OVERLAP" ]]; then
      # Only flag quick fixes within 24h (86400 seconds)
      TIME_DIFF=$(( PREV_DATE - date ))
      if (( TIME_DIFF < 0 )); then TIME_DIFF=$(( -TIME_DIFF )); fi
      if (( TIME_DIFF <= 86400 )) && echo "$subject" | grep -qiP '(fix|patch|hotfix|oops|typo|revert)'; then
        QUICK_FIXES="${QUICK_FIXES}${hash:0:7} ${subject} (fixes ${PREV_HASH:0:7})\n"
      fi
    fi
  fi
  PREV_HASH="$hash"
  PREV_DATE="$date"
  PREV_FILES="$files"
done < <(git log --since="$SINCE_DATE" --pretty=format:'%H|%ad|%s|' --date=unix --name-only \
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

# Build JSON output using jq for safe encoding
json_array_from() {
  echo -e "$1" | jq -Rs 'split("\n") | map(select(. != ""))'
}

jq -n \
  --arg since "$SINCE_DATE" \
  --argjson total "$TOTAL" \
  --argjson contributors "$CONTRIBUTORS" \
  --argjson files_changed "$FILES_CHANGED" \
  --argjson feat "$FEAT_COUNT" \
  --argjson fix "$FIX_COUNT" \
  --argjson refactor "$REFACTOR_COUNT" \
  --argjson chore "$CHORE_COUNT" \
  --argjson perf "$PERF_COUNT" \
  --argjson style "$STYLE_COUNT" \
  --argjson docs "$DOCS_COUNT" \
  --argjson test "$TEST_COUNT" \
  --argjson non_conventional "$NON_CONVENTIONAL" \
  --argjson missing_issue_ref "$MISSING_ISSUE_REF" \
  --argjson non_conventional_list "$(json_array_from "$NON_CONVENTIONAL_LIST")" \
  --argjson missing_issue_list "$(json_array_from "$MISSING_ISSUE_LIST")" \
  --argjson contributor_list "$(echo "$CONTRIBUTOR_LIST" | jq -Rs 'split("\n") | map(select(. != ""))')" \
  --argjson hotspots "$(echo "$HOTSPOTS" | jq -Rs 'split("\n") | map(select(. != ""))')" \
  --argjson new_dependencies "$(json_array_from "$NEW_DEPS")" \
  --argjson cosmetic_commits "$(json_array_from "$COSMETIC_COMMITS")" \
  --argjson code_without_tests "$(json_array_from "$CODE_NO_TESTS")" \
  --argjson quick_fixes "$(json_array_from "$QUICK_FIXES")" \
  --argjson ai_signatures "$(json_array_from "$AI_SIGNATURES")" \
  '{
    since: $since,
    total_commits: $total,
    contributors: $contributors,
    files_changed: $files_changed,
    by_type: {
      feat: $feat,
      fix: $fix,
      refactor: $refactor,
      chore: $chore,
      perf: $perf,
      style: $style,
      docs: $docs,
      test: $test
    },
    non_conventional_count: $non_conventional,
    missing_issue_ref_count: $missing_issue_ref,
    non_conventional_list: $non_conventional_list,
    missing_issue_list: $missing_issue_list,
    contributor_list: $contributor_list,
    hotspots: $hotspots,
    new_dependencies: $new_dependencies,
    cosmetic_commits: $cosmetic_commits,
    code_without_tests: $code_without_tests,
    quick_fixes: $quick_fixes,
    ai_signatures: $ai_signatures
  }' > "$OUTPUT_FILE"

echo "Commit analysis complete: $OUTPUT_FILE"

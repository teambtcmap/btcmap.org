#!/usr/bin/env bash
# scan-ci.sh — Reviews CI/CD configuration for improvements and best practices.
set -euo pipefail

OUTPUT_DIR="${1:-.}"
OUTPUT_FILE="$OUTPUT_DIR/ci.json"

FINDINGS="[]"

add_finding() {
  local severity="$1" title="$2" details="$3" files="$4"
  FINDINGS=$(echo "$FINDINGS" | jq \
    --arg sev "$severity" --arg title "$title" --arg details "$details" --arg files "$files" \
    '. + [{"severity": $sev, "title": $title, "details": $details, "files": $files}]')
}

# 1. Check for outdated action versions
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  FILE=$(echo "$line" | cut -d: -f1)
  ACTION=$(echo "$line" | grep -oP 'uses:\s*\K\S+' || true)
  [[ -z "$ACTION" ]] && continue

  # Check for v1/v2/v3 of common actions that have v4+
  if echo "$ACTION" | grep -qP 'actions/(checkout|cache|upload-artifact|download-artifact|setup-node)@v[123]$'; then
    add_finding "medium" "Outdated action version: $ACTION" \
      "Consider upgrading to the latest major version for security fixes and new features." \
      "$FILE"
  fi
done < <(grep -rn 'uses:' .github/workflows/ 2>/dev/null || true)

# 2. Check for missing concurrency groups
for workflow in .github/workflows/*.yml; do
  [[ ! -f "$workflow" ]] && continue
  if ! grep -q 'concurrency:' "$workflow" 2>/dev/null; then
    add_finding "medium" "Missing concurrency group in $(basename "$workflow")" \
      "Without concurrency groups, multiple CI runs for the same PR run simultaneously, wasting Actions minutes." \
      "$workflow"
  fi
done

# 3. Check if unit test command uses --run flag
UNIT_TEST_WF=".github/workflows/unit-tests.yml"
if [[ -f "$UNIT_TEST_WF" ]]; then
  if grep -q 'yarn run test$' "$UNIT_TEST_WF" 2>/dev/null; then
    if ! grep -q '\-\-run' "$UNIT_TEST_WF" 2>/dev/null; then
      add_finding "low" "Unit test workflow doesn't use --run flag" \
        "The test command runs vitest without --run. While vitest auto-detects CI, using --run is more explicit." \
        "$UNIT_TEST_WF"
    fi
  fi
fi

# 4. Check for workflows without timeout
for workflow in .github/workflows/*.yml; do
  [[ ! -f "$workflow" ]] && continue
  BASENAME=$(basename "$workflow")
  if ! grep -q 'timeout-minutes' "$workflow" 2>/dev/null; then
    add_finding "low" "No timeout-minutes set in $BASENAME" \
      "Setting timeout-minutes prevents stuck workflows from consuming Actions minutes indefinitely." \
      "$workflow"
  fi
done

# 5. Check for node version pinning
SETUP_ACTION=".github/actions/setup/action.yml"
if [[ -f "$SETUP_ACTION" ]]; then
  if grep -qP "node-version.*lts/\*" "$SETUP_ACTION" 2>/dev/null; then
    add_finding "info" "Node version uses lts/* (unpinned)" \
      "Using lts/* means the Node version can change unexpectedly. Consider pinning to a specific LTS version." \
      "$SETUP_ACTION"
  fi
fi

# 6. Check for stale dependabot groups
if [[ -f ".github/dependabot.yml" ]]; then
  STALE_GROUPS=""
  # Check each group pattern against actual dependencies
  while IFS= read -r pattern; do
    [[ -z "$pattern" ]] && continue
    # Convert glob to regex
    REGEX=$(echo "$pattern" | sed "s/'//g" | sed 's/\*/.*/')
    if ! grep -qP "$REGEX" package.json 2>/dev/null; then
      STALE_GROUPS="${STALE_GROUPS}Pattern: $pattern\n"
    fi
  done < <(grep "- '" .github/dependabot.yml 2>/dev/null | grep -v 'package-ecosystem\|interval\|directory')

  if [[ -n "$STALE_GROUPS" ]]; then
    add_finding "low" "Potentially stale dependabot group patterns" \
      "Some dependabot group patterns may not match any current dependencies." \
      "$(echo -e "$STALE_GROUPS" | head -5)"
  fi
fi

# 7. Check GitHub Actions ecosystem in dependabot
if [[ -f ".github/dependabot.yml" ]]; then
  if ! grep -q 'github-actions' .github/dependabot.yml 2>/dev/null; then
    add_finding "medium" "Missing github-actions ecosystem in dependabot" \
      "Add github-actions to dependabot to keep action versions current automatically." \
      ".github/dependabot.yml"
  fi
fi

echo "$FINDINGS" | jq '.' > "$OUTPUT_FILE"
echo "CI/CD scan complete: $OUTPUT_FILE ($(echo "$FINDINGS" | jq length) findings)"

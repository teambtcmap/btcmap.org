#!/usr/bin/env bash
# build-report.sh — Assembles all scan results into a structured markdown report.
# This output is optionally fed to AI for synthesis, or used directly as the issue body.
set -euo pipefail

OUTPUT_DIR="${1:-.}"
REPORT_FILE="$OUTPUT_DIR/report.md"
TODAY=$(date -u '+%b %d, %Y')

# Read scan results
COMMITS_FILE="$OUTPUT_DIR/commits.json"
HYGIENE_FILE="$OUTPUT_DIR/hygiene.json"
CONSISTENCY_FILE="$OUTPUT_DIR/consistency.json"
SVELTE_FILE="$OUTPUT_DIR/svelte-v5.json"
A11Y_FILE="$OUTPUT_DIR/a11y.json"
API_FILE="$OUTPUT_DIR/api.json"
CI_FILE="$OUTPUT_DIR/ci.json"
ENABLED_FILE="$OUTPUT_DIR/enabled_checks.txt"

# Helper: check if a scan is enabled
is_enabled() {
  grep -Fxiq "$1" "$ENABLED_FILE" 2>/dev/null
}

# Helper: count findings by severity from a JSON findings array
count_severity() {
  local file="$1" severity="$2"
  [[ ! -f "$file" ]] && echo 0 && return
  jq --arg s "$severity" '[.[] | select(.severity == $s)] | length' "$file" 2>/dev/null || echo 0
}

# Helper: render findings from a JSON array
render_findings() {
  local file="$1"
  [[ ! -f "$file" ]] && return
  local len
  len=$(jq 'length' "$file" 2>/dev/null || echo 0)
  if [[ "$len" -eq 0 ]]; then
    echo "No issues found."
    echo ""
    return
  fi
  for i in $(seq 0 $((len - 1))); do
    local sev title details files
    sev=$(jq -r ".[$i].severity" "$file")
    title=$(jq -r ".[$i].title" "$file")
    details=$(jq -r ".[$i].details" "$file")
    files=$(jq -r ".[$i].files" "$file")

    local icon=""
    case "$sev" in
      high) icon="HIGH" ;;
      medium) icon="MEDIUM" ;;
      low) icon="LOW" ;;
      info) icon="INFO" ;;
    esac

    echo "### $icon: $title"
    echo ""
    echo "$details"
    echo ""
    if [[ -n "$files" && "$files" != "null" ]]; then
      echo "<details><summary>Files</summary>"
      echo ""
      echo '```'
      echo "$files"
      echo '```'
      echo ""
      echo "</details>"
      echo ""
    fi
  done
}

# Start building the report
{
  echo "# Biweekly Codebase Health Report — $TODAY"
  echo ""

  # Summary counts
  HIGH=0; MEDIUM=0; LOW=0; INFO=0
  for f in "$HYGIENE_FILE" "$CONSISTENCY_FILE" "$A11Y_FILE" "$API_FILE" "$CI_FILE"; do
    [[ ! -f "$f" ]] && continue
    HIGH=$((HIGH + $(count_severity "$f" "high")))
    MEDIUM=$((MEDIUM + $(count_severity "$f" "medium")))
    LOW=$((LOW + $(count_severity "$f" "low")))
    INFO=$((INFO + $(count_severity "$f" "info")))
  done

  echo "## Summary"
  echo "- **$HIGH** High priority findings"
  echo "- **$MEDIUM** Medium priority findings"
  echo "- **$LOW** Low priority findings"
  echo "- **$INFO** Informational"
  echo ""
  echo "---"
  echo ""

  # Commit changelog analysis
  if is_enabled "Commit changelog analysis"; then
    echo "## Changes Since Last Report"
    echo ""
    if [[ -f "$COMMITS_FILE" ]]; then
      TOTAL=$(jq '.total_commits' "$COMMITS_FILE")
      if [[ "$TOTAL" -eq 0 ]]; then
        echo "No commits found since the last report."
        echo ""
      else
        CONTRIBS=$(jq '.contributors' "$COMMITS_FILE")
        FILES_CHANGED=$(jq '.files_changed' "$COMMITS_FILE")
        SINCE=$(jq -r '.since' "$COMMITS_FILE")
        echo "**$TOTAL commits** by $CONTRIBS contributors across **$FILES_CHANGED files** (since $SINCE)"
        echo ""

        # Commit breakdown table
        echo "### Commit Breakdown"
        echo "| Type | Count |"
        echo "|------|-------|"
        for t in feat fix refactor chore perf style docs test; do
          COUNT=$(jq ".by_type.$t" "$COMMITS_FILE")
          [[ "$COUNT" -gt 0 ]] && echo "| $t | $COUNT |"
        done
        echo ""

        # Hotspot files
        HOTSPOTS=$(jq -r '.hotspots[]' "$COMMITS_FILE" 2>/dev/null || true)
        if [[ -n "$HOTSPOTS" ]]; then
          echo "### Hotspot Files (most frequently changed)"
          echo '```'
          echo "$HOTSPOTS" | head -10
          echo '```'
          echo ""
        fi

        # Observations
        echo "### Observations"
        echo ""

        NON_CONV=$(jq '.non_conventional_count' "$COMMITS_FILE")
        if [[ "$NON_CONV" -gt 0 ]]; then
          echo "- **$NON_CONV commits** don't follow conventional commit format"
          NON_CONV_LIST=$(jq -r '.non_conventional_list[]' "$COMMITS_FILE" 2>/dev/null | head -5 || true)
          if [[ -n "$NON_CONV_LIST" ]]; then
            echo "  <details><summary>Show commits</summary>"
            echo ""
            echo '  ```'
            echo "  $NON_CONV_LIST"
            echo '  ```'
            echo "  </details>"
          fi
          echo ""
        fi

        MISSING_REF=$(jq '.missing_issue_ref_count' "$COMMITS_FILE")
        if [[ "$MISSING_REF" -gt 0 ]]; then
          echo "- **$MISSING_REF commits** missing issue references (\`#123\`)"
          MISSING_LIST=$(jq -r '.missing_issue_list[]' "$COMMITS_FILE" 2>/dev/null | head -5 || true)
          if [[ -n "$MISSING_LIST" ]]; then
            echo "  <details><summary>Show commits</summary>"
            echo ""
            echo '  ```'
            echo "  $MISSING_LIST"
            echo '  ```'
            echo "  </details>"
          fi
          echo ""
        fi

        # Cosmetic commits
        COSMETIC=$(jq -r '.cosmetic_commits | length' "$COMMITS_FILE" 2>/dev/null || echo 0)
        if [[ "$COSMETIC" -gt 0 ]]; then
          echo "- **$COSMETIC cosmetic-only commits** (whitespace/formatting only)"
          COSMETIC_LIST=$(jq -r '.cosmetic_commits[]' "$COMMITS_FILE" 2>/dev/null | head -5 || true)
          if [[ -n "$COSMETIC_LIST" ]]; then
            echo "  <details><summary>Show commits</summary>"
            echo ""
            echo '  ```'
            echo "  $COSMETIC_LIST"
            echo '  ```'
            echo "  </details>"
          fi
          echo ""
        fi

        # Code without tests
        CODE_NO_TESTS=$(jq -r '.code_without_tests | length' "$COMMITS_FILE" 2>/dev/null || echo 0)
        if [[ "$CODE_NO_TESTS" -gt 0 ]]; then
          echo "- **$CODE_NO_TESTS feat/fix commits** with no accompanying test changes"
          CNT_LIST=$(jq -r '.code_without_tests[]' "$COMMITS_FILE" 2>/dev/null | head -5 || true)
          if [[ -n "$CNT_LIST" ]]; then
            echo "  <details><summary>Show commits</summary>"
            echo ""
            echo '  ```'
            echo "  $CNT_LIST"
            echo '  ```'
            echo "  </details>"
          fi
          echo ""
        fi

        # Quick fixes
        QUICK_FIXES=$(jq -r '.quick_fixes | length' "$COMMITS_FILE" 2>/dev/null || echo 0)
        if [[ "$QUICK_FIXES" -gt 0 ]]; then
          echo "- **$QUICK_FIXES quick-fix patterns** detected (fix immediately following another commit to the same file)"
          QF_LIST=$(jq -r '.quick_fixes[]' "$COMMITS_FILE" 2>/dev/null | head -5 || true)
          if [[ -n "$QF_LIST" ]]; then
            echo "  <details><summary>Show commits</summary>"
            echo ""
            echo '  ```'
            echo "  $QF_LIST"
            echo '  ```'
            echo "  </details>"
          fi
          echo ""
        fi

        # AI signatures
        AI_SIGS=$(jq -r '.ai_signatures | length' "$COMMITS_FILE" 2>/dev/null || echo 0)
        if [[ "$AI_SIGS" -gt 0 ]]; then
          echo "- **$AI_SIGS commits** with AI-generated signatures detected"
          AI_LIST=$(jq -r '.ai_signatures[]' "$COMMITS_FILE" 2>/dev/null | head -5 || true)
          if [[ -n "$AI_LIST" ]]; then
            echo "  <details><summary>Show commits</summary>"
            echo ""
            echo '  ```'
            echo "  $AI_LIST"
            echo '  ```'
            echo "  </details>"
          fi
          echo ""
        fi

        # New deps
        NEW_DEPS=$(jq -r '.new_dependencies | length' "$COMMITS_FILE" 2>/dev/null || echo 0)
        if [[ "$NEW_DEPS" -gt 0 ]]; then
          DEPS_LIST=$(jq -r '.new_dependencies[]' "$COMMITS_FILE" 2>/dev/null || true)
          echo "- **$NEW_DEPS new dependencies** added: $DEPS_LIST"
          echo ""
        fi
      fi
    else
      echo "Commit analysis data not available."
      echo ""
    fi
    echo "---"
    echo ""
  fi

  # Codebase hygiene
  if is_enabled "Codebase hygiene" && [[ -f "$HYGIENE_FILE" ]]; then
    echo "## Codebase Hygiene"
    echo ""
    render_findings "$HYGIENE_FILE"
    echo "---"
    echo ""
  fi

  # Consistency
  if is_enabled "Consistency" && [[ -f "$CONSISTENCY_FILE" ]]; then
    echo "## Code Consistency"
    echo ""
    render_findings "$CONSISTENCY_FILE"
    echo "---"
    echo ""
  fi

  # Accessibility
  if is_enabled "Accessibility" && [[ -f "$A11Y_FILE" ]]; then
    echo "## Accessibility"
    echo ""
    render_findings "$A11Y_FILE"
    echo "---"
    echo ""
  fi

  # Svelte v5 migration
  if is_enabled "Svelte v5 migration readiness" && [[ -f "$SVELTE_FILE" ]]; then
    echo "## Svelte v5 Migration Readiness"
    echo ""
    REACTIVE=$(jq '.reactive_declarations' "$SVELTE_FILE")
    DISPATCH=$(jq '.create_event_dispatcher' "$SVELTE_FILE")
    SLOTS=$(jq '.slot_usage' "$SVELTE_FILE")
    BEFORE_UPD=$(jq '.before_update' "$SVELTE_FILE")
    AFTER_UPD=$(jq '.after_update' "$SVELTE_FILE")
    DOLLAR_P=$(jq '.dollar_props' "$SVELTE_FILE")
    SVELTE_COMP=$(jq '.svelte_component' "$SVELTE_FILE")

    PREV_REACTIVE=$(jq '.previous.reactive_declarations // empty' "$SVELTE_FILE" 2>/dev/null || true)
    PREV_DISPATCH=$(jq '.previous.create_event_dispatcher // empty' "$SVELTE_FILE" 2>/dev/null || true)
    PREV_SLOTS=$(jq '.previous.slot_usage // empty' "$SVELTE_FILE" 2>/dev/null || true)

    echo "| Pattern | Count | v5 Replacement | Delta |"
    echo "|---------|-------|----------------|-------|"

    delta() {
      local current="$1" previous="$2"
      if [[ -z "$previous" || "$previous" == "null" ]]; then
        echo "N/A"
      else
        local diff=$((current - previous))
        if [[ "$diff" -lt 0 ]]; then echo "$diff"; elif [[ "$diff" -gt 0 ]]; then echo "+$diff"; else echo "0"; fi
      fi
    }

    echo "| \`\$:\` reactive declarations | $REACTIVE | \`\$derived\` / \`\$effect\` | $(delta "$REACTIVE" "$PREV_REACTIVE") |"
    echo "| \`createEventDispatcher\` | $DISPATCH | Callback props | $(delta "$DISPATCH" "$PREV_DISPATCH") |"
    echo "| \`<slot>\` usage | $SLOTS | \`{@render}\` / snippets | $(delta "$SLOTS" "$PREV_SLOTS") |"
    echo "| \`beforeUpdate\` | $BEFORE_UPD | \`\$effect.pre\` | N/A |"
    echo "| \`afterUpdate\` | $AFTER_UPD | \`\$effect\` | N/A |"
    echo "| \`\$\$props\` / \`\$\$restProps\` | $DOLLAR_P | Spread props | N/A |"
    echo "| \`<svelte:component>\` | $SVELTE_COMP | Dynamic \`<Component>\` | N/A |"
    echo ""

    TOTAL_ITEMS=$((REACTIVE + DISPATCH + SLOTS + BEFORE_UPD + AFTER_UPD + DOLLAR_P + SVELTE_COMP))
    echo "**Total migration items: $TOTAL_ITEMS**"
    echo ""
    echo "---"
    echo ""
  fi

  # API/Data handling
  if is_enabled "API/data handling" && [[ -f "$API_FILE" ]]; then
    echo "## API & Data Handling"
    echo ""
    render_findings "$API_FILE"
    echo "---"
    echo ""
  fi

  # CI/CD
  if is_enabled "CI/CD improvements" && [[ -f "$CI_FILE" ]]; then
    echo "## CI/CD"
    echo ""
    render_findings "$CI_FILE"
    echo "---"
    echo ""
  fi

  # Config footer
  echo "<details><summary>Current Configuration</summary>"
  echo ""
  echo "Reply with \`/config\` followed by an updated checklist to adjust what future reports analyze."
  echo ""
  echo '```'
  echo "/config"
  echo ""
  echo "## Enabled Checks"
  for check in "Codebase hygiene" "Consistency" "Type safety audit" "CI/CD improvements" "Accessibility" "Svelte v5 migration readiness" "API/data handling" "Commit changelog analysis"; do
    label="$check"
    if [[ "$check" == "Type safety audit" ]]; then
      label="$check (not yet implemented)"
    fi
    if is_enabled "$check"; then
      echo "- [x] $label"
    else
      echo "- [ ] $label"
    fi
  done
  echo '```'
  echo ""
  echo "</details>"
  echo ""
  echo "<details><summary>Available Commands</summary>"
  echo ""
  echo "Reply to this issue with any of the following:"
  echo ""
  echo "| Command | Description |"
  echo "|---------|-------------|"
  echo "| \`/config\` | Adjust which checks are enabled for future reports (include a checkbox list) |"
  echo "| \`/run-now\` | Trigger a new health report immediately |"
  echo "| \`/skip-next\` | Skip the next scheduled report |"
  echo "| \`/create-issue <title>\` | Create a new issue from a specific finding |"
  echo ""
  echo "</details>"
  echo ""
  echo "---"
  echo "_Report generated by [codebase-health-report](https://github.com/$GITHUB_REPOSITORY/actions/workflows/codebase-health-report.yml) workflow._"

} > "$REPORT_FILE"

echo "Report assembled: $REPORT_FILE"

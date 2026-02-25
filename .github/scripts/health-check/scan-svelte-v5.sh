#!/usr/bin/env bash
# scan-svelte-v5.sh — Tracks Svelte v5 migration readiness by counting v4 patterns
# that will need updating when the project eventually migrates.
set -euo pipefail

OUTPUT_DIR="${1:-.}"
OUTPUT_FILE="$OUTPUT_DIR/svelte-v5.json"

# Count reactive declarations ($:)
REACTIVE_DECLS=$(grep -rn '^\s*\$:' src/ --include='*.svelte' 2>/dev/null | wc -l | tr -d ' ')
REACTIVE_FILES=$(grep -rn '^\s*\$:' src/ --include='*.svelte' 2>/dev/null \
  | cut -d: -f1 | sort -u | head -20)

# Count createEventDispatcher usage
EVENT_DISPATCH=$(grep -rn 'createEventDispatcher' src/ --include='*.svelte' --include='*.ts' 2>/dev/null | wc -l | tr -d ' ')
EVENT_DISPATCH_FILES=$(grep -rn 'createEventDispatcher' src/ --include='*.svelte' --include='*.ts' 2>/dev/null \
  | cut -d: -f1 | sort -u | head -20)

# Count <slot> usage (will become {@render} / snippets)
SLOT_USAGE=$(grep -rn '<slot' src/ --include='*.svelte' 2>/dev/null | wc -l | tr -d ' ')
SLOT_FILES=$(grep -rn '<slot' src/ --include='*.svelte' 2>/dev/null \
  | cut -d: -f1 | sort -u | head -20)

# Count beforeUpdate/afterUpdate lifecycle hooks
BEFORE_UPDATE=$(grep -rn 'beforeUpdate' src/ --include='*.svelte' --include='*.ts' 2>/dev/null | wc -l | tr -d ' ')
AFTER_UPDATE=$(grep -rn 'afterUpdate' src/ --include='*.svelte' --include='*.ts' 2>/dev/null | wc -l | tr -d ' ')
LIFECYCLE_FILES=$(grep -rn 'beforeUpdate\|afterUpdate' src/ --include='*.svelte' --include='*.ts' 2>/dev/null \
  | cut -d: -f1 | sort -u | head -20)

# Count $$props / $$restProps usage
DOLLAR_PROPS=$(grep -rn '\$\$props\|\$\$restProps' src/ --include='*.svelte' 2>/dev/null | wc -l | tr -d ' ')
DOLLAR_PROPS_FILES=$(grep -rn '\$\$props\|\$\$restProps' src/ --include='*.svelte' 2>/dev/null \
  | cut -d: -f1 | sort -u | head -20)

# Count <svelte:component> usage (simplified in v5)
SVELTE_COMPONENT=$(grep -rn '<svelte:component' src/ --include='*.svelte' 2>/dev/null | wc -l | tr -d ' ')
SVELTE_COMPONENT_FILES=$(grep -rn '<svelte:component' src/ --include='*.svelte' 2>/dev/null \
  | cut -d: -f1 | sort -u | head -20)

# Count onMount/onDestroy (still supported in v5 but worth tracking)
ON_MOUNT=$(grep -rn 'onMount' src/ --include='*.svelte' --include='*.ts' 2>/dev/null | wc -l | tr -d ' ')
ON_DESTROY=$(grep -rn 'onDestroy' src/ --include='*.svelte' --include='*.ts' 2>/dev/null | wc -l | tr -d ' ')

# Count store subscriptions with $ prefix (still works in v5 but runes preferred)
STORE_SUBS=$(grep -rnP '\$\w+' src/ --include='*.svelte' 2>/dev/null \
  | grep -v '^\s*//' | grep -v '\$:' | grep -v '\$\$' \
  | grep -v 'node_modules' | wc -l | tr -d ' ')

# Load previous report's metrics for delta comparison
PREV_ISSUE=$(gh issue list --label "health-report" --state all --limit 1 --json body --jq '.[0].body // empty' 2>/dev/null || true)
PREV_REACTIVE=""
PREV_DISPATCH=""
PREV_SLOTS=""
if [[ -n "$PREV_ISSUE" ]]; then
  # Extract previous values (the count column) from the report table
  PREV_REACTIVE=$(echo "$PREV_ISSUE" | grep -oP 'reactive declarations\s*\|\s*\K\d+' || true)
  PREV_DISPATCH=$(echo "$PREV_ISSUE" | grep -oP 'createEventDispatcher\s*\|\s*\K\d+' || true)
  PREV_SLOTS=$(echo "$PREV_ISSUE" | grep -oP 'slot usage\s*\|\s*\K\d+' || true)
fi

cat > "$OUTPUT_FILE" << JSONEOF
{
  "reactive_declarations": $REACTIVE_DECLS,
  "reactive_files": $(echo "$REACTIVE_FILES" | jq -Rs 'split("\n") | map(select(. != ""))'),
  "create_event_dispatcher": $EVENT_DISPATCH,
  "event_dispatch_files": $(echo "$EVENT_DISPATCH_FILES" | jq -Rs 'split("\n") | map(select(. != ""))'),
  "slot_usage": $SLOT_USAGE,
  "slot_files": $(echo "$SLOT_FILES" | jq -Rs 'split("\n") | map(select(. != ""))'),
  "before_update": $BEFORE_UPDATE,
  "after_update": $AFTER_UPDATE,
  "lifecycle_files": $(echo "$LIFECYCLE_FILES" | jq -Rs 'split("\n") | map(select(. != ""))'),
  "dollar_props": $DOLLAR_PROPS,
  "dollar_props_files": $(echo "$DOLLAR_PROPS_FILES" | jq -Rs 'split("\n") | map(select(. != ""))'),
  "svelte_component": $SVELTE_COMPONENT,
  "svelte_component_files": $(echo "$SVELTE_COMPONENT_FILES" | jq -Rs 'split("\n") | map(select(. != ""))'),
  "on_mount": $ON_MOUNT,
  "on_destroy": $ON_DESTROY,
  "store_subscriptions_approx": $STORE_SUBS,
  "previous": {
    "reactive_declarations": ${PREV_REACTIVE:-"null"},
    "create_event_dispatcher": ${PREV_DISPATCH:-"null"},
    "slot_usage": ${PREV_SLOTS:-"null"}
  }
}
JSONEOF

TOTAL_MIGRATION_ITEMS=$((REACTIVE_DECLS + EVENT_DISPATCH + SLOT_USAGE + BEFORE_UPDATE + AFTER_UPDATE + DOLLAR_PROPS + SVELTE_COMPONENT))
echo "Svelte v5 scan complete: $OUTPUT_FILE ($TOTAL_MIGRATION_ITEMS total items to migrate)"

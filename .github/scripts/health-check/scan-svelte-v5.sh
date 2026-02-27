#!/usr/bin/env bash
# scan-svelte-v5.sh — Tracks Svelte v5 migration readiness by counting v4 patterns
# that will need updating when the project eventually migrates.
set -euo pipefail

OUTPUT_DIR="${1:-.}"
OUTPUT_FILE="$OUTPUT_DIR/svelte-v5.json"

# shellcheck source=common.sh
source "$(dirname "$0")/common.sh"

# Count reactive declarations ($:)
REACTIVE_DECLS=$(grep -rn '^\s*\$:' src/ --include='*.svelte' 2>/dev/null | count_lines)
REACTIVE_FILES=$(grep -rn '^\s*\$:' src/ --include='*.svelte' 2>/dev/null \
  | cut -d: -f1 | sort -u | head -20)

# Count createEventDispatcher usage
EVENT_DISPATCH=$(grep -rn 'createEventDispatcher' src/ --include='*.svelte' --include='*.ts' 2>/dev/null | count_lines)
EVENT_DISPATCH_FILES=$(grep -rn 'createEventDispatcher' src/ --include='*.svelte' --include='*.ts' 2>/dev/null \
  | cut -d: -f1 | sort -u | head -20)

# Count <slot> usage (will become {@render} / snippets)
SLOT_USAGE=$(grep -rn '<slot' src/ --include='*.svelte' 2>/dev/null | count_lines)
SLOT_FILES=$(grep -rn '<slot' src/ --include='*.svelte' 2>/dev/null \
  | cut -d: -f1 | sort -u | head -20)

# Count beforeUpdate/afterUpdate lifecycle hooks
BEFORE_UPDATE=$(grep -rn 'beforeUpdate' src/ --include='*.svelte' --include='*.ts' 2>/dev/null | count_lines)
AFTER_UPDATE=$(grep -rn 'afterUpdate' src/ --include='*.svelte' --include='*.ts' 2>/dev/null | count_lines)
LIFECYCLE_FILES=$(grep -rn 'beforeUpdate\|afterUpdate' src/ --include='*.svelte' --include='*.ts' 2>/dev/null \
  | cut -d: -f1 | sort -u | head -20)

# Count $$props / $$restProps usage
DOLLAR_PROPS=$(grep -rn '\$\$props\|\$\$restProps' src/ --include='*.svelte' 2>/dev/null | count_lines)
DOLLAR_PROPS_FILES=$(grep -rn '\$\$props\|\$\$restProps' src/ --include='*.svelte' 2>/dev/null \
  | cut -d: -f1 | sort -u | head -20)

# Count <svelte:component> usage (simplified in v5)
SVELTE_COMPONENT=$(grep -rn '<svelte:component' src/ --include='*.svelte' 2>/dev/null | count_lines)
SVELTE_COMPONENT_FILES=$(grep -rn '<svelte:component' src/ --include='*.svelte' 2>/dev/null \
  | cut -d: -f1 | sort -u | head -20)

# Count onMount/onDestroy (still supported in v5 but worth tracking)
ON_MOUNT=$(grep -rn 'onMount' src/ --include='*.svelte' --include='*.ts' 2>/dev/null | count_lines)
ON_DESTROY=$(grep -rn 'onDestroy' src/ --include='*.svelte' --include='*.ts' 2>/dev/null | count_lines)

# Count store subscriptions with $ prefix (still works in v5 but runes preferred)
STORE_SUBS=$(grep -rnP '\$\w+' src/ --include='*.svelte' 2>/dev/null \
  | grep -v '^\s*//' | grep -v '\$:' | grep -v '\$\$' \
  | grep -v 'node_modules' | count_lines)

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

json_array_from_lines() {
  printf '%s' "$1" | jq -Rs 'split("\n") | map(select(. != ""))'
}

jq -n \
  --argjson reactive_declarations "$REACTIVE_DECLS" \
  --argjson reactive_files "$(json_array_from_lines "$REACTIVE_FILES")" \
  --argjson create_event_dispatcher "$EVENT_DISPATCH" \
  --argjson event_dispatch_files "$(json_array_from_lines "$EVENT_DISPATCH_FILES")" \
  --argjson slot_usage "$SLOT_USAGE" \
  --argjson slot_files "$(json_array_from_lines "$SLOT_FILES")" \
  --argjson before_update "$BEFORE_UPDATE" \
  --argjson after_update "$AFTER_UPDATE" \
  --argjson lifecycle_files "$(json_array_from_lines "$LIFECYCLE_FILES")" \
  --argjson dollar_props "$DOLLAR_PROPS" \
  --argjson dollar_props_files "$(json_array_from_lines "$DOLLAR_PROPS_FILES")" \
  --argjson svelte_component "$SVELTE_COMPONENT" \
  --argjson svelte_component_files "$(json_array_from_lines "$SVELTE_COMPONENT_FILES")" \
  --argjson on_mount "$ON_MOUNT" \
  --argjson on_destroy "$ON_DESTROY" \
  --argjson store_subscriptions_approx "$STORE_SUBS" \
  --argjson prev_reactive "${PREV_REACTIVE:-null}" \
  --argjson prev_dispatch "${PREV_DISPATCH:-null}" \
  --argjson prev_slots "${PREV_SLOTS:-null}" \
  '{
    reactive_declarations: $reactive_declarations,
    reactive_files: $reactive_files,
    create_event_dispatcher: $create_event_dispatcher,
    event_dispatch_files: $event_dispatch_files,
    slot_usage: $slot_usage,
    slot_files: $slot_files,
    before_update: $before_update,
    after_update: $after_update,
    lifecycle_files: $lifecycle_files,
    dollar_props: $dollar_props,
    dollar_props_files: $dollar_props_files,
    svelte_component: $svelte_component,
    svelte_component_files: $svelte_component_files,
    on_mount: $on_mount,
    on_destroy: $on_destroy,
    store_subscriptions_approx: $store_subscriptions_approx,
    previous: {
      reactive_declarations: $prev_reactive,
      create_event_dispatcher: $prev_dispatch,
      slot_usage: $prev_slots
    }
  }' > "$OUTPUT_FILE"

TOTAL_MIGRATION_ITEMS=$((REACTIVE_DECLS + EVENT_DISPATCH + SLOT_USAGE + BEFORE_UPDATE + AFTER_UPDATE + DOLLAR_PROPS + SVELTE_COMPONENT))
echo "Svelte v5 scan complete: $OUTPUT_FILE ($TOTAL_MIGRATION_ITEMS total items to migrate)"

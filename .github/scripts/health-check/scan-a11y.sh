#!/usr/bin/env bash
# scan-a11y.sh — Scans for common accessibility issues in Svelte components.
set -euo pipefail

OUTPUT_DIR="${1:-.}"
OUTPUT_FILE="$OUTPUT_DIR/a11y.json"

FINDINGS="[]"

# shellcheck source=common.sh
source "$(dirname "$0")/common.sh"

# 1. Images without alt attribute
NO_ALT=$(grep -rn '<img' src/ --include='*.svelte' 2>/dev/null \
  | grep -v 'alt=' || true)
if [[ -n "$NO_ALT" ]]; then
  COUNT=$(echo "$NO_ALT" | wc -l | tr -d ' ')
  add_finding "high" "Images missing alt attribute ($COUNT)" \
    "All <img> elements should have an alt attribute for screen readers." \
    "$(echo "$NO_ALT" | head -10)"
fi

# 2. Click handlers on non-interactive elements (div, span) without role/tabindex
CLICK_ON_DIV=$(grep -rnP '<(div|span)[^>]*on:click' src/ --include='*.svelte' 2>/dev/null || true)
if [[ -n "$CLICK_ON_DIV" ]]; then
  # Filter out ones that already have role= or tabindex=
  NO_ROLE=$(echo "$CLICK_ON_DIV" | grep -v 'role=' | grep -v 'tabindex=' || true)
  if [[ -n "$NO_ROLE" ]]; then
    COUNT=$(echo "$NO_ROLE" | wc -l | tr -d ' ')
    add_finding "medium" "Click handlers on non-interactive elements without role ($COUNT)" \
      "div/span elements with on:click should have role=\"button\" and tabindex=\"0\" for keyboard accessibility." \
      "$(echo "$NO_ROLE" | head -10)"
  fi
fi

# 3. Missing aria-label on icon-only buttons
ICON_BUTTONS=$(grep -rnP '<button[^>]*>\s*<(svg|img|Icon|iconify)' src/ --include='*.svelte' 2>/dev/null || true)
if [[ -n "$ICON_BUTTONS" ]]; then
  NO_LABEL=$(echo "$ICON_BUTTONS" | grep -v 'aria-label' | grep -v 'aria-labelledby' || true)
  if [[ -n "$NO_LABEL" ]]; then
    COUNT=$(echo "$NO_LABEL" | wc -l | tr -d ' ')
    add_finding "medium" "Icon-only buttons missing aria-label ($COUNT)" \
      "Buttons containing only icons need aria-label for screen reader users." \
      "$(echo "$NO_LABEL" | head -10)"
  fi
fi

# 4. Form inputs without associated labels
# Use simple grep + exclusion pipeline instead of fragile PCRE lookaheads
INPUTS_NO_LABEL=$(grep -rn '<input' src/ --include='*.svelte' 2>/dev/null \
  | grep -v 'aria-label' \
  | grep -v 'aria-labelledby' \
  | grep -v 'id=' \
  | grep -v 'type="hidden"' || true)
if [[ -n "$INPUTS_NO_LABEL" ]]; then
  COUNT=$(echo "$INPUTS_NO_LABEL" | wc -l | tr -d ' ')
  add_finding "low" "Form inputs potentially missing labels ($COUNT)" \
    "Input elements should have associated labels via aria-label, aria-labelledby, or id with a <label> element. Manual verification recommended." \
    "$(echo "$INPUTS_NO_LABEL" | head -10)"
fi

# 5. Missing lang attribute check
LANG_ATTR=$(grep -rn 'lang=' src/app.html 2>/dev/null || true)
if [[ -z "$LANG_ATTR" ]]; then
  add_finding "high" "Missing lang attribute on <html>" \
    "The <html> element in app.html should have a lang attribute for accessibility." \
    "src/app.html"
fi

# 6. Autofocus usage (can be disorienting for screen reader users)
AUTOFOCUS=$(grep -rn 'autofocus' src/ --include='*.svelte' 2>/dev/null || true)
if [[ -n "$AUTOFOCUS" ]]; then
  COUNT=$(echo "$AUTOFOCUS" | wc -l | tr -d ' ')
  add_finding "low" "autofocus attribute usage ($COUNT)" \
    "autofocus can be disorienting for screen reader users. Consider if it's necessary." \
    "$(echo "$AUTOFOCUS" | head -5)"
fi

# 7. Links without discernible text
EMPTY_LINKS=$(grep -rnP '<a[^>]*>\s*<(img|svg|Icon)' src/ --include='*.svelte' 2>/dev/null || true)
if [[ -n "$EMPTY_LINKS" ]]; then
  NO_TEXT=$(echo "$EMPTY_LINKS" | grep -v 'aria-label' | grep -v 'title=' || true)
  if [[ -n "$NO_TEXT" ]]; then
    COUNT=$(echo "$NO_TEXT" | wc -l | tr -d ' ')
    add_finding "medium" "Links with non-text content missing aria-label ($COUNT)" \
      "Links containing only images/icons need aria-label or title for screen readers." \
      "$(echo "$NO_TEXT" | head -10)"
  fi
fi

echo "$FINDINGS" | jq '.' > "$OUTPUT_FILE"
echo "Accessibility scan complete: $OUTPUT_FILE ($(echo "$FINDINGS" | jq length) findings)"

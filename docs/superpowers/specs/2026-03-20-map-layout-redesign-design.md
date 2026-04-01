# Map Layout Redesign — Collapse Toggle + Compact Merchant Details

## Problem

When both the merchant list sidebar (320px) and the merchant detail drawer (400px) are open simultaneously, they consume ~720px of horizontal space. On a typical 1366px laptop screen, this hides over half the map. Users have no way to maximize the map without closing panels individually.

## Solution

Following the Google Maps pattern:
1. **Add a ◀/▶ collapse toggle** at the panel-map boundary to hide/show all panels at once
2. **Compact the merchant detail drawer** with circular action buttons, info rows, and collapsed comments

The dual-panel layout (list + drawer side-by-side) is preserved at all desktop sizes. No single-panel responsive behavior.

## Architecture

### Panel States

Two states managed by a simple boolean store:

1. **Expanded (default)** — List (320px) + Drawer (400px) visible, ◀ toggle at right edge
2. **Collapsed** — All panels hidden, ▶ toggle at left edge of viewport, map gets 100% width

### Collapse Toggle Button

A button positioned at the right edge of the combined panel area, vertically centered on the viewport.

```
Position: absolute, at the right edge of the drawer (or list if drawer is closed)
Style: ~24×48px, white bg, right-side border-radius (0 8px 8px 0), subtle box-shadow
Icon: ◀ when expanded, ▶ when collapsed
Behavior: Toggles panelCollapsed store, map calls invalidateSize()
```

The toggle is present whenever the list panel or drawer is open (desktop only, ≥768px).

### Component Changes

#### New: `PanelCollapseToggle.svelte`
Small toggle button component. Reads/writes `panelCollapsed` store. Positioned absolutely at the right edge of whatever panel is rightmost (drawer if open, list if only list is open).

#### Modified: `MerchantDrawerDesktop.svelte`
- When `panelCollapsed` is true, drawer is hidden (not rendered or rendered with `display: none`)
- No structural changes to drawer positioning or content flow

#### Modified: `MerchantListPanel.svelte`
- When `panelCollapsed` is true, panel is hidden
- No structural changes to panel content

#### Modified: `MerchantDetailsContent.svelte`
Main visual redesign:

**Action buttons:** Replace 2×2 grid with horizontal row of circular icon buttons:
```
Current:  ┌─────────┬─────────┐
          │ Navigate │  Edit   │
          ├─────────┼─────────┤
          │  Share   │Comments │
          └─────────┴─────────┘

Proposed: ○ Navigate  ○ Edit  ○ Share  ○ Verify
          (30px circles with icon, label below)
```
- Primary action (Navigate) gets branded orange fill (#F7931A)
- Others get neutral outline style (light gray border)
- "Verify" replaces "Comments" — opens the verify-location flow (same as current "Controleer locatie" link)
- The existing inline verification section (verified date, up-to-date status) moves into the compact info rows

**Info rows:** Replace section-based layout with compact icon + text rows:
```
⚡ Lightning
🕐 Ma-Do 09:00-22:00 · Vr-Za 09:00-00:00
✅ Verified · 23 Nov 2025
🚀 Boost: 15 days · Extend
💬 4 comments ›
```
Each row is a single line with icon prefix, separated by light borders (`border-bottom: 1px solid`).

The Boost action button ("Extend" / "Verlengen") becomes an inline link within the boost info row. The comments-fetching logic (API call, loading/error states, abort controller) currently in `MerchantDetailsContent.svelte` can be removed entirely — clicking "4 comments ›" navigates to the full merchant profile page.

**Comments:** Collapsed to a single clickable link. Clicking navigates to the full merchant profile page (same as existing "Bekijk volledig profiel →" link).

#### New store: Panel collapse state
Add `panelCollapsed` writable to `merchantListStore.ts` or a new `panelCollapseStore.ts`:
```typescript
export const panelCollapsed = writable(false);
```
Collapse state resets on each page load (not persisted to localStorage).

#### Modified: `+page.svelte` (map page)
- `getPanelOffset()` returns 0 when `panelCollapsed` is true
- Render `PanelCollapseToggle` component
- Call `map.invalidateSize()` after collapse/expand transition

## Key Files to Modify

| File | Change |
|------|--------|
| `src/routes/map/+page.svelte` | Update `getPanelOffset()`, render collapse toggle, `invalidateSize()` on toggle |
| `src/routes/map/components/MerchantDrawerDesktop.svelte` | Hide when `panelCollapsed` is true |
| `src/routes/map/components/MerchantListPanel.svelte` | Hide when `panelCollapsed` is true |
| `src/components/MerchantDetailsContent.svelte` | Circular action buttons, compact info rows, collapsed comments, remove comments fetch logic |
| `src/lib/merchantListStore.ts` (or new store file) | Add `panelCollapsed` writable |
| New: `src/routes/map/components/PanelCollapseToggle.svelte` | Toggle button component |

## Transition Behavior

- **Panel collapse:** Panels slide left with ~200ms CSS transition. Map adjusts via `invalidateSize()`.
- **Panel expand:** Panels slide right, restoring previous state (list open, drawer open/closed as before).
- **Clicking a map marker while collapsed:** Panels expand and drawer opens with the selected merchant.

## Preserved Behaviors

- Dual panel layout (list + drawer side-by-side): **preserved at all sizes**
- Panel widths (320px list, 400px drawer): **unchanged**
- Mobile bottom sheet drawer: **no changes**
- URL hash deep linking: **preserved**
- Keyboard navigation (Escape to close): **preserved**
- Hover highlighting on list items: **preserved**
- Search/filter/category state: **preserved**
- Dark mode: **preserved** (toggle button needs dark mode styling)

## Deferred (Separate PR)

- **i18n bug:** "Boost verloopt in 15 days" mixes Dutch/English; opening hours show English day abbreviations instead of localized ones

## Verification

1. Open map → list panel visible, drawer opens when clicking a merchant
2. Click ◀ toggle → both panels slide left and hide, map fills viewport
3. Click ▶ toggle → panels slide back, previous state restored
4. Click a map marker while collapsed → panels expand, drawer shows merchant
5. Close drawer (X button) → only list panel visible, toggle repositions to list edge
6. Mobile → bottom sheet unchanged, no toggle button visible
7. Deep link URL with merchant hash → drawer opens correctly
8. Dark mode → toggle button styled correctly
9. Map `invalidateSize()` called after toggle animation completes

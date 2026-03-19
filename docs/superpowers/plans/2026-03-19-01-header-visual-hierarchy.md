# Header Visual Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a category icon with colored background to the merchant name header, increase name font size, and add an open/closed status badge.

**Architecture:** Reuse the existing `categoryMapping.ts` color system (already used in `MerchantListItem.svelte`) to render a 48px tinted category icon next to the merchant name. Parse `opening_hours` with the `opening_hours` npm package (standard OSM opening hours parser) to determine open/closed status and display a badge. All changes are in `MerchantDetailsContent.svelte`.

**Tech Stack:** Svelte 4, Tailwind v4, existing `Icon` component, `categoryMapping.ts`, `opening_hours` OSM format

---

### Task 1: Add Category Icon to Drawer Header

**Files:**
- Modify: `src/components/MerchantDetailsContent.svelte:83-111` (header section)
- Reference: `src/routes/map/components/MerchantListItem.svelte:80-87` (existing icon pattern)
- Reference: `src/lib/categoryMapping.ts` (color classes)

- [ ] **Step 1: Add imports for category mapping**

In `MerchantDetailsContent.svelte`, add imports at the top of the `<script>` block:

```typescript
import { CATEGORY_COLOR_CLASSES, getIconColorWithFallback } from '$lib/categoryMapping';
```

- [ ] **Step 2: Replace the name/address markup with icon+text layout**

Replace the current header block (lines ~83-124) with a flex layout that includes the category icon on the left and name/address on the right. The icon should use the same pattern as `MerchantListItem.svelte`:

```svelte
<div class="flex items-start gap-3">
	<!-- Category icon -->
	<div
		class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl {CATEGORY_COLOR_CLASSES[
			getIconColorWithFallback(merchant.icon)
		] || 'bg-primary/10 text-primary dark:bg-white/10 dark:text-white'}"
	>
		<Icon w="26" h="26" icon={merchant.icon || 'currency_bitcoin'} type="material" />
	</div>

	<div class="min-w-0 flex-1">
		{#if displayName}
			<a
				href={resolve(`/merchant/${merchant.id}`)}
				class="inline-block text-[22px] leading-snug font-semibold text-link transition-colors hover:text-hover"
				title={$_('merchant.merchantName')}
			>
				{displayName}
			</a>
		{:else if isLoading}
			<div class="h-7 w-3/4 animate-pulse rounded-lg bg-link/50"></div>
		{/if}

		{#if merchant.address}
			<p class="mt-0.5 text-sm text-body dark:text-white" title={$_('merchant.address')}>
				{merchant.address}
			</p>
		{:else if isLoading}
			<div class="mt-1 h-5 w-1/2 animate-pulse rounded bg-link/50"></div>
		{/if}
	</div>
</div>
```

Key changes from current code:
- Name size increased from `text-xl` to `text-[22px] font-semibold` (was `font-bold`)
- Added 48px (`h-12 w-12`) category icon box with `rounded-xl` and color from `getIconColorWithFallback`
- Address moved into the same flex container, below the name
- Icon size `26px` (slightly larger than list item's 22px to match the bigger box)

- [ ] **Step 3: Run format and type check**

```bash
yarn run format:fix && yarn run check
```

- [ ] **Step 4: Visually verify in browser**

Open the map, click a merchant, and verify:
- Category icon appears to the left of the name with the correct color tint
- Name is larger and semibold
- Address appears below the name
- Loading skeletons still work correctly
- Dark mode works correctly

- [ ] **Step 5: Commit**

```bash
git add src/components/MerchantDetailsContent.svelte
git commit -m "feat(drawer): add category icon and larger name to header"
```

---

### Task 2: Add Open/Closed Status Badge

**Files:**
- Create: `src/lib/openingHoursStatus.ts`
- Create: `src/lib/openingHoursStatus.test.ts`
- Modify: `src/components/MerchantDetailsContent.svelte`
- Modify: `src/lib/i18n/locales/en.json` (add new keys)

**Note:** Parsing OSM `opening_hours` is non-trivial (the format supports complex rules like `Mo-Fr 08:00-17:00; Sa 09:00-14:00; PH off`). Use the `opening_hours` npm package which is the standard parser for this format.

- [ ] **Step 1: Install the opening_hours parser**

```bash
yarn add opening_hours
```

If the package is too heavy or has issues, fall back to a simplified approach that only displays the raw `opening_hours` string without open/closed determination. In that case, skip steps 2-4 and just show the hours text inline.

- [ ] **Step 2: Write the failing test for openingHoursStatus**

Create `src/lib/openingHoursStatus.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { getOpenStatus } from './openingHoursStatus';

describe('getOpenStatus', () => {
	it('returns null for undefined input', () => {
		expect(getOpenStatus(undefined)).toBeNull();
	});

	it('returns null for empty string', () => {
		expect(getOpenStatus('')).toBeNull();
	});

	it('returns open status for 24/7', () => {
		const result = getOpenStatus('24/7');
		expect(result).not.toBeNull();
		expect(result!.isOpen).toBe(true);
	});

	it('returns null for unparseable hours', () => {
		expect(getOpenStatus('garbage text')).toBeNull();
	});
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
yarn run test --run src/lib/openingHoursStatus.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Write the implementation**

Create `src/lib/openingHoursStatus.ts`:

```typescript
type OpenStatus = {
	isOpen: boolean;
	nextChange: string | null; // e.g., "Closes 11 PM" or "Opens 9 AM"
};

export function getOpenStatus(hoursString: string | undefined): OpenStatus | null {
	if (!hoursString) return null;

	try {
		// Dynamic import to keep bundle small if opening_hours is heavy
		const OpeningHours = (await import('opening_hours')).default;
		const oh = new OpeningHours(hoursString);
		const isOpen = oh.getState();
		const nextChange = oh.getNextChange();

		let nextChangeText: string | null = null;
		if (nextChange) {
			const hours = nextChange.getHours();
			const minutes = nextChange.getMinutes();
			const ampm = hours >= 12 ? 'PM' : 'AM';
			const displayHours = hours % 12 || 12;
			nextChangeText = isOpen
				? `Closes ${displayHours}${minutes ? `:${minutes.toString().padStart(2, '0')}` : ''} ${ampm}`
				: `Opens ${displayHours}${minutes ? `:${minutes.toString().padStart(2, '0')}` : ''} ${ampm}`;
		}

		return { isOpen, nextChange: nextChangeText };
	} catch {
		return null;
	}
}
```

**Important:** If the `opening_hours` npm package doesn't work well in the browser or is too large, use a synchronous version or simplify to just showing the raw hours without open/closed status. The badge can still be added later.

- [ ] **Step 5: Run test to verify it passes**

```bash
yarn run test --run src/lib/openingHoursStatus.test.ts
```

- [ ] **Step 6: Add i18n keys**

Add to `src/lib/i18n/locales/en.json` under a new `"openStatus"` section:

```json
"openStatus": {
	"open": "Open now",
	"closed": "Closed"
}
```

- [ ] **Step 7: Add the badge to the drawer header**

In `MerchantDetailsContent.svelte`, below the address (inside the header flex container), add:

```svelte
{#if openStatus}
	<span
		class="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {openStatus.isOpen
			? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
			: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}"
	>
		{openStatus.isOpen ? $_('openStatus.open') : $_('openStatus.closed')}
		{#if openStatus.nextChange}
			<span class="ml-1">· {openStatus.nextChange}</span>
		{/if}
	</span>
{/if}
```

Add the reactive variable in the script:

```typescript
import { getOpenStatus } from '$lib/openingHoursStatus';

$: openStatus = getOpenStatus(merchant.opening_hours);
```

**Fallback:** If the `opening_hours` parser proves too complex, skip the open/closed badge for now and just ensure the hours are displayed in Task 1 of Plan 6 (Quick Access to Key Info). The badge can be revisited.

- [ ] **Step 8: Run format, type check, and lint**

```bash
yarn run format:fix && yarn run check && yarn run lint
```

- [ ] **Step 9: Commit**

```bash
git add src/lib/openingHoursStatus.ts src/lib/openingHoursStatus.test.ts src/components/MerchantDetailsContent.svelte src/lib/i18n/locales/en.json
git commit -m "feat(drawer): add open/closed status badge to header"
```

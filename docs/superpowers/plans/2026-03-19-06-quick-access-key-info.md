# Quick Access to Key Info Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display opening hours, phone number, and website directly in the drawer so users don't need to click "View Full Details" for basic information.

**Architecture:** Add a compact contact/info section between the header and action buttons in `MerchantDetailsContent.svelte`. Use the data already available from the `COMPLETE_PLACE` field set (`opening_hours`, `phone`, `website`, `osm:contact:phone`, `osm:contact:website`). Reuse `sanitizeUrl` from `$lib/utils` for website links.

**Tech Stack:** Svelte 4, Tailwind v4, existing `Icon` component, `sanitizeUrl` util

---

### Task 1: Add the Quick Info Section

**Files:**
- Modify: `src/components/MerchantDetailsContent.svelte`
- Reference: `src/lib/utils.ts` (sanitizeUrl)
- Reference: `src/routes/merchant/[id]/+page.svelte:394-540` (how full page shows these)

- [ ] **Step 1: Add computed properties for contact data**

In the `<script>` block of `MerchantDetailsContent.svelte`, add:

```typescript
import { sanitizeUrl } from '$lib/utils';

// Resolve phone: prefer direct field, fallback to osm:contact:phone
$: phone = merchant.phone || merchant['osm:contact:phone'];

// Resolve website: prefer direct field, fallback to osm:contact:website
$: websiteRaw = merchant.website || merchant['osm:contact:website'];
$: websiteUrl = sanitizeUrl(websiteRaw);
$: websiteDisplay = websiteRaw
	? websiteRaw.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
	: null;
```

The `websiteDisplay` strips the protocol and trailing slash for cleaner display (e.g., `barno7.cz` instead of `https://www.barno7.cz/`).

- [ ] **Step 2: Add the quick info section in the template**

After the header block (category icon + name + address + status badge) and before the action buttons, add:

```svelte
<!-- Quick contact info -->
{#if merchant.opening_hours || phone || websiteUrl}
	<div class="space-y-2">
		{#if merchant.opening_hours}
			<div class="flex items-start gap-2">
				<Icon
					w="16"
					h="16"
					class="mt-0.5 shrink-0 text-body dark:text-white/70"
					icon="schedule"
					type="material"
				/>
				<span class="text-sm text-body dark:text-white">
					{merchant.opening_hours}
				</span>
			</div>
		{/if}

		{#if phone}
			<div class="flex items-center gap-2">
				<Icon
					w="16"
					h="16"
					class="shrink-0 text-body dark:text-white/70"
					icon="phone"
					type="material"
				/>
				<a
					href="tel:{phone}"
					class="text-sm text-link transition-colors hover:text-hover"
				>
					{phone}
				</a>
			</div>
		{/if}

		{#if websiteUrl}
			<div class="flex items-center gap-2">
				<Icon
					w="16"
					h="16"
					class="shrink-0 text-body dark:text-white/70"
					icon="language"
					type="material"
				/>
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={websiteUrl}
					target="_blank"
					rel="noreferrer"
					class="truncate text-sm text-link transition-colors hover:text-hover"
				>
					{websiteDisplay}
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</div>
		{/if}
	</div>
{/if}
```

Design decisions:
- **Icons:** `schedule` for hours, `phone` for phone, `language` (globe) for website — matches the suggested layout
- **Phone** is a `tel:` link — tappable on mobile
- **Website** opens in new tab, shows clean domain only
- **Hours** shown as raw OSM string (matches current behavior in the existing opening_hours display). If Plan 1 adds the open/closed badge, the raw hours still provide the schedule details.
- Section only renders if at least one piece of info is available
- Uses `text-sm` for compact display

- [ ] **Step 3: Remove the old standalone opening_hours display**

The current standalone opening hours block (lines ~113-124) is now redundant since hours are part of the quick info section. Remove:

```svelte
{#if merchant.opening_hours}
	<div class="flex items-start space-x-2" title={$_('merchant.openingHours')}>
		<Icon
			w="16"
			h="16"
			class="mt-1 shrink-0 text-primary dark:text-white"
			icon="schedule"
			type="material"
		/>
		<span class="text-body dark:text-white">{merchant.opening_hours}</span>
	</div>
{/if}
```

- [ ] **Step 4: Run format, type check, and lint**

```bash
yarn run format:fix && yarn run check && yarn run lint
```

- [ ] **Step 5: Visually verify**

Test with merchants that have:
- Phone number → shows as tappable link
- Website → shows clean domain, opens in new tab
- Opening hours → shows schedule text
- All three → all displayed in order
- None → section hidden entirely
- Loading state → no quick info section shown (data not yet loaded)

- [ ] **Step 6: Commit**

```bash
git add src/components/MerchantDetailsContent.svelte
git commit -m "feat(drawer): add quick access to hours, phone, and website"
```

# Payment Method Pills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace cryptic payment method icons with labeled, colored pills that only show accepted methods. Change label from "Payment Methods" to "Accepts".

**Architecture:** Create a new `PaymentMethodPill.svelte` component for the drawer context. Keep the existing `PaymentMethodIcon.svelte` unchanged (used in list view and elsewhere). In the drawer, render only methods with `status === "yes"` as colored pills with icon + label. Update the section header i18n key.

**Tech Stack:** Svelte 4, Tailwind v4, existing SVG icons

---

### Task 1: Create the PaymentMethodPill Component

**Files:**
- Create: `src/components/PaymentMethodPill.svelte`

- [ ] **Step 1: Create the pill component**

Create `src/components/PaymentMethodPill.svelte`:

```svelte
<script lang="ts">
import { theme } from '$lib/theme';

export let method: 'btc' | 'ln' | 'nfc';
export let label: string;

const iconPaths = {
	btc: { light: '/icons/btc-highlight.svg', dark: '/icons/btc-highlight-dark.svg' },
	ln: { light: '/icons/ln-highlight.svg', dark: '/icons/ln-highlight-dark.svg' },
	nfc: { light: '/icons/nfc-highlight.svg', dark: '/icons/nfc-highlight-dark.svg' },
};

const pillColors = {
	btc: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
	ln: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
	nfc: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

$: iconSrc = $theme === 'dark' ? iconPaths[method].dark : iconPaths[method].light;
</script>

<span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium {pillColors[method]}">
	<img src={iconSrc} alt="" class="h-4 w-4" />
	{label}
</span>
```

- [ ] **Step 2: Run format and type check**

```bash
yarn run format:fix && yarn run check
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PaymentMethodPill.svelte
git commit -m "feat(drawer): create PaymentMethodPill component"
```

---

### Task 2: Replace Payment Icons with Pills in Drawer

**Files:**
- Modify: `src/components/MerchantDetailsContent.svelte:167-198` (payment methods section)
- Modify: `src/lib/i18n/locales/en.json` (add "accepts" key)

- [ ] **Step 1: Add i18n key for "Accepts"**

In `src/lib/i18n/locales/en.json`, add under the `"payment"` section:

```json
"accepts": "Accepts"
```

- [ ] **Step 2: Update the drawer payment methods section**

In `MerchantDetailsContent.svelte`, replace the current payment methods block (lines ~167-198) with pills that only show accepted methods:

Replace:
```svelte
{#if merchant['osm:payment:onchain'] || merchant['osm:payment:lightning'] || merchant['osm:payment:lightning_contactless'] || merchant['osm:payment:bitcoin']}
	<div class="mb-4">
		<span class="block text-xs text-mapLabel dark:text-white/70">{$_('payment.methods')}</span>
		<div class="mt-1 flex space-x-2">
			<PaymentMethodIcon
				status={merchant['osm:payment:onchain']}
				method="btc"
				label={$_('payment.onchain')}
			/>
			<PaymentMethodIcon
				status={merchant['osm:payment:lightning']}
				method="ln"
				label={$_('payment.lightning')}
			/>
			<PaymentMethodIcon
				status={merchant['osm:payment:lightning_contactless']}
				method="nfc"
				label={$_('payment.lightningContactless')}
			/>
		</div>
	</div>
```

With:
```svelte
{#if merchant['osm:payment:onchain'] === 'yes' || merchant['osm:payment:lightning'] === 'yes' || merchant['osm:payment:lightning_contactless'] === 'yes'}
	<div class="mb-4">
		<span class="block text-xs text-mapLabel dark:text-white/70">{$_('payment.accepts')}</span>
		<div class="mt-1 flex flex-wrap gap-2">
			{#if merchant['osm:payment:lightning'] === 'yes'}
				<PaymentMethodPill method="ln" label={$_('payment.lightning')} />
			{/if}
			{#if merchant['osm:payment:onchain'] === 'yes'}
				<PaymentMethodPill method="btc" label={$_('payment.onchain')} />
			{/if}
			{#if merchant['osm:payment:lightning_contactless'] === 'yes'}
				<PaymentMethodPill method="nfc" label={$_('payment.lightningContactless')} />
			{/if}
		</div>
	</div>
```

Note the order: Lightning first (most common), then On-chain, then NFC.

Add the import at the top:
```typescript
import PaymentMethodPill from '$components/PaymentMethodPill.svelte';
```

Remove the `PaymentMethodIcon` import if it's no longer used in this file (check first — opening hours section might still use it). If unused, remove it.

- [ ] **Step 3: Keep the loading skeleton but update it**

The loading skeleton should match pill shapes:

```svelte
{:else if isLoading}
	<div class="mb-4">
		<div class="h-3 w-16 animate-pulse rounded bg-link/50"></div>
		<div class="mt-1 flex gap-2">
			<div class="h-7 w-20 animate-pulse rounded-full bg-link/50"></div>
			<div class="h-7 w-20 animate-pulse rounded-full bg-link/50"></div>
		</div>
	</div>
{/if}
```

- [ ] **Step 4: Run format, type check, and lint**

```bash
yarn run format:fix && yarn run check && yarn run lint
```

- [ ] **Step 5: Visually verify in browser**

Open the map, click merchants with different payment methods:
- Only accepted methods shown (no crossed-out icons)
- Lightning shows as amber pill with lightning icon
- On-chain shows as orange pill with BTC icon
- NFC shows as blue pill with NFC icon
- Merchant with no payment data shows nothing (no section)
- Dark mode correct

- [ ] **Step 6: Commit**

```bash
git add src/components/MerchantDetailsContent.svelte src/lib/i18n/locales/en.json
git commit -m "feat(drawer): replace payment icons with labeled pills #849"
```

---

### Task 3: Move Payment Pills into the Header (Optional Enhancement)

**Files:**
- Modify: `src/components/MerchantDetailsContent.svelte`

This task moves the payment pills from the "Payment Methods" section up into the header area, directly below the address, matching the suggested layout. This is optional and can be deferred.

- [ ] **Step 1: Move pills below address in header**

In the header flex container (from Plan 1), after the address `<p>` tag, add the pills inline:

```svelte
{#if merchant['osm:payment:lightning'] === 'yes' || merchant['osm:payment:onchain'] === 'yes' || merchant['osm:payment:lightning_contactless'] === 'yes'}
	<div class="mt-1.5 flex flex-wrap gap-1.5">
		{#if merchant['osm:payment:lightning'] === 'yes'}
			<PaymentMethodPill method="ln" label={$_('payment.lightning')} />
		{/if}
		{#if merchant['osm:payment:onchain'] === 'yes'}
			<PaymentMethodPill method="btc" label={$_('payment.onchain')} />
		{/if}
		{#if merchant['osm:payment:lightning_contactless'] === 'yes'}
			<PaymentMethodPill method="nfc" label={$_('payment.lightningContactless')} />
		{/if}
	</div>
{/if}
```

Remove the duplicate section from the lower payment methods area.

- [ ] **Step 2: Run format, check, lint, and verify visually**

```bash
yarn run format:fix && yarn run check && yarn run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/components/MerchantDetailsContent.svelte
git commit -m "feat(drawer): move payment pills into header area"
```

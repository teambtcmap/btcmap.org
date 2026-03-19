# Boost Section Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe the boost section from purely functional to aspirational/promotional, with different treatments for boosted vs non-boosted merchants.

**Architecture:** Redesign the boost section within `MerchantDetailsContent.svelte` as a visually distinct card with warm styling. Non-boosted merchants get a promotional "Get more visibility" card. Boosted merchants get a celebratory card with expiration info. The full `BoostContent.svelte` (payment flow) remains untouched — only the preview/teaser in the drawer changes.

**Tech Stack:** Svelte 4, Tailwind v4, existing i18n system, `Icon` component

---

### Task 1: Add New i18n Keys

**Files:**
- Modify: `src/lib/i18n/locales/en.json`

- [ ] **Step 1: Add boost promotional copy**

Add the following keys under the `"boost"` section in `en.json`:

```json
"getVisibility": "Get more visibility",
"boostPromo": "Boost this listing to appear first in nearby searches",
"boostThisPlace": "Boost this place",
"extendBoost": "Extend Boost"
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/i18n/locales/en.json
git commit -m "i18n: add boost promotional copy keys"
```

---

### Task 2: Redesign the Boost Section in the Drawer

**Files:**
- Modify: `src/components/MerchantDetailsContent.svelte:244-271` (boost section)

- [ ] **Step 1: Replace the current boost section**

Replace the current boost markup (lines ~244-271):

```svelte
<div>
	{#if isBoosted && merchant.boosted_until}
		<span class="block text-xs text-mapLabel dark:text-white/70" ...>{$_('boost.expires')}</span>
		<span class="block text-body dark:text-white">
			<Time live={3000} relative={true} timestamp={merchant.boosted_until} />
		</span>
	{/if}

	<button ... on:click={onBoostClick} ...>
		...
	</button>
</div>
```

With the new promotional card:

```svelte
<div class="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-700/30 dark:bg-amber-900/10">
	{#if isBoosted && merchant.boosted_until}
		<!-- Boosted state -->
		<div class="flex items-start gap-3">
			<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
				<Icon w="20" h="20" icon="auto_awesome" type="material" class="text-amber-600 dark:text-amber-400" />
			</div>
			<div class="min-w-0 flex-1">
				<p class="text-sm font-semibold text-amber-800 dark:text-amber-300">
					{$_('boost.boosted')}
				</p>
				<p class="mt-0.5 text-xs text-amber-700 dark:text-amber-400/80">
					{$_('boost.expires')}:
					<Time live={3000} relative={true} timestamp={merchant.boosted_until} />
				</p>
			</div>
		</div>
		<button
			on:click={onBoostClick}
			disabled={boostLoading}
			class="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-600/40 dark:text-amber-300 dark:hover:bg-amber-900/30"
		>
			{#if boostLoading}
				{$_('boost.boosting')}
			{:else}
				<Icon w="16" h="16" icon="arrow_circle_up" type="material" />
				{$_('boost.extendBoost')}
			{/if}
		</button>
	{:else}
		<!-- Non-boosted state -->
		<div class="flex items-start gap-3">
			<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
				<Icon w="20" h="20" icon="rocket_launch" type="material" class="text-amber-600 dark:text-amber-400" />
			</div>
			<div class="min-w-0 flex-1">
				<p class="text-sm font-semibold text-amber-800 dark:text-amber-300">
					{$_('boost.getVisibility')}
				</p>
				<p class="mt-0.5 text-xs text-amber-700 dark:text-amber-400/80">
					{$_('boost.boostPromo')}
				</p>
			</div>
		</div>
		<button
			on:click={onBoostClick}
			disabled={boostLoading}
			class="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500"
		>
			{#if boostLoading}
				{$_('boost.boosting')}
			{:else}
				<Icon w="16" h="16" icon="rocket_launch" type="material" />
				{$_('boost.boostThisPlace')}
			{/if}
		</button>
	{/if}
</div>
```

Design decisions:
- **Warm amber palette** for both states (promotional feel)
- **Non-boosted:** Rocket icon, "Get more visibility" headline, "Boost this listing to appear first in nearby searches" subtext, filled amber CTA button
- **Boosted:** Sparkle icon (auto_awesome), "Boosted" headline, expiration as relative time, outlined amber "Extend Boost" button
- **Card treatment:** Rounded border with subtle background tint
- Metrics ("847 extra views") not implemented — API doesn't expose boost view counts currently. Can be added later if/when API supports it.

- [ ] **Step 2: Run format, type check, and lint**

```bash
yarn run format:fix && yarn run check && yarn run lint
```

- [ ] **Step 3: Visually verify both states**

Test with:
- A non-boosted merchant → should see promotional card with rocket icon
- A boosted merchant → should see celebratory card with sparkle icon and expiration
- Click "Boost this place" → boost flow should open
- Dark mode → amber tints should look warm, not washed out

- [ ] **Step 4: Commit**

```bash
git add src/components/MerchantDetailsContent.svelte
git commit -m "feat(drawer): redesign boost section with promotional styling"
```

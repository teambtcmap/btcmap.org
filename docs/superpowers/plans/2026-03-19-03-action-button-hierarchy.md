# Action Button Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prioritize Navigate and Share as primary actions; demote Edit and Comments to secondary text links.

**Architecture:** Replace the 2x2 equal-weight grid with a primary row (Navigate + Share as prominent buttons) and a secondary row (Edit + Comments as smaller text links). All changes in `MerchantDetailsContent.svelte`.

**Tech Stack:** Svelte 4, Tailwind v4, existing `Icon` component

---

### Task 1: Redesign the Action Buttons Layout

**Files:**
- Modify: `src/components/MerchantDetailsContent.svelte:126-165` (action buttons grid)

- [ ] **Step 1: Replace the 2x2 grid with primary/secondary layout**

Replace the current grid (lines ~126-165):

```svelte
<div class="grid grid-cols-2 gap-2">
	<!-- Navigate -->
	<a href="geo:{merchant.lat},{merchant.lon}" ...>
	<!-- Edit -->
	<a href={merchant.osm_url || ...} ...>
	<!-- Share -->
	<a href={resolve(`/merchant/${merchant.id}`)} ...>
	<!-- Comments -->
	<a href={resolve(`/merchant/${merchant.id}#comments`)} ...>
</div>
```

With the new layout:

```svelte
<!-- Primary actions -->
<div class="flex gap-2">
	<a
		href="geo:{merchant.lat},{merchant.lon}"
		class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-link py-3 text-sm font-medium text-white transition-colors hover:bg-hover"
	>
		<Icon w="20" h="20" icon="explore" type="material" />
		{$_('merchant.navigate')}
	</a>

	<a
		href={resolve(`/merchant/${merchant.id}`)}
		class="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 py-3 text-sm font-medium text-primary transition-colors hover:border-link hover:text-link dark:border-white/95 dark:text-white dark:hover:text-link"
	>
		<Icon w="20" h="20" icon="share" type="material" />
		{$_('merchant.share')}
	</a>
</div>

<!-- Secondary actions -->
<div class="flex items-center justify-center gap-4 text-xs">
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<!-- External link to OpenStreetMap -->
	<a
		href={merchant.osm_url || `https://www.openstreetmap.org/node/${merchant.id}`}
		target="_blank"
		rel="noreferrer"
		class="flex items-center gap-1 text-body transition-colors hover:text-link dark:text-white/70 dark:hover:text-link"
	>
		<Icon w="14" h="14" icon="edit" type="material" />
		{$_('merchant.edit')}
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->

	<span class="text-gray-300 dark:text-white/20">·</span>

	<a
		href={resolve(`/merchant/${merchant.id}#comments`)}
		class="flex items-center gap-1 text-body transition-colors hover:text-link dark:text-white/70 dark:hover:text-link"
	>
		<Icon w="14" h="14" icon="chat_bubble_outline" type="material" />
		{$_('merchant.comments')}
		{#if merchant.comments}
			<span class="rounded-full bg-link/10 px-1.5 py-0.5 text-[10px] font-medium text-link">{merchant.comments}</span>
		{/if}
	</a>
</div>
```

Key design decisions:
- **Navigate** gets `bg-link` (filled primary button) — it's the #1 user action
- **Share** gets outlined border — secondary but still prominent
- Both are `flex-1` for equal width
- **Edit** and **Comments** become small text links with icons, separated by a dot
- Comments count shown as a small badge only when > 0
- Changed comments icon from number display to `chat_bubble_outline` icon

- [ ] **Step 2: Run format, type check, and lint**

```bash
yarn run format:fix && yarn run check && yarn run lint
```

- [ ] **Step 3: Visually verify in browser**

Check:
- Navigate button is prominent with filled background
- Share button is outlined but clearly clickable
- Edit and Comments are small text links below
- Comments badge shows count when available
- Dark mode renders correctly
- Navigate geo: link works on mobile
- Edit opens OSM in new tab

- [ ] **Step 4: Commit**

```bash
git add src/components/MerchantDetailsContent.svelte
git commit -m "feat(drawer): prioritize Navigate/Share as primary action buttons"
```

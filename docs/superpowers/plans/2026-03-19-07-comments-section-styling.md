# Comments Section Styling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve comment styling with card treatment, avatar placeholder initials, relative timestamps, and an "Add comment" button.

**Architecture:** Modify the existing `MerchantComment.svelte` component (drawer version at `src/components/MerchantComment.svelte`) to add card styling, initials circle, and relative time in compact mode. Add an "Add comment" link to the comments section in `MerchantDetailsContent.svelte`. The `svelte-time` package already supports relative timestamps — just add the `relative` prop.

**Tech Stack:** Svelte 4, Tailwind v4, `svelte-time` (already installed), existing i18n

---

### Task 1: Update the MerchantComment Component (Compact Mode)

**Files:**
- Modify: `src/components/MerchantComment.svelte`

- [ ] **Step 1: Add card treatment and initials for compact mode**

Replace the current `MerchantComment.svelte` content:

```svelte
<script lang="ts">
import Time from 'svelte-time';

export let text: string;
export let time: string;
export let compact = false;
</script>

<div
	class:items-center={!compact}
	class:items-start={compact}
	class:space-y-2={!compact}
	class:space-y-1={compact}
	class:p-5={!compact}
	class:p-3={compact}
	class:text-center={!compact}
	class:text-left={compact}
	class:text-xl={!compact}
	class:text-base={compact}
	class:lg:flex={!compact}
	class:lg:space-y-0={!compact}
	class:lg:space-x-5={!compact}
	class:lg:text-left={!compact}
>
	...
</div>
```

With:

```svelte
<script lang="ts">
import Time from 'svelte-time';

export let text: string;
export let time: string;
export let compact = false;
</script>

{#if compact}
	<div class="flex items-start gap-2.5 rounded-lg bg-gray-50 p-3 dark:bg-white/5">
		<!-- Anonymous avatar -->
		<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-link/10 text-xs font-semibold text-link">
			<span>?</span>
		</div>

		<div class="min-w-0 flex-1">
			<p class="text-sm text-primary dark:text-white">{text}</p>
			<span class="mt-1 block text-xs text-body dark:text-white/50">
				<Time timestamp={time} relative live={60000} />
			</span>
		</div>
	</div>
{:else}
	<!-- Full page (non-compact) layout — unchanged -->
	<div
		class="items-center space-y-2 p-5 text-center text-xl lg:flex lg:space-y-0 lg:space-x-5 lg:text-left"
	>
		<div
			class="w-full flex-wrap items-center justify-between space-y-2 lg:flex lg:space-y-0"
		>
			<div class="space-y-2 lg:space-y-0">
				<span class="text-primary dark:text-white lg:mr-5">
					{text}
				</span>

				<span class="block text-center font-semibold text-taggerTime dark:text-white/70 lg:inline">
					<Time timestamp={time} />
				</span>
			</div>
		</div>
	</div>
{/if}
```

Design decisions:
- **Card treatment:** `rounded-lg bg-gray-50 dark:bg-white/5` — subtle background, not a heavy border
- **Avatar placeholder:** Since comments are anonymous, show `?` in a branded circle (`bg-link/10 text-link`)
- **Relative time:** `<Time relative live={60000} />` — shows "3 months ago" and updates every minute
- **Non-compact mode untouched** — the full merchant page uses non-compact and isn't part of this redesign
- Text size is `text-sm` for compact, matching the drawer's info density

- [ ] **Step 2: Run format and type check**

```bash
yarn run format:fix && yarn run check
```

- [ ] **Step 3: Commit**

```bash
git add src/components/MerchantComment.svelte
git commit -m "feat(drawer): add card treatment and relative time to comments"
```

---

### Task 2: Add "Add a Comment" Button to the Drawer

**Files:**
- Modify: `src/components/MerchantDetailsContent.svelte:281-303` (comments section)
- Modify: `src/lib/i18n/locales/en.json`

- [ ] **Step 1: Add i18n key**

In `src/lib/i18n/locales/en.json`, under `"merchant"` section, add:

```json
"addComment": "Add a comment"
```

- [ ] **Step 2: Add the comment button to the comments section**

After the `{#each comments}` block and before the closing `</div>` of the comments section, add an "Add a comment" link. This links to the full merchant page's comment form:

Update the comments section (lines ~281-303) to:

```svelte
<!-- Comments Section -->
{#if commentsLoading}
	<div class="space-y-2">
		<div class="h-4 w-24 animate-pulse rounded bg-link/50"></div>
		<div class="space-y-2">
			<div class="h-16 w-full animate-pulse rounded-lg bg-link/50"></div>
			<div class="h-16 w-full animate-pulse rounded-lg bg-link/50"></div>
		</div>
	</div>
{:else if commentsError}
	<div class="rounded-lg bg-red-100 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
		{$_('errors.loadFailed')}
	</div>
{:else if comments.length > 0}
	<div class="border-t border-gray-300 pt-4 dark:border-white/95">
		<span class="block text-xs text-mapLabel dark:text-white/70">{$_('merchant.comments')}</span>
		<div class="mt-2 space-y-2">
			{#each comments as comment (comment.id)}
				<MerchantComment text={comment.text} time={comment.created_at} compact={true} />
			{/each}
		</div>
		<a
			href={resolve(`/merchant/${merchant.id}#comments`)}
			class="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-2.5 text-xs text-body transition-colors hover:border-link hover:text-link dark:border-white/20 dark:text-white/60 dark:hover:border-link dark:hover:text-link"
		>
			<Icon w="14" h="14" icon="add_comment" type="material" />
			{$_('merchant.addComment')}
		</a>
	</div>
{/if}
```

Design decisions:
- **Dashed border button** — makes it feel inviting/empty-state-like, differentiates from primary actions
- Links to the full merchant page's comments section where the actual comment form exists
- Only shown when there are already comments (if no comments, no section shown — the secondary "Comments" link in the action area handles that case)
- Loading skeletons updated to match the taller card height (`h-16` instead of `h-12`)

- [ ] **Step 3: Run format, type check, and lint**

```bash
yarn run format:fix && yarn run check && yarn run lint
```

- [ ] **Step 4: Visually verify**

Test:
- Merchant with comments → cards shown with gray background, avatar placeholder, relative time
- "Add a comment" button visible below comments
- Clicking it navigates to the full merchant page comments section
- Merchant with no comments → no comments section (no "Add a comment" either)
- Loading state → skeleton placeholders
- Dark mode → gray card backgrounds are subtle, not too bright

- [ ] **Step 5: Commit**

```bash
git add src/components/MerchantDetailsContent.svelte src/lib/i18n/locales/en.json
git commit -m "feat(drawer): add comment button and improve comment styling"
```

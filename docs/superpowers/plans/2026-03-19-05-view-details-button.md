# View Full Details Button Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the visual weight of "View Full Details" from a large teal button to a subtle text link, since the drawer will now contain key info directly (hours, phone, website from Plan 6).

**Architecture:** Replace the block-level `bg-link` button with an inline text link styled as "See full profile →". Position it at the bottom of the drawer as a lightweight action.

**Tech Stack:** Svelte 4, Tailwind v4, existing i18n

---

### Task 1: Add i18n Key and Replace the Button

**Files:**
- Modify: `src/components/MerchantDetailsContent.svelte:274-279` (View Details button)
- Modify: `src/lib/i18n/locales/en.json`

- [ ] **Step 1: Add the new i18n key**

In `src/lib/i18n/locales/en.json`, under the `"merchant"` section, add:

```json
"seeFullProfile": "See full profile"
```

- [ ] **Step 2: Replace the button with a text link**

Replace the current block (lines ~274-279):

```svelte
<a
	href={resolve(`/merchant/${merchant.id}`)}
	class="block rounded-lg bg-link py-3 text-center text-white transition-colors hover:bg-hover"
>
	{$_('merchant.viewDetails')}
</a>
```

With:

```svelte
<div class="pt-2 text-center">
	<a
		href={resolve(`/merchant/${merchant.id}`)}
		class="inline-flex items-center gap-1 text-sm text-link transition-colors hover:text-hover"
	>
		{$_('merchant.seeFullProfile')}
		<Icon w="14" h="14" icon="arrow_forward" type="material" />
	</a>
</div>
```

Design decisions:
- Text link instead of filled button — less visual competition with Navigate/Share
- Arrow icon (`arrow_forward`) instead of literal "→" for consistency with Material icons
- Centered, `text-sm` — subtle but findable
- Placed after comments section (at the very bottom of the drawer content)

**Note:** The existing `$_('merchant.viewDetails')` key can remain in the i18n file for backward compatibility with other uses. Don't remove it.

- [ ] **Step 3: Move the link to the very end of the drawer**

Currently the "View Details" button sits between the verification/boost section and comments. Move it to after the comments section so it's the last element in the drawer. This means moving the `<div class="pt-2 text-center">` block to after the comments `{#if}` block (after line ~303).

The final order should be:
1. Header (name, address, icon, status)
2. Quick info (hours, phone, website — from Plan 6)
3. Primary actions (Navigate, Share)
4. Secondary actions (Edit, Comments link)
5. Payment methods / Verification
6. Boost section
7. Comments display
8. "See full profile →" link

- [ ] **Step 4: Run format, type check, and lint**

```bash
yarn run format:fix && yarn run check && yarn run lint
```

- [ ] **Step 5: Visually verify**

- The text link should be subtle but visible
- Clicking it navigates to `/merchant/{id}`
- No more large teal button competing with action buttons
- Dark mode correct

- [ ] **Step 6: Commit**

```bash
git add src/components/MerchantDetailsContent.svelte src/lib/i18n/locales/en.json
git commit -m "feat(drawer): replace View Details button with subtle text link"
```

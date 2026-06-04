<script lang="ts">
import { _ } from "$lib/i18n";

// Comments / Activity. On mobile only the active panel is shown behind a
// tab bar (fixes the cramped scroll-boxes). At lg+ the tab bar is hidden
// and both render as stacked, headed sections. Static details are pinned
// above this component, not in a tab.
type TabKey = "comments" | "activity";

export let commentsCount = 0;
export let activityCount = 0;

let tab: TabKey = "comments";

$: tabs = [
	{
		key: "comments" as TabKey,
		label: $_("merchant.comments"),
		count: commentsCount,
		// Keep the comments panel's id as `comments` so the existing
		// `/merchant/{id}#comments` deep-link (from the map drawer) still
		// resolves; the activity panel gets a dedicated id.
		panelId: "comments",
	},
	{
		key: "activity" as TabKey,
		label: $_("merchant.activityShort"),
		count: activityCount,
		panelId: "panel-activity",
	},
];

const headingClass =
	"mb-4 hidden text-lg font-semibold text-primary lg:block dark:text-white";

// Roving-tabindex keyboard nav for the ARIA tablist: arrow keys move
// between tabs (wrapping), Home/End jump to the ends. Only the selected
// tab is in the tab order; the rest are reachable via the arrows.
let tabButtons: HTMLButtonElement[] = [];
const onKeydown = (event: KeyboardEvent, index: number) => {
	const last = tabs.length - 1;
	let next = index;
	if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
	else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
	else if (event.key === "Home") next = 0;
	else if (event.key === "End") next = last;
	else return;
	event.preventDefault();
	tab = tabs[next].key;
	tabButtons[next]?.focus();
};
</script>

<div>
	<!-- tab bar — mobile only -->
	<div role="tablist" class="flex border-b border-gray-300 lg:hidden dark:border-white/20">
		{#each tabs as t, i (t.key)}
			<button
				bind:this={tabButtons[i]}
				type="button"
				role="tab"
				id="tab-{t.key}"
				aria-controls={t.panelId}
				aria-selected={tab === t.key}
				tabindex={tab === t.key ? 0 : -1}
				on:click={() => (tab = t.key)}
				on:keydown={(e) => onKeydown(e, i)}
				class="flex flex-1 items-center justify-center gap-1.5 border-b-2 py-3 text-sm font-semibold transition-colors {tab ===
				t.key
					? 'border-link text-primary dark:text-white'
					: 'border-transparent text-body dark:text-white/60'}"
			>
				{t.label}
				{#if t.count}
					<span
						class="rounded-full px-1.5 py-0.5 text-[10px] font-bold {tab === t.key
							? 'bg-link text-white'
							: 'bg-gray-200 text-body dark:bg-white/10 dark:text-white/60'}"
					>
						{t.count}
					</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Panels keep no tabindex of their own: each holds focusable content
	     (add-comment button, links, tip buttons), so per the ARIA tabs
	     pattern they should not add an extra tab stop. -->
	<div
		id="comments"
		role="tabpanel"
		aria-labelledby="tab-comments"
		class="pt-5 lg:block"
		class:hidden={tab !== 'comments'}
	>
		<h3 class={headingClass}>
			{$_('merchant.comments')}{#if commentsCount}&nbsp;({commentsCount}){/if}
		</h3>
		<slot name="comments" />
	</div>

	<div
		id="panel-activity"
		role="tabpanel"
		aria-labelledby="tab-activity"
		class="pt-5 lg:block"
		class:hidden={tab !== 'activity'}
	>
		<h3 class={headingClass}>{$_('merchant.activityShort')}</h3>
		<slot name="activity" />
	</div>
</div>

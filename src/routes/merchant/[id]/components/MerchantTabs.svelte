<script lang="ts">
import { _ } from "$lib/i18n";

// Comments / Activity / Details. On mobile only the active panel is shown
// behind a tab bar (fixes the cramped scroll-boxes). At lg+ the tab bar is
// hidden and all three render as stacked, headed sections.
type TabKey = "comments" | "activity" | "details";

export let commentsCount = 0;
export let activityCount = 0;

let tab: TabKey = "comments";

$: tabs = [
	{
		key: "comments" as TabKey,
		label: $_("merchant.comments"),
		count: commentsCount,
	},
	{
		key: "activity" as TabKey,
		label: $_("merchant.activityShort"),
		count: activityCount,
	},
	{ key: "details" as TabKey, label: $_("merchant.details"), count: 0 },
];

const headingClass =
	"mb-4 hidden text-lg font-semibold text-primary lg:block dark:text-white";
</script>

<div>
	<!-- tab bar — mobile only -->
	<div class="flex border-b border-gray-300 lg:hidden dark:border-white/20">
		{#each tabs as t (t.key)}
			<button
				type="button"
				on:click={() => (tab = t.key)}
				aria-pressed={tab === t.key}
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

	<section class="pt-5 lg:block" class:hidden={tab !== 'comments'}>
		<h3 class={headingClass}>
			{$_('merchant.comments')}{#if commentsCount}&nbsp;({commentsCount}){/if}
		</h3>
		<slot name="comments" />
	</section>

	<section class="pt-5 lg:block" class:hidden={tab !== 'activity'}>
		<h3 class={headingClass}>{$_('merchant.activityShort')}</h3>
		<slot name="activity" />
	</section>

	<section class="pt-5 lg:block" class:hidden={tab !== 'details'}>
		<h3 class={headingClass}>{$_('merchant.details')}</h3>
		<slot name="details" />
	</section>
</div>

<script lang="ts">
import { _ } from "svelte-i18n";

import ActivityCard from "$components/activity/ActivityCard.svelte";
import ActivityTypeFilter from "$components/activity/ActivityTypeFilter.svelte";
import Icon from "$components/Icon.svelte";
import TaggerSkeleton from "$components/TaggerSkeleton.svelte";
import {
	ACTIVITY_TYPES,
	type ActivityItem,
	type ActivityType,
	countByType,
} from "$lib/activity";
import { API_BASE } from "$lib/api-base";
import api from "$lib/axios";

export let alias: string;
export let name: string;
export let dataInitialized: boolean;

const DAYS_PER_PAGE = 30;

let feedItems: ActivityItem[] = [];
let activeTypes: Set<ActivityType> = new Set(ACTIVITY_TYPES);
let loading = false;
let error = false;
let feedDiv: HTMLDivElement;
let hideArrow = false;
let days = DAYS_PER_PAGE;
let fetchGeneration = 0;

$: typeCounts = countByType(feedItems);
$: visibleItems = feedItems.filter((i) => activeTypes.has(i.type));
// Hide the "(0)" chip suffix during the first fetch while typeCounts
// is uniformly zero — otherwise every chip reads "(0)" as if there
// were nothing to filter.
$: showChipCounts = !(loading && !feedItems.length);

const fetchFeed = async () => {
	loading = true;
	error = false;
	const gen = ++fetchGeneration;
	const hadItems = feedItems.length > 0;
	try {
		const url = `${API_BASE}/v4/activity?area=${encodeURIComponent(alias)}&days=${days}`;
		const res = await api.get<ActivityItem[]>(url);
		// Discard stale response if user navigated to a different area
		if (gen !== fetchGeneration) return;
		feedItems = res.data;
	} catch {
		if (gen !== fetchGeneration) return;
		// On initial fetch failure clear items so the empty error state shows;
		// on load-more failure keep existing items so the inline error renders.
		if (!hadItems) feedItems = [];
		error = true;
	}
	loading = false;
};

const loadMore = () => {
	const scrollTop = feedDiv?.scrollTop;
	const prevDays = days;
	days = days + DAYS_PER_PAGE;
	fetchFeed().then(() => {
		if (error) {
			days = prevDays;
			return;
		}
		// Restore scroll position after re-render
		if (feedDiv && scrollTop) {
			requestAnimationFrame(() => {
				feedDiv.scrollTop = scrollTop;
			});
		}
	});
};

// Fresh-slate whenever the user navigates between areas: reset the
// window size, drop buffered items, re-enable every activity type (so
// a previous area's toggle state doesn't silently hide cards on the
// new one), clear error/arrow indicators, and kick off the first fetch.
$: if (dataInitialized && alias) {
	days = DAYS_PER_PAGE;
	feedItems = [];
	activeTypes = new Set(ACTIVITY_TYPES);
	error = false;
	hideArrow = false;
	fetchFeed();
}
</script>

<section id="feed">
	<div class="w-full rounded-3xl border border-gray-300 dark:border-white/95 dark:bg-white/10">
		<h3
			class="border-b border-gray-300 p-5 text-center text-lg font-semibold text-primary md:text-left dark:border-white/95 dark:text-white"
		>
			{name || $_(`areaStats.defaultAreaName`)} {$_(`areaActivity.activity`)}
		</h3>

		{#if feedItems.length}
			<div class="border-b border-gray-300 p-3 dark:border-white/95">
				<ActivityTypeFilter
					bind:activeTypes
					counts={typeCounts}
					showCounts={showChipCounts}
				/>
			</div>
		{/if}

		<div
			bind:this={feedDiv}
			class="hide-scroll relative max-h-[375px] space-y-2 overflow-y-scroll"
			on:scroll={() => {
				if (dataInitialized && !hideArrow) {
					hideArrow = true;
				}
			}}
		>
			{#if feedItems.length}
				{#if !activeTypes.size}
					<p class="p-5 text-center text-body dark:text-white">
						{$_("userActivity.noTypesSelected")}
					</p>
				{:else if !visibleItems.length}
					<p class="p-5 text-center text-body dark:text-white">
						{$_("userActivity.noMatchingTypes")}
					</p>
				{:else}
					{#each visibleItems as item, i (item.type + '-' + item.place_id + '-' + item.date + '-' + i)}
						<ActivityCard {item} highlight={i === 0} />
					{/each}
				{/if}

				{#if error}
					<p class="mx-auto !mb-2 text-center text-body dark:text-white">
						{$_(`areaActivity.loadError`)}
						<button
							class="ml-2 text-link transition-colors hover:text-hover"
							on:click={loadMore}
						>
							{$_(`areaActivity.retry`)}
						</button>
					</p>
				{/if}

				<button
					class="mx-auto !mb-5 block text-xl font-semibold text-link transition-colors hover:text-hover"
					on:click={loadMore}
					disabled={loading}
				>
					{loading ? $_(`areaActivity.loadMore`) + '...' : $_(`areaActivity.loadMore`)}
				</button>

				{#if !hideArrow && visibleItems.length > 5}
					<Icon
						type="fa"
						icon="chevron-down"
						w="16"
						h="16"
						class="absolute bottom-4 left-[calc(50%-8px)] z-20 animate-bounce text-primary dark:text-white"
					/>
				{/if}
			{:else if loading}
				{#each Array(5) as _, index (index)}
					<TaggerSkeleton />
				{/each}
			{:else if error}
				<p class="p-5 text-center text-body dark:text-white">
					{$_(`areaActivity.loadError`)}
					<button
						class="ml-2 text-link transition-colors hover:text-hover"
						on:click={() => fetchFeed()}
					>
						{$_(`areaActivity.retry`)}
					</button>
				</p>
			{:else if dataInitialized}
				<p class="p-5 text-body dark:text-white">{$_(`areaActivity.noActivity`)}</p>
			{/if}
		</div>
	</div>
</section>

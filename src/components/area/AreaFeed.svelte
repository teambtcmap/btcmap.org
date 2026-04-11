<script lang="ts">
import { _ } from "svelte-i18n";
import Time from "svelte-time";

import Icon from "$components/Icon.svelte";
import TaggerSkeleton from "$components/TaggerSkeleton.svelte";
import api from "$lib/axios";

import { resolve } from "$app/paths";

export let alias: string;
export let name: string;
export let dataInitialized: boolean;

type ActivityItem = {
	type: string;
	place_id: number;
	place_name?: string;
	osm_user_id?: number;
	osm_user_name?: string;
	comment?: string;
	duration_days?: number;
	date: string;
};

const DAYS_PER_PAGE = 30;

const DOT_COLORS: Record<string, string> = {
	place_commented: "bg-amber-500",
	place_boosted: "bg-orange-500",
	place_added: "bg-created",
	place_deleted: "bg-deleted",
	place_updated: "bg-link",
};

const dotColor = (type: string) => DOT_COLORS[type] ?? "bg-link";

let feedItems: ActivityItem[] = [];
let loading = false;
let error = false;
let feedDiv: HTMLDivElement;
let hideArrow = false;
let days = DAYS_PER_PAGE;
let fetchGeneration = 0;

const fetchFeed = async () => {
	loading = true;
	error = false;
	const gen = ++fetchGeneration;
	const hadItems = feedItems.length > 0;
	try {
		const url = `https://api.btcmap.org/v4/activity?area=${encodeURIComponent(alias)}&days=${days}`;
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

$: if (dataInitialized && alias) {
	days = DAYS_PER_PAGE;
	feedItems = [];
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
				{#each feedItems as item, i (item.type + '-' + item.place_id + '-' + item.date + '-' + i)}
					<div
						class="flex flex-col items-center gap-2 p-5 text-center text-xl lg:flex-row lg:gap-5 lg:text-left"
					>
						<!-- dot -->
						<span class="relative mx-auto mb-2 flex h-3 w-3 lg:mx-0 lg:mb-0">
							<span
								class="{i === 0 ? 'animate-ping' : ''} absolute inline-flex h-full w-full rounded-full {dotColor(item.type)} opacity-75"
							/>
							<span class="relative inline-flex h-3 w-3 rounded-full {dotColor(item.type)}" />
						</span>

						<div
							class="w-full flex-wrap items-center justify-between space-y-2 lg:flex lg:space-y-0"
						>
							<div class="space-y-2 lg:space-y-0">
								<span class="text-primary lg:mr-5 dark:text-white">
									{#if item.type === 'place_added' || item.type === 'place_updated' || item.type === 'place_deleted'}
										<a
											href={resolve(`/merchant/${item.place_id}`)}
											class="break-all text-link transition-colors hover:text-hover"
										>
											{item.place_name || item.place_id}
										</a>
										{$_('areaActivity.was')} <strong
											>{item.type === 'place_added'
												? $_('areaActivity.created')
												: item.type === 'place_deleted'
													? $_('areaActivity.deleted')
													: $_('areaActivity.updated')}</strong
										>
										{#if item.osm_user_id && item.osm_user_name}
											{$_('areaActivity.by')} <a
												href={resolve(`/tagger/${item.osm_user_id}`)}
												class="break-all text-link transition-colors hover:text-hover"
											>
												{item.osm_user_name}
											</a>
										{/if}
									{:else if item.type === 'place_commented'}
										<Icon
											type="fa"
											icon="comment"
											w="16"
											h="16"
											class="mr-1 inline align-middle"
										/>
										<a
											href={resolve(`/merchant/${item.place_id}`)}
											class="break-all text-link transition-colors hover:text-hover"
										>
											{item.place_name || item.place_id}
										</a>
										{$_('areaActivity.commented')} <span class="italic"
											>"{item.comment && item.comment.length > 80
												? item.comment.slice(0, 77) + '...'
												: item.comment}"</span
										>
									{:else if item.type === 'place_boosted'}
										<Icon
											type="fa"
											icon="bolt"
											w="16"
											h="16"
											class="mr-1 inline align-middle text-orange-500"
										/>
										<a
											href={resolve(`/merchant/${item.place_id}`)}
											class="break-all text-link transition-colors hover:text-hover"
										>
											{item.place_name || item.place_id}
										</a>
										{$_('areaActivity.was')} <strong>{$_('areaActivity.boosted')}</strong> {$_('areaActivity.forDays', { values: { days: item.duration_days } })}
									{/if}
								</span>

								<span
									class="block text-center font-semibold text-taggerTime lg:inline dark:text-white/70"
								>
									<Time live={3000} relative timestamp={item.date} />
								</span>
							</div>
						</div>
					</div>
				{/each}

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

				{#if !hideArrow && feedItems.length > 5}
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

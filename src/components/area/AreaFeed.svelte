<script lang="ts">
import { _ } from "svelte-i18n";
import Time from "svelte-time";

import Icon from "$components/Icon.svelte";
import TaggerSkeleton from "$components/TaggerSkeleton.svelte";
import api from "$lib/axios";

import { dev } from "$app/environment";
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

let feedItems: ActivityItem[] = [];
let loading = false;
let error = false;
let feedDiv: HTMLDivElement;
let hideArrow = false;
let days = 30;
let fetchGeneration = 0;

const fetchFeed = async (append: boolean) => {
	loading = true;
	error = false;
	const gen = ++fetchGeneration;
	try {
		const base = dev ? "/local-api" : "https://api.btcmap.org";
		const url = `${base}/v4/activity?area=${encodeURIComponent(alias)}&days=${days}`;
		const res = await api.get<ActivityItem[]>(url);
		// Discard stale response if user navigated to a different area
		if (gen !== fetchGeneration) return;
		feedItems = res.data;
	} catch {
		if (gen !== fetchGeneration) return;
		if (!append) feedItems = [];
		error = true;
	}
	loading = false;
};

const loadMore = () => {
	const scrollTop = feedDiv?.scrollTop;
	const prevDays = days;
	days = days + 30;
	fetchFeed(true).then(() => {
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
	days = 30;
	feedItems = [];
	error = false;
	hideArrow = false;
	fetchFeed(false);
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
							{#if item.type === 'place_commented'}
								<span
									class="{i === 0 ? 'animate-ping' : ''} absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"
								/>
								<span class="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
							{:else if item.type === 'place_boosted'}
								<span
									class="{i === 0 ? 'animate-ping' : ''} absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75"
								/>
								<span class="relative inline-flex h-3 w-3 rounded-full bg-orange-500" />
							{:else if item.type === 'place_added'}
								<span
									class="{i === 0 ? 'animate-ping' : ''} absolute inline-flex h-full w-full rounded-full bg-created opacity-75"
								/>
								<span class="relative inline-flex h-3 w-3 rounded-full bg-created" />
							{:else if item.type === 'place_deleted'}
								<span
									class="{i === 0 ? 'animate-ping' : ''} absolute inline-flex h-full w-full rounded-full bg-deleted opacity-75"
								/>
								<span class="relative inline-flex h-3 w-3 rounded-full bg-deleted" />
							{:else}
								<span
									class="{i === 0 ? 'animate-ping' : ''} absolute inline-flex h-full w-full rounded-full bg-link opacity-75"
								/>
								<span class="relative inline-flex h-3 w-3 rounded-full bg-link" />
							{/if}
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
										was <strong
											>{item.type === 'place_added'
												? 'created'
												: item.type === 'place_deleted'
													? 'deleted'
													: 'updated'}</strong
										>
										{#if item.osm_user_id && item.osm_user_name}
											by <a
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
										— <span class="italic"
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
										was <strong>boosted</strong> for {item.duration_days} days
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
					{$_(`areaActivity.noActivity`)}
					<button
						class="ml-2 text-link transition-colors hover:text-hover"
						on:click={() => fetchFeed(false)}
					>
						Retry
					</button>
				</p>
			{:else if dataInitialized}
				<p class="p-5 text-body dark:text-white">{$_(`areaActivity.noActivity`)}</p>
			{/if}
		</div>
	</div>
</section>

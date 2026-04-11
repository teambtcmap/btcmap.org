<script lang="ts">
import { _ } from "svelte-i18n";

import AreaFeed from "$components/area/AreaFeed.svelte";
import Icon from "$components/Icon.svelte";
import type { User } from "$lib/types.js";

import { resolve } from "$app/paths";

export let alias: string;
export let name: string;
export let dataInitialized: boolean;
export let taggers: User[];

let taggerCount = 25;
$: taggersPaginated = taggers.slice(0, taggerCount);
let taggerDiv: HTMLDivElement;
</script>

<section id="taggers">
	<!-- prettier-ignore -->
	<div class="w-full rounded-3xl border border-gray-300 dark:border-white/95 dark:bg-white/10">
		<!-- prettier-ignore -->
		<h3
			class="border-b border-gray-300 p-5 text-center text-lg font-semibold text-primary md:text-left dark:border-white/95 dark:text-white"
		>
			{name || $_(`areaStats.defaultAreaName`)} {$_(`areaActivity.supertaggers`)}
		</h3>

		<div bind:this={taggerDiv} class="hide-scroll max-h-[375px] overflow-scroll p-1">
			{#if taggers && taggers.length}
				<div class="flex flex-wrap items-center justify-center">
					{#each taggersPaginated as tagger (tagger.id)}
						<div class="m-4 space-y-1 transition-transform hover:scale-110">
							<a href={resolve(`/tagger/${tagger.id}`)}>
								<img
									src={tagger.osm_json.img
										? tagger.osm_json.img.href
										: '/images/satoshi-nakamoto.png'}
									alt={$_('aria.avatarAlt')}
									class="mx-auto h-20 w-20 rounded-full object-cover"
									on:error={function () {
										this.src = '/images/satoshi-nakamoto.png';
									}}
								/>
								<p class="text-center font-semibold text-body dark:text-white">
									{tagger.osm_json.display_name.length > 21
										? tagger.osm_json.display_name.slice(0, 18) + '...'
										: tagger.osm_json.display_name}
								</p>
							</a>
						</div>
					{/each}
				</div>

				{#if taggersPaginated.length !== taggers.length}
					<button
						class="mx-auto !mb-4 block text-xl font-semibold text-link transition-colors hover:text-hover"
						on:click={() => (taggerCount = taggerCount + 25)}>{$_(`areaActivity.loadMore`)}</button
					>
				{/if}
			{:else if !dataInitialized}
				<div class="flex flex-wrap items-center justify-center">
					{#each Array(5) as _, index (index)}
						<div class="m-4 space-y-1 transition-transform hover:scale-110">
							<p class="mx-auto h-20 w-20 animate-pulse rounded-full bg-link/50" />
							<p class="mx-auto h-5 w-28 animate-pulse rounded bg-link/50" />
						</div>
					{/each}
				</div>
			{:else}
				<p class="p-5 text-center text-body dark:text-white">{$_(`areaActivity.noSupertaggers`)}</p>
			{/if}
		</div>
	</div>
</section>

<AreaFeed {alias} {name} {dataInitialized} />

<section id="atom">
	<!-- prettier-ignore -->
	<div class="w-full rounded-3xl border border-gray-300 dark:border-white/95 dark:bg-white/10">
		<!-- prettier-ignore -->
		<h3
			class="border-b border-gray-300 p-5 text-center text-lg font-semibold text-primary md:text-left dark:border-white/95 dark:text-white"
		>
			{name || $_(`areaStats.defaultAreaName`)} {$_(`areaActivity.atomFeeds`)}
		</h3>

		<ul class="space-y-5 p-5 text-lg font-semibold text-primary dark:text-white">
			<li>
				<a
					class="text-link transition-colors hover:text-hover"
					href="https://api.btcmap.org/feeds/new-places/{alias}"
					target="_blank"
					rel="noreferrer"
				>
					{$_(`areaActivity.newPlaces`)}
				</a>
				<Icon type="fa" icon="location-pin" w="18" h="18" class="ml-1 inline align-middle" />
			</li>
			<li>
				<a
					class="text-link transition-colors hover:text-hover"
					href="https://api.btcmap.org/feeds/new-comments/{alias}"
					target="_blank"
					rel="noreferrer"
				>
					{$_(`areaActivity.newComments`)}
				</a>
				<Icon type="fa" icon="comment" w="18" h="18" class="ml-1 inline align-middle" />
			</li>
		</ul>
	</div>
</section>

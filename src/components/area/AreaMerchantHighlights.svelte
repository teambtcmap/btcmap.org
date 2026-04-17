<script lang="ts">
import MerchantCard from "$components/area/MerchantCard.svelte";
import { _ } from "$lib/i18n";
import type { Place } from "$lib/types";
import { isBoosted } from "$lib/utils";

import { resolve } from "$app/paths";

export let dataInitialized: boolean;
export let filteredPlaces: Place[];

$: boosts = filteredPlaces
	?.filter((p) => isBoosted(p))
	.toSorted(
		(a, b) =>
			Date.parse(b.boosted_until || "") - Date.parse(a.boosted_until || ""),
	);

// element.id is a SQLite rowid auto-assigned on insert, so sorting by id desc is
// a close approximation of "latest added" and works without per-place enrichment
// (created_at isn't in the static places.json the global $places store is seeded from).
$: latest = filteredPlaces?.toSorted((a, b) => b.id - a.id).slice(0, 6);
</script>

<section id="boosted">
	<!-- prettier-ignore -->
	<div class="w-full rounded-3xl border border-gray-300 dark:border-white/95 dark:bg-white/10">
		<!-- prettier-ignore -->
		<h3
			class="border-b border-gray-300 p-5 text-center text-lg font-semibold text-primary md:text-left dark:border-white/95 dark:text-white"
		>
			{$_('areaHighlights.boostedMerchants')}
		</h3>

		<div class="w-full px-2 py-6 sm:px-5">
			{#if !dataInitialized}
				<div class="grid w-full grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
					{#each Array(3) as _, index (index)}
						<div class="h-56 animate-pulse rounded-2xl bg-link/50" />
					{/each}
				</div>
			{:else if boosts.length}
				<div class="grid w-full grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
					{#each boosts as merchant (merchant.id)}
						<MerchantCard {merchant} />
					{/each}
				</div>
			{:else}
				<p class="text-center text-primary sm:text-left dark:text-white">
					{$_('areaHighlights.noBoosted')}
				</p>
			{/if}
		</div>
	</div>
</section>

<section id="latest">
	<!-- prettier-ignore -->
	<div class="w-full rounded-3xl border border-gray-300 dark:border-white/95 dark:bg-white/10">
		<!-- prettier-ignore -->
		<h3
			class="border-b border-gray-300 p-5 text-center text-lg font-semibold text-primary md:text-left dark:border-white/95 dark:text-white"
		>
			{$_('areaHighlights.latestAdded')}
		</h3>

		<div class="w-full px-2 py-6 sm:px-5">
			{#if !dataInitialized}
				<div class="grid w-full grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
					{#each Array(3) as _, index (index)}
						<div class="h-56 animate-pulse rounded-2xl bg-link/50" />
					{/each}
				</div>
			{:else if latest.length}
				<div class="grid w-full grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
					{#each latest as merchant (merchant.id)}
						<MerchantCard {merchant} />
					{/each}
				</div>
			{:else}
				<p class="text-center text-primary sm:text-left dark:text-white">
					{$_('areaHighlights.noLatest')} <a
						href={resolve('/add-location')}
						class="text-link transition-colors hover:text-hover">{$_('areaHighlights.addNewMerchant')}</a
					> {$_('areaHighlights.now')}
				</p>
			{/if}
		</div>
	</div>
</section>

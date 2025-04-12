<script lang="ts">
	import { MerchantCard } from '$lib/comp';
	import type { Element } from '$lib/types';
	import { isBoosted } from '$lib/utils';

	export let dataInitialized: boolean;
	export let filteredElements: Element[];

	$: boosts =
		filteredElements &&
		filteredElements
			.filter((e) => isBoosted(e))
			.toSorted(
				(a, b) =>
					Date.parse(b.tags['boost:expires'] || '') - Date.parse(a.tags['boost:expires'] || '')
			);

	$: latest =
		filteredElements &&
		filteredElements
			.toSorted((a, b) => Date.parse(b['created_at']) - Date.parse(a['created_at']))
			.slice(0, 6);
</script>

<section id="boosted">
	<div class="w-full rounded-3xl border border-statBorder dark:bg-white/10">
		<h3
			class="border-b border-statBorder p-5 text-center text-lg font-semibold text-primary dark:text-white md:text-left"
		>
			Boosted Merchants
		</h3>

		<div class="w-full px-2 py-6 sm:px-5">
			{#if !dataInitialized}
				<div class="grid w-full grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
					{#each Array(3) as skeleton (skeleton)}
						<div class="h-56 animate-pulse rounded-2xl bg-link/50" />
					{/each}
				</div>
			{:else if boosts.length}
				<div class="grid w-full grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
					{#each boosts as merchant (merchant)}
						<MerchantCard {merchant} />
					{/each}
				</div>
			{:else}
				<p class="text-center text-primary dark:text-white sm:text-left">
					No boosted merchants in this area.
				</p>
			{/if}
		</div>
	</div>
</section>

<section id="latest">
	<div class="w-full rounded-3xl border border-statBorder dark:bg-white/10">
		<h3
			class="border-b border-statBorder p-5 text-center text-lg font-semibold text-primary dark:text-white md:text-left"
		>
			Latest Added
		</h3>

		<div class="w-full px-2 py-6 sm:px-5">
			{#if !dataInitialized}
				<div class="grid w-full grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
					{#each Array(3) as skeleton (skeleton)}
						<div class="h-56 animate-pulse rounded-2xl bg-link/50" />
					{/each}
				</div>
			{:else if latest.length}
				<div class="grid w-full grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
					{#each latest as merchant (merchant)}
						<MerchantCard {merchant} />
					{/each}
				</div>
			{:else}
				<p class="text-center text-primary dark:text-white sm:text-left">
					No latest added in this area. You can <a
						href="/add-location"
						class="text-link transition-colors hover:text-hover">add a new merchant</a
					> now!
				</p>
			{/if}
		</div>
	</div>
</section>

<script lang="ts">
	export let countries: Area[] | undefined;

	import { CountryCard, CountrySkeleton } from '$lib/comp';
	import type { Area } from '$lib/types';
</script>

<section>
	<div class="grid gap-10 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
		{#if countries && countries.length}
			{#each countries as country (country.id)}
				<CountryCard id={country.id} name={country.tags.name} />
			{/each}
		{:else}
			{#each Array(4) as skeleton (skeleton)}
				<CountrySkeleton />
			{/each}
		{/if}
	</div>
</section>

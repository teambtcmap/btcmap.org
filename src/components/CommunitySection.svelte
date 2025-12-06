<script lang="ts">
	export let communities: Area[] | undefined;

	import CommunityCard from '$components/CommunityCard.svelte';
	import CommunitySkeleton from '$components/CommunitySkeleton.svelte';
	import type { Area } from '$lib/types';
</script>

<section>
	<div class="grid gap-10 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
		{#if communities && communities.length}
			{#each communities as community (community.id)}
				<CommunityCard id={community.id} tags={community.tags} />
			{/each}
		{:else}
			{#each Array(4) as _, index (index)}
				<CommunitySkeleton />
			{/each}
		{/if}
	</div>
</section>

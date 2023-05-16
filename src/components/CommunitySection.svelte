<script>
	export let communities;

	import { CommunityCard, CommunitySkeleton } from '$comp';
</script>

<section>
	<div class="grid gap-10 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
		{#if communities && communities.length}
			{#each communities as community}
				<CommunityCard id={community.id} tags={community.tags} />
			{/each}
		{:else}
			<!-- eslint-disable-next-line no-unused-vars -->
			{#each Array(4) as skeleton}
				<CommunitySkeleton />
			{/each}
		{/if}
	</div>
</section>

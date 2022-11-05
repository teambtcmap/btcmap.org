<script>
	export let title;
	export let communities;

	import { CommunityCard, CommunitySkeleton } from '$comp';
</script>

<section id={title}>
	<h2 class="text-primary text-3xl font-semibold md:text-left mb-5">{title}</h2>

	<div class="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
		{#if communities && communities.length}
			{#each communities as community}
				<CommunityCard id={community.id} tags={community.tags} />
			{/each}
		{:else}
			{#each Array(4) as skeleton}
				<CommunitySkeleton />
			{/each}
		{/if}
	</div>
</section>

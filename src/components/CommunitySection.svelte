<script>
	export let title;
	export let communities;

	import { CommunityCard, CommunitySkeleton } from '$comp';
</script>

<section id={title}>
	<h2 class="mb-5 text-3xl font-semibold text-primary dark:text-white md:text-left">
		<a href="/communities#{title}">{title}</a>
	</h2>

	<div class="grid gap-10 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

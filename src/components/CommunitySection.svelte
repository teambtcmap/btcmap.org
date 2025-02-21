<script lang="ts">

	import { CommunityCard, CommunitySkeleton } from '$lib/comp';
	import type { Area } from '$lib/types';
	interface Props {
		communities: Area[] | undefined;
	}

	let { communities }: Props = $props();
</script>

<section>
	<div class="grid gap-10 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
		{#if communities && communities.length}
			{#each communities as community}
				<CommunityCard id={community.id} tags={community.tags} />
			{/each}
		{:else}
			<!-- eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars -->
			{#each Array(4) as skeleton}
				<CommunitySkeleton />
			{/each}
		{/if}
	</div>
</section>

<script lang="ts">
	import type { OSMTags } from '$lib/types';

	export let tags: OSMTags;
</script>

<div class="space-y-2">
	{#each Object.entries(tags) as tag, index (index)}
		<div>
			<span class="font-semibold text-primary dark:font-normal dark:text-white">{tag[0]}</span><span
				class="dark:text-white">=</span
			><span class="font-semibold text-body dark:text-white">{tag[1]}</span>
		</div>
	{/each}
</div>

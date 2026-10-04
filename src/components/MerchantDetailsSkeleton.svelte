<script lang="ts">
import Skeleton from "$components/Skeleton.svelte";

// Loading stand-in for MerchantDetailsContent, shared by the map drawers
// (desktop and mobile) and the area drawer; each drawer sets the padding
type Props = {
	class?: string;
};

let { class: className = "" }: Props = $props();
</script>

<div class="space-y-4 {className}">
	<!-- Title -->
	<Skeleton class="h-7 w-3/4 rounded-lg" />
	<!-- Address -->
	<Skeleton class="h-5 w-1/2 rounded" />
	<!-- Payment methods -->
	<div class="flex space-x-2">
		{#each Array(3) as _, index (index)}
			<Skeleton class="h-8 w-16 rounded" />
		{/each}
	</div>
	<!-- Stats grid -->
	<div class="grid grid-cols-2 gap-2">
		<Skeleton class="h-20 rounded-lg" />
		<Skeleton class="h-20 rounded-lg" />
	</div>
	<!-- Details -->
	<Skeleton class="h-32 rounded-lg" />
</div>

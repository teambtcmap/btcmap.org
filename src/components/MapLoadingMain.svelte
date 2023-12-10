<script lang="ts">
	export let progress: number | undefined;

	import { fade } from 'svelte/transition';

	import { tick } from 'svelte';

	const hideProgressBar = async () => {
		await tick();
		progress = undefined;
	};

	$: progress === 100 && hideProgressBar();
</script>

{#if progress !== undefined}
	<div
		out:fade={{ delay: 1000 }}
		class="absolute left-1/2 top-1/2 z-[10000] -translate-x-1/2 -translate-y-1/2 space-y-2 rounded-lg border border-primary bg-teal p-4 dark:border-white dark:bg-dark"
	>
		<p class="text-center text-primary dark:text-white">Loading map...</p>

		<div class="mx-auto w-[200px] rounded-full bg-link/25">
			<div
				class="h-2 rounded-full bg-link transition-all duration-1000"
				style:width={progress.toString() + '%'}
			/>
		</div>
	</div>
{/if}

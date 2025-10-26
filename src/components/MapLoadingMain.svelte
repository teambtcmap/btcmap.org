<script lang="ts">
	export let progress: number | undefined;

	import { tick } from 'svelte';
	import { fade } from 'svelte/transition';

	/* eslint-disable svelte/infinite-reactive-loop */
	$: progress === 40 &&
		setTimeout(() => {
			if (progress !== undefined && progress !== 100) {
				progress = 60;
			}
		}, 2000);

	const hideProgressBar = async () => {
		await tick();
		progress = undefined;
	};

	$: progress === 100 && hideProgressBar();
	/* eslint-enable svelte/infinite-reactive-loop */
</script>

{#if progress !== undefined}
	<div
		out:fade={{ delay: 1000 }}
		class="absolute top-1/2 left-1/2 z-[10000] -translate-x-1/2 -translate-y-1/2 space-y-2 rounded-lg border-2 border-primary bg-teal p-4 drop-shadow-2xl dark:border-white dark:bg-dark"
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

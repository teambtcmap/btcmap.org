<script lang="ts">
	export let progress: number | undefined;
	export let status: string | undefined = undefined;

	import { fade } from 'svelte/transition';

	let shouldHide = false;

	// Watch for 100% completion to hide
	$: if (progress === 100) {
		shouldHide = true;
	}

	// Reset shouldHide when progress is active again
	$: if (progress !== undefined && progress < 100) {
		shouldHide = false;
	}
</script>

{#if progress !== undefined && !shouldHide}
	<div
		out:fade={{ delay: 1000 }}
		class="absolute top-1/2 left-1/2 z-[10000] -translate-x-1/2 -translate-y-1/2 space-y-2 rounded-lg border-2 border-primary bg-teal p-4 drop-shadow-2xl dark:border-white dark:bg-dark"
	>
		<p class="text-center text-primary dark:text-white">
			{status || 'Loading map...'}
		</p>

		<div class="mx-auto w-[200px] rounded-full bg-link/25">
			<div
				class="h-2 rounded-full bg-link transition-all duration-500"
				style:width={progress.toString() + '%'}
			/>
		</div>

		{#if progress > 0 && progress < 100}
			<p class="text-center text-xs text-primary/75 dark:text-white/75">
				{Math.round(progress)}%
			</p>
		{/if}
	</div>
{/if}

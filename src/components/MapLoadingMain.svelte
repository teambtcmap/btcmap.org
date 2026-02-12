<script lang="ts">
export let progress: number | undefined;
export let status: string | undefined = undefined;

import { fade } from "svelte/transition";

import { _ } from "$lib/i18n";

let shouldHide = false;

// Watch for 100% completion to hide
$: if (progress === 100) {
	shouldHide = true;
}

// Reset shouldHide when progress is actively loading (> 0 and < 100)
$: if (progress !== undefined && progress > 0 && progress < 100) {
	shouldHide = false;
}

// Show loading indicator only when actively loading (progress > 0) and not hidden
// Also create a typed variable for use in template
$: shouldShow = progress !== undefined && progress > 0 && !shouldHide;
$: displayProgress = progress ?? 0; // Provide fallback for template usage
</script>

{#if shouldShow}
	<div
		out:fade={{ delay: 1000 }}
		class="absolute top-1/2 left-1/2 z-[10000] -translate-x-1/2 -translate-y-1/2 space-y-2 rounded-lg border-2 border-primary bg-teal p-4 drop-shadow-2xl dark:border-white dark:bg-dark"
	>
		<p class="text-center text-primary dark:text-white">
			{status || $_('status.loadingMap')}
		</p>

		<div class="mx-auto w-[200px] rounded-full bg-link/25">
			<div
				class="h-2 min-w-2 rounded-full bg-link transition-all duration-500"
				style:width={displayProgress.toString() + '%'}
			/>
		</div>

		{#if displayProgress > 0 && displayProgress < 100}
			<p class="text-center text-xs text-primary/75 dark:text-white/75">
				{Math.round(displayProgress)}%
			</p>
		{/if}
	</div>
{/if}

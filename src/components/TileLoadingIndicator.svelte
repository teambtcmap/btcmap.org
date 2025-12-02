<script lang="ts">
	import LoadingSpinner from './LoadingSpinner.svelte';
	import { fade } from 'svelte/transition';

	export let visible = false;
</script>

{#if visible}
	<div
		role="status"
		aria-live="polite"
		transition:fade={{ duration: 200 }}
		class="pointer-events-none fixed right-2 bottom-6 z-[1000] flex items-center gap-1.5
			   rounded-md bg-white px-2 py-1.5 shadow-lg
			   md:right-4 md:bottom-8 md:gap-2 md:rounded-lg md:px-3 md:py-2
			   dark:border dark:border-white/20 dark:bg-dark"
	>
		<LoadingSpinner size="h-3 w-3 md:h-4 md:w-4" color="text-link" />
		<span class="text-xs text-primary md:text-sm dark:text-white">Loading tiles...</span>
	</div>
{/if}

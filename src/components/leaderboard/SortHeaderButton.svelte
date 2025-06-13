<script lang="ts">
	import type { Column } from '@tanstack/svelte-table';

	export let column: Column<unknown> | undefined;
	export let label: string;
	export let ariaLabel: string;
</script>

<button
	type="button"
	class="flex cursor-pointer select-none items-center justify-center gap-1 text-body transition-colors hover:text-primary dark:text-white/70 dark:hover:text-white"
	on:click={(e) => column?.getToggleSortingHandler()?.(e)}
	aria-label={ariaLabel}
	disabled={!column}
>
	<span>{label}</span>
	{#if column?.getIsSorted() === 'asc'}
		<span aria-hidden="true" class="text-xs">▲</span>
	{:else if column?.getIsSorted() === 'desc'}
		<span aria-hidden="true" class="text-xs">▼</span>
	{/if}
</button>

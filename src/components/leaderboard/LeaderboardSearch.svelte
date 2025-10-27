<script lang="ts">
	import type { Table } from '@tanstack/svelte-table';
	import { Icon } from '$lib/comp';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export let table: Table<any>;
	export let globalFilter: string = '';
	export let searchDebounce: (e: Event) => void;

	let searchInput: HTMLInputElement;

	function clearSearch() {
		globalFilter = '';
		table?.setGlobalFilter('');
	}

	function focusSearch() {
		searchInput.focus();
	}
</script>

<div class="relative text-primary dark:text-white">
	<input
		type="text"
		placeholder="Search..."
		class="w-full bg-primary/5 px-5 py-2.5 text-sm focus:outline-primary dark:bg-white/5 dark:focus:outline-white"
		bind:value={globalFilter}
		on:keyup={searchDebounce}
		bind:this={searchInput}
		aria-label="Search leaderboard"
	/>
	{#if globalFilter}
		<button
			type="button"
			class="absolute top-1/2 right-3 -translate-y-1/2"
			on:click={clearSearch}
			aria-label="Clear search"
		>
			<Icon type="fa" icon="circle-xmark" w="16" h="16" />
		</button>
	{:else}
		<button
			type="button"
			class="absolute top-1/2 right-3 -translate-y-1/2"
			on:click={focusSearch}
			aria-label="Focus search"
		>
			<Icon type="fa" icon="magnifying-glass" w="16" h="16" />
		</button>
	{/if}
</div>

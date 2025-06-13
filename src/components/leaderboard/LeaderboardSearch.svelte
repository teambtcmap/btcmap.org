<script lang="ts">
	import type { Table } from '@tanstack/svelte-table';

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
			class="absolute right-3 top-1/2 -translate-y-1/2"
			on:click={clearSearch}
			aria-label="Clear search"
		>
			<i class="fa-solid fa-circle-xmark" />
		</button>
	{:else}
		<button
			type="button"
			class="absolute right-3 top-1/2 -translate-y-1/2"
			on:click={focusSearch}
			aria-label="Focus search"
		>
			<i class="fa-solid fa-magnifying-glass" />
		</button>
	{/if}
</div>

<script lang="ts" generics="TData extends RowData">
import type { RowData, Table } from "@tanstack/svelte-table";

import Icon from "$components/Icon.svelte";
import { _ } from "$lib/i18n";
import type { BtcmapTableFeatures } from "$lib/tableFeatures";

type Props = {
	table: Table<BtcmapTableFeatures, TData>;
	globalFilter?: string;
	searchDebounce: (e: Event) => void;
};

let { table, globalFilter = $bindable(""), searchDebounce }: Props = $props();

let searchInput: HTMLInputElement | undefined = $state();

function clearSearch() {
	globalFilter = "";
	table.setGlobalFilter("");
}

function focusSearch() {
	searchInput?.focus();
}
</script>

<div class="relative text-primary dark:text-white">
	<input
		type="text"
		placeholder={$_('search.placeholder')}
		class="w-full bg-primary/5 px-5 py-2.5 text-sm focus:outline-primary dark:bg-white/5 dark:focus:outline-white"
		bind:value={globalFilter}
		onkeyup={searchDebounce}
		bind:this={searchInput}
		aria-label={$_('search.ariaLabel')}
	/>
	{#if globalFilter}
		<button
			type="button"
			class="absolute top-1/2 right-3 -translate-y-1/2"
			onclick={clearSearch}
			aria-label={$_('aria.clearSearch')}
		>
			<Icon type="fa" icon="circle-xmark" w="16" h="16" />
		</button>
	{:else}
		<button
			type="button"
			class="absolute top-1/2 right-3 -translate-y-1/2"
			onclick={focusSearch}
			aria-label={$_('aria.focusSearch')}
		>
			<Icon type="fa" icon="magnifying-glass" w="16" h="16" />
		</button>
	{/if}
</div>

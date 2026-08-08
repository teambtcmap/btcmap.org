<script lang="ts" generics="TData extends RowData">
import type { Column, RowData } from "@tanstack/svelte-table";

import type { BtcmapTableFeatures } from "$lib/tableFeatures";

type Props = {
	column: Column<BtcmapTableFeatures, TData> | undefined;
	label: string;
	ariaLabel: string;
};

let { column, label, ariaLabel }: Props = $props();
</script>

<button
	type="button"
	class="flex cursor-pointer items-center justify-center gap-1 text-body transition-colors select-none hover:text-primary dark:text-white/70 dark:hover:text-white"
	onclick={(e) => column?.getToggleSortingHandler()?.(e)}
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

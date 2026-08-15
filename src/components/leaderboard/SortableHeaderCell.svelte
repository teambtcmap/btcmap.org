<script lang="ts" generics="TData extends RowData">
import type { Header, RowData } from "@tanstack/svelte-table";
import { FlexRender } from "@tanstack/svelte-table";
import type { Snippet } from "svelte";

import { _ } from "$lib/i18n";
import type { BtcmapTableFeatures } from "$lib/tableFeatures";
import { resolveHeaderLabel } from "$lib/tableFeatures";

type Props = {
	header: Header<BtcmapTableFeatures, TData, any>;
	centered?: boolean;
	trailing?: Snippet;
};

let { header, centered = false, trailing }: Props = $props();
</script>

{#if !header.isPlaceholder}
	{@const headerLabel = resolveHeaderLabel(header)}
	{#if trailing}
		<!-- Trailing controls (e.g. tooltip triggers) live OUTSIDE the sort
		     button as siblings: as descendants their clicks and Enter/Space
		     would bubble into the sort handler (and interactive content inside
		     a button is invalid HTML — the parser splits nested buttons,
		     breaking SSR hydration) -->
		<div
			class="flex items-center gap-x-1 md:gap-x-2"
			class:mx-auto={centered}
			class:w-fit={centered}
		>
			{@render sortButton(headerLabel, false)}
			{@render trailing()}
		</div>
	{:else}
		{@render sortButton(headerLabel, centered)}
	{/if}
{/if}

{#snippet sortButton(headerLabel: string, centerSelf: boolean)}
	<button
		type="button"
		class="flex items-center gap-x-1 leading-tight select-none md:gap-x-2"
		class:mx-auto={centerSelf}
		class:justify-center={centerSelf}
		class:cursor-pointer={header.column.getCanSort()}
		onclick={header.column.getToggleSortingHandler()}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				header.column.getToggleSortingHandler()?.(e);
			}
		}}
		tabindex={header.column.getCanSort() ? 0 : -1}
		aria-label={header.column.getCanSort()
			? header.column.getIsSorted() === 'asc'
				? $_('leaderboard.sortByCurrentlyAscending', {
						values: { column: headerLabel },
					})
				: header.column.getIsSorted() === 'desc'
					? $_('leaderboard.sortByCurrentlyDescending', {
							values: { column: headerLabel },
						})
					: $_('leaderboard.sortByCurrentlyUnsorted', {
							values: { column: headerLabel },
						})
			: headerLabel}
	>
		<span class="break-words">
			<FlexRender {header} />
		</span>
		{#if header.column.getIsSorted() === 'asc'}
			<span aria-hidden="true">▲</span>
		{:else if header.column.getIsSorted() === 'desc'}
			<span aria-hidden="true">▼</span>
		{/if}
	</button>
{/snippet}

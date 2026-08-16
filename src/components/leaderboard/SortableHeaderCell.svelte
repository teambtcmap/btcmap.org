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
			{@render headerContent(headerLabel, false)}
			{@render trailing()}
		</div>
	{:else}
		{@render headerContent(headerLabel, centered)}
	{/if}
{/if}

{#snippet headerContent(headerLabel: string, centerSelf: boolean)}
	{#if header.column.getCanSort()}
		<button
			type="button"
			class="flex cursor-pointer items-center gap-x-1 leading-tight select-none md:gap-x-2"
			class:mx-auto={centerSelf}
			class:justify-center={centerSelf}
			onclick={header.column.getToggleSortingHandler()}
			aria-label={header.column.getIsSorted() === 'asc'
				? $_('leaderboard.sortByCurrentlyAscending', {
						values: { column: headerLabel },
					})
				: header.column.getIsSorted() === 'desc'
					? $_('leaderboard.sortByCurrentlyDescending', {
							values: { column: headerLabel },
						})
					: $_('leaderboard.sortByCurrentlyUnsorted', {
							values: { column: headerLabel },
						})}
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
	{:else}
		<!-- Not sortable: plain text, no interactive control — a button here
		     is a nameless no-op in the accessibility tree -->
		<span
			class="flex items-center gap-x-1 leading-tight select-none md:gap-x-2"
			class:mx-auto={centerSelf}
			class:justify-center={centerSelf}
		>
			<span class="break-words">
				<FlexRender {header} />
			</span>
		</span>
	{/if}
{/snippet}

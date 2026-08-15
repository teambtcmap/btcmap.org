<script lang="ts">
import type { Table } from "@tanstack/svelte-table";
import { FlexRender } from "@tanstack/svelte-table";

import SortableHeaderCell from "$components/leaderboard/SortableHeaderCell.svelte";
import Tip from "$components/Tip.svelte";
import { _ } from "$lib/i18n";
import type { BtcmapTableFeatures } from "$lib/tableFeatures";
import { resolveAriaSort } from "$lib/tableFeatures";
import type { TaggerLeaderboard } from "$lib/types";
import { isEven } from "$lib/utils";

import { resolve } from "$app/paths";

type TaggerRow = TaggerLeaderboard & {
	position: number;
	tipDestination?: string;
};

let { table }: { table: Table<BtcmapTableFeatures, TaggerRow> } = $props();
</script>

<div class="hidden lg:block" role="region" aria-label={$_('leaderboard.tableAria')}>
	<table class="w-full text-left text-xs text-primary lg:text-sm xl:text-lg dark:text-white">
		<thead>
			{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
				<tr>
					{#each headerGroup.headers as header (header.id)}
						<th
							colSpan={header.colSpan}
							class="px-2 pt-5 pb-2.5 md:px-5"
							class:text-center={header.column.id !== 'name'}
							aria-sort={resolveAriaSort(header)}
						>
							<SortableHeaderCell {header} centered={header.column.id !== 'name'} />
						</th>
					{/each}
				</tr>
			{/each}
		</thead>
		<tbody>
			{#each table.getRowModel().rows as row (row.id)}
				<tr class={isEven(row.original.position - 1) ? 'bg-primary/5 dark:bg-white/5' : ''}>
					{#each row.getAllCells() as cell (cell.id)}
						<td class="px-2 py-3 md:px-5" class:text-center={cell.column.id !== 'name'}>
							{#if cell.column.id === 'position'}
								{#if row.original.position === 1}🥇
								{:else if row.original.position === 2}🥈
								{:else if row.original.position === 3}🥉
								{:else}
									{row.original.position}
								{/if}
							{:else if cell.column.id === 'name'}
								<div class="flex items-center gap-3">
									<img
										src={row.original.avatar}
										alt={row.original.tagger}
										class="h-12 w-12 rounded-full object-cover"
										onerror={(event) => {
											const target = event.target;
											if (target instanceof HTMLImageElement) {
												target.src = '/images/satoshi-nakamoto.png';
											}
										}}
										loading="lazy"
									/>
									<a
										href={resolve(`/tagger/${row.original.id}`)}
										class="text-link transition-colors hover:text-hover"
									>
										{row.original.tagger}
									</a>
								</div>
							{:else if cell.column.id === 'tip'}
								{#if row.original.tipDestination}
									<Tip destination={row.original.tipDestination} class="mx-auto block" />
								{/if}
							{:else}
								<FlexRender {cell} />
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

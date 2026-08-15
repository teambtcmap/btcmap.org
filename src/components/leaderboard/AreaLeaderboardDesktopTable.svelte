<script lang="ts">
import type { Table } from "@tanstack/svelte-table";
import { FlexRender } from "@tanstack/svelte-table";

import Icon from "$components/Icon.svelte";
import AreaLeaderboardItemName from "$components/leaderboard/AreaLeaderboardItemName.svelte";
import GradeDisplay from "$components/leaderboard/GradeDisplay.svelte";
import SortableHeaderCell from "$components/leaderboard/SortableHeaderCell.svelte";
import { _ } from "$lib/i18n";
import type { BtcmapTableFeatures } from "$lib/tableFeatures";
import { resolveAriaSort } from "$lib/tableFeatures";
import type { AreaLeaderboardRow, AreaType } from "$lib/types";
import { isEven } from "$lib/utils";

type Props = {
	table: Table<BtcmapTableFeatures, AreaLeaderboardRow>;
	type: AreaType;
	totalTooltip?: HTMLButtonElement;
	upToDateTooltip?: HTMLButtonElement;
	gradeTooltip?: HTMLButtonElement;
};

let {
	table,
	type,
	totalTooltip = $bindable(),
	upToDateTooltip = $bindable(),
	gradeTooltip = $bindable(),
}: Props = $props();
</script>

<div class="hidden lg:block" role="region" aria-label={$_('areaLeaderboard.tableAria')}>
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
							<SortableHeaderCell {header} centered={header.column.id !== 'name'}>
								{#snippet trailing()}
									{#if header.column.id === 'total'}
										<button
											type="button"
											bind:this={totalTooltip}
											class="cursor-default"
											aria-label={$_('areaLeaderboard.totalTooltipInfo')}
										>
											<Icon type="fa" icon="circle-info" w="14" h="14" class="text-sm" />
										</button>
									{:else if header.column.id === 'upToDateElements'}
										<button
											type="button"
											bind:this={upToDateTooltip}
											class="cursor-default"
											aria-label={$_('areaLeaderboard.verifiedTooltipInfo')}
										>
											<Icon type="fa" icon="circle-info" w="14" h="14" class="text-sm" />
										</button>
									{:else if header.column.id === 'grade'}
										<button
											type="button"
											bind:this={gradeTooltip}
											class="cursor-default"
											aria-label={$_('areaLeaderboard.gradeTooltipInfo')}
										>
											<Icon type="fa" icon="circle-info" w="14" h="14" class="text-sm" />
										</button>
									{/if}
								{/snippet}
							</SortableHeaderCell>
						</th>
					{/each}
				</tr>
			{/each}
		</thead>
		<tbody>
			{#each table.getRowModel().rows as row, index (row.id)}
				<tr class={isEven(index) ? 'bg-primary/5 dark:bg-white/5' : ''}>
					{#each row.getAllCells() as cell (cell.id)}
						<td
							class="px-2 py-2.5 md:px-5"
							class:text-center={cell.column.id === 'position' ||
								cell.column.id === 'grade' ||
								cell.column.id === 'total' ||
								cell.column.id === 'upToDateElements'}
							class:text-2xl={cell.column.id === 'position'}
						>
							{#if cell.column.id === 'name'}
								<AreaLeaderboardItemName
									{type}
									avatar={cell.row.original.icon || ''}
									name={cell.row.original.name || 'Unknown'}
									id={cell.row.original.alias || String(cell.row.original.id) || ''}
									countryCode={type === 'country' ? cell.row.original.alias : undefined}
								/>
							{:else if cell.column.id === 'grade'}
								{@const grade = cell.row.original.grade || 0}
								{@const percentage = cell.row.original.places_total > 0
									? Math.round((cell.row.original.places_verified_1y / cell.row.original.places_total) * 100)
									: 0}
								<GradeDisplay {grade} {percentage} size="large" />
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

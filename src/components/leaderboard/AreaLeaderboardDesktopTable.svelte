<script lang="ts">
import type { Table } from "@tanstack/svelte-table";
import { FlexRender } from "@tanstack/svelte-table";

import Icon from "$components/Icon.svelte";
import AreaLeaderboardItemName from "$components/leaderboard/AreaLeaderboardItemName.svelte";
import GradeDisplay from "$components/leaderboard/GradeDisplay.svelte";
import { _ } from "$lib/i18n";
import type { BtcmapTableFeatures } from "$lib/tableFeatures";
import type { ApiLeaderboardArea, AreaType } from "$lib/types";
import { isEven } from "$lib/utils";

type AreaRow = ApiLeaderboardArea & { position: number };

type Props = {
	table: Table<BtcmapTableFeatures, AreaRow>;
	type: AreaType;
	totalTooltip?: HTMLElement;
	upToDateTooltip?: HTMLElement;
	gradeTooltip?: HTMLElement;
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
							aria-sort={header.column.getIsSorted() === 'asc'
								? 'ascending'
								: header.column.getIsSorted() === 'desc'
									? 'descending'
									: 'none'}
						>
							{#if !header.isPlaceholder}
								{@const headerDef = header.column.columnDef.header}
								{@const headerLabel = typeof headerDef === 'function'
									? String(headerDef(header.getContext()))
									: typeof headerDef === 'string'
										? headerDef
										: header.column.id}
								<button
									type="button"
									class="flex items-center gap-x-1 leading-tight select-none md:gap-x-2"
									class:mx-auto={header.column.id !== 'name'}
									class:cursor-pointer={header.column.getCanSort()}
									class:justify-center={header.column.id !== 'name'}
									onclick={header.column.getToggleSortingHandler()}
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											header.column.getToggleSortingHandler()?.(e);
										}
									}}
									tabindex={header.column.getCanSort() ? 0 : -1}
									aria-label={header.column.getCanSort()
										? `Sort by ${headerLabel}, currently ${
												header.column.getIsSorted() === 'asc'
													? 'ascending'
													: header.column.getIsSorted() === 'desc'
														? 'descending'
														: 'unsorted'
											}`
										: headerLabel}
								>
									<span class="break-words">
										<FlexRender {header} />
									</span>
									<!-- Tooltip triggers are spans, not buttons: the HTML parser
									     auto-closes a <button> opened inside a <button>, so nested
									     buttons break SSR hydration -->
									{#if header.column.id === 'total'}
										<span
											bind:this={totalTooltip}
											role="button"
											tabindex="0"
											class="ml-1 cursor-default"
											aria-label={$_('areaLeaderboard.totalTooltipInfo')}
										>
											<Icon type="fa" icon="circle-info" w="14" h="14" class="text-sm" />
										</span>
									{:else if header.column.id === 'upToDateElements'}
										<span
											bind:this={upToDateTooltip}
											role="button"
											tabindex="0"
											class="ml-1 cursor-default"
											aria-label={$_('areaLeaderboard.verifiedTooltipInfo')}
										>
											<Icon type="fa" icon="circle-info" w="14" h="14" class="text-sm" />
										</span>
									{:else if header.column.id === 'grade'}
										<span
											bind:this={gradeTooltip}
											role="button"
											tabindex="0"
											class="ml-1 cursor-default"
											aria-label={$_('areaLeaderboard.gradeTooltipInfo')}
										>
											<Icon type="fa" icon="circle-info" w="14" h="14" class="text-sm" />
										</span>
									{/if}
									{#if header.column.getIsSorted().toString() === 'asc'}
										<span aria-hidden="true">▲</span>
									{:else if header.column.getIsSorted().toString() === 'desc'}
										<span aria-hidden="true">▼</span>
									{/if}
								</button>
							{/if}
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

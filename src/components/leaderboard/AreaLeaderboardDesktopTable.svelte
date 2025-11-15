<script lang="ts">
	import type { AreaType } from '$lib/types';
	import type { Table } from '@tanstack/svelte-table';
	import { flexRender } from '@tanstack/svelte-table';
	import { isEven } from '$lib/utils';
	import AreaLeaderboardItemName from './AreaLeaderboardItemName.svelte';
	import GradeDisplay from './GradeDisplay.svelte';
	import Icon from '$lib/components/Icon.svelte';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export let table: Table<any>;
	export let type: AreaType;
	export let totalTooltip: HTMLButtonElement;
	export let upToDateTooltip: HTMLButtonElement;
	export let gradeTooltip: HTMLButtonElement;
</script>

<div class="hidden lg:block" role="region" aria-label="Leaderboard table">
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
								<button
									type="button"
									class="flex items-center gap-x-1 leading-tight select-none md:gap-x-2"
									class:mx-auto={header.column.id !== 'name'}
									class:cursor-pointer={header.column.getCanSort()}
									class:justify-center={header.column.id !== 'name'}
									on:click={header.column.getToggleSortingHandler()}
									on:keydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											header.column.getToggleSortingHandler()?.(e);
										}
									}}
									tabindex={header.column.getCanSort() ? 0 : -1}
									aria-label={header.column.getCanSort()
										? `Sort by ${header.column.columnDef.header}, currently ${
												header.column.getIsSorted() === 'asc'
													? 'ascending'
													: header.column.getIsSorted() === 'desc'
														? 'descending'
														: 'unsorted'
											}`
										: String(header.column.columnDef.header)}
								>
									<span class="break-words">
										<svelte:component
											this={flexRender(header.column.columnDef.header, header.getContext())}
										/>
									</span>
									{#if header.column.id === 'total'}
										<button
											bind:this={totalTooltip}
											type="button"
											class="ml-1 cursor-default"
											aria-label="Information about total locations"
										>
											<Icon type="fa" icon="circle-info" w="14" h="14" style="text-sm" />
										</button>
									{:else if header.column.id === 'upToDateElements'}
										<button
											bind:this={upToDateTooltip}
											type="button"
											class="ml-1 cursor-default"
											aria-label="Information about verified locations"
										>
											<Icon type="fa" icon="circle-info" w="14" h="14" style="text-sm" />
										</button>
									{:else if header.column.id === 'grade'}
										<button
											bind:this={gradeTooltip}
											type="button"
											class="ml-1 cursor-default"
											aria-label="Information about Grade metric"
										>
											<Icon type="fa" icon="circle-info" w="14" h="14" style="text-sm" />
										</button>
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
					{#each row.getVisibleCells() as cell (cell.id)}
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
									avatar={type === 'community'
										? cell.row.original.tags?.['icon:square'] || ''
										: `https://static.btcmap.org/images/countries/${cell.row.original.id}.svg`}
									name={cell.row.original.tags?.name || 'Unknown'}
									id={cell.row.original.tags?.url_alias || cell.row.original.id || ''}
								/>
							{:else if cell.column.id === 'grade'}
								{@const grade = cell.row.original.grade || 0}
								{@const percentage = cell.row.original.report?.tags?.up_to_date_percent}
								{@const avgDate = cell.row.original.report?.tags?.avg_verification_date}
								<GradeDisplay {grade} {percentage} {avgDate} size="large" />
							{:else}
								<svelte:component
									this={flexRender(cell.column.columnDef.cell, cell.getContext())}
								/>
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

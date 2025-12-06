<script lang="ts">
	import type { Table } from '@tanstack/svelte-table';
	import { flexRender } from '@tanstack/svelte-table';
	import { resolve } from '$app/paths';
	import type { TaggerLeaderboard } from '$lib/types';
	import { isEven } from '$lib/utils';
	import Tip from '$components/Tip.svelte';

	type TaggerRow = TaggerLeaderboard & {
		position: number;
		tipDestination?: string;
	};

	export let table: Table<TaggerRow>;
</script>

<div class="hidden lg:block" role="region" aria-label="Tagger leaderboard table">
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
										? 'Sort by ' +
											header.column.columnDef.header +
											', currently ' +
											(header.column.getIsSorted() === 'asc'
												? 'ascending'
												: header.column.getIsSorted() === 'desc'
													? 'descending'
													: 'unsorted')
										: String(header.column.columnDef.header)}
								>
									<span class="break-words">
										<svelte:component
											this={flexRender(header.column.columnDef.header, header.getContext())}
										/>
									</span>
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
										on:error={(event) => {
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
									<Tip destination={row.original.tipDestination} style="mx-auto block" />
								{/if}
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

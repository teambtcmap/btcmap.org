<script lang="ts">
import type { ColumnDef } from "@tanstack/svelte-table";
import { createTable, FlexRender } from "@tanstack/svelte-table";
import { format } from "date-fns/format";
import { untrack } from "svelte";

import LeaderboardPagination from "$components/leaderboard/LeaderboardPagination.svelte";
import LeaderboardSearch from "$components/leaderboard/LeaderboardSearch.svelte";
import { _ } from "$lib/i18n";
import type { BtcmapTableFeatures } from "$lib/tableFeatures";
import { btcmapTableFeatures } from "$lib/tableFeatures";
import type { ActivityEvent } from "$lib/types";
import { debounce } from "$lib/utils";

import { resolve } from "$app/paths";

type Props = {
	eventElements?: ActivityEvent[];
	username: string;
	dataInitialized?: boolean;
	loadingNames?: boolean;
	onfetchNames?: (data: { events: ActivityEvent[] }) => void;
};

let {
	eventElements = [],
	username,
	dataInitialized = false,
	loadingNames = false,
	onfetchNames = () => {},
}: Props = $props();

const pageSizes = [10, 20, 30, 40, 50];
let globalFilter = $state("");

const columns: ColumnDef<BtcmapTableFeatures, ActivityEvent>[] = [
	{
		id: "location",
		header: () => $_(`profileActivity.location`),
		accessorFn: (row) => row.location,
		enableSorting: false,
		filterFn: "fuzzy",
		enableGlobalFilter: true,
	},
	{
		id: "type",
		header: () => $_(`profileActivity.action`),
		accessorFn: (row) => row.type,
		enableSorting: true,
		filterFn: "fuzzy",
		enableGlobalFilter: true,
	},
	{
		id: "created_at",
		header: () => $_(`profileActivity.date`),
		accessorFn: (row) => row.created_at,
		enableSorting: true,
		filterFn: "fuzzy",
		enableGlobalFilter: true,
	},
];

const table = createTable({
	features: btcmapTableFeatures,
	columns,
	get data() {
		return eventElements;
	},
	initialState: {
		pagination: { pageIndex: 0, pageSize: pageSizes[0] },
		sorting: [{ id: "created_at", desc: true }],
	},
	globalFilterFn: "fuzzy",
});

const pagination = $derived(table.atoms.pagination.get());

const fetchPageNames = (events: ActivityEvent[]) => {
	if (loadingNames) return;

	onfetchNames({ events });
};

// Ask the parent to resolve merchant names for the rows currently in the
// row model. untrack() keeps the dependency set to the row model +
// dataInitialized only — loadingNames is read inside fetchPageNames and
// must not re-trigger this effect when the parent toggles it.
$effect(() => {
	if (table.getRowModel().rows.length > 0 && dataInitialized) {
		const currentPageEvents = table
			.getRowModel()
			.rows.map((row) => row.original);
		untrack(() => fetchPageNames(currentPageEvents));
	}
});

const handleKeyUp = (e: KeyboardEvent) => {
	table.setGlobalFilter(String((e.target as HTMLInputElement)?.value));
};

const searchDebounce = debounce((e) => handleKeyUp(e));
</script>

<div class="w-full rounded-3xl border border-gray-300 dark:border-white/95 dark:bg-white/10">
	<h3
		class="border-b border-gray-300 p-5 text-center text-lg font-semibold text-primary md:text-left dark:border-white/95 dark:text-white"
	>
		{$_('profileActivity.activityTitle', { values: { name: username || $_('taggerProfile.defaultName') } })}
	</h3>

	{#if eventElements && eventElements.length && dataInitialized}
		<div class="p-5">
			<LeaderboardSearch {table} bind:globalFilter {searchDebounce} />
		</div>

		{#if table.getFilteredRowModel().rows.length === 0}
			<p class="w-full p-5 text-center text-primary dark:text-white">{$_('profileActivity.noResults')}</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead>
						{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
							<tr class="border-b border-gray-300 text-left dark:border-white/95">
								{#each headerGroup.headers as header (header.id)}
									<th
										colSpan={header.colSpan}
										class="px-5 py-3 text-left text-sm font-semibold text-primary dark:text-white {header
											.column.id === 'location'
											? 'w-2/3'
											: 'w-1/6'}"
										aria-sort={header.column.getIsSorted() === 'asc'
											? 'ascending'
											: header.column.getIsSorted() === 'desc'
												? 'descending'
												: 'none'}
									>
										{#if !header.isPlaceholder}
											{@const headerLabel =
												typeof header.column.columnDef.header === 'function'
													? String(header.column.columnDef.header(header.getContext()))
													: String(header.column.columnDef.header)}
											<button
												type="button"
												class="flex items-center gap-x-1 leading-tight select-none"
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
						{#if loadingNames}
							<!-- Show loading skeleton rows while fetching names -->
							{#each Array(pagination.pageSize) as _, i (i)}
								<tr class="border-b border-gray-300/50 dark:border-white/50">
									<td class="w-2/3 px-5 py-3">
										<div class="h-6 animate-pulse rounded bg-link/20"></div>
									</td>
									<td class="w-1/6 px-5 py-3">
										<div class="h-6 animate-pulse rounded bg-link/20"></div>
									</td>
									<td class="w-1/6 px-5 py-3">
										<div class="h-6 animate-pulse rounded bg-link/20"></div>
									</td>
								</tr>
							{/each}
						{:else}
							{#each table.getRowModel().rows as row, _ (row.id)}
								<tr
									class="border-b border-gray-300/50 hover:bg-gray-50 dark:border-white/50 dark:hover:bg-white/5"
								>
									{#each row.getAllCells() as cell (cell.id)}
										<td
											class="px-5 py-3 text-left text-sm text-body dark:text-white {cell.column
												.id === 'location'
												? 'w-2/3'
												: 'w-1/6'}"
										>
											{#if cell.column.id === 'location'}
												<a
													href={resolve(`/merchant/${row.original.merchantId}`)}
													class="text-link transition-colors hover:text-hover"
												>
													{row.original.location}
												</a>
											{:else if cell.column.id === 'type'}
												<span
													class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium
												{row.original.type === 'create'
														? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
														: row.original.type === 'update'
															? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
															: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}"
												>
													{row.original.type}
												</span>
											{:else}
												{format(new Date(row.original.created_at), 'MMM d, yyyy HH:mm')}
											{/if}
										</td>
									{/each}
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>

			<LeaderboardPagination {table} {pageSizes} />
		{/if}
	{:else}
		<div class="p-5">
			{#each Array(10) as _, i (i)}
				<div class="mb-3 animate-pulse">
					<div class="flex space-x-4">
						<div class="h-4 w-2/3 rounded bg-link/20"></div>
						<div class="h-4 w-1/6 rounded bg-link/20"></div>
						<div class="h-4 w-1/6 rounded bg-link/20"></div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<script lang="ts">
	import {
		createSvelteTable,
		getCoreRowModel,
		getSortedRowModel,
		getPaginationRowModel,
		getFilteredRowModel,
		flexRender,
		type ColumnDef,
		type TableOptions,
		type SortingState,
		type PaginationState,
		type OnChangeFn,
		type Table,
		type FilterFn
	} from '@tanstack/svelte-table';
	import { writable, derived, type Readable } from 'svelte/store';
	import { onDestroy } from 'svelte';
	import { areaError, areas, reportError, reports, syncStatus, theme } from '$lib/store';
	import type { AreaType, LeaderboardArea, Report } from '$lib/types';
	import {
		errToast,
		getGrade,
		validateContinents,
		detectTheme,
		debounce,
		isEven
	} from '$lib/utils';
	import AreaLeaderboardItemName from './AreaLeaderboardItemName.svelte';
	import { rankItem } from '@tanstack/match-sorter-utils';

	export let type: AreaType;
	export let initialPageSize = 10;

	let table: Readable<Table<LeaderboardArea & { position: number }>> | undefined;
	let tableRendered = false;

	const pageSizes = [10, 20, 30, 40, 50];
	let globalFilter = '';
	let searchInput: HTMLInputElement;

	// Alert for errors - more idiomatic Svelte
	$: if ($areaError) errToast($areaError);
	$: if ($reportError) errToast($reportError);

	// More idiomatic Svelte using derived stores
	const areasFiltered = derived([areas, reports], ([$areas, $reports]) => {
		if (!$reports?.length) return [];

		return $areas.filter((area) => {
			if (type === 'community') {
				return (
					area.tags.type === 'community' &&
					area.tags.geo_json &&
					area.tags.name &&
					area.tags['icon:square'] &&
					area.tags.continent &&
					Object.keys(area.tags).find((key) => key.includes('contact')) &&
					$reports.find((report) => report.area_id === area.id)
				);
			} else {
				return (
					area.tags.type === 'country' &&
					area.id.length === 2 &&
					area.tags.geo_json &&
					area.tags.name &&
					area.tags.continent &&
					validateContinents(area.tags.continent)
				);
			}
		});
	});

	const areaReports = derived([areasFiltered, reports], ([$areasFiltered, $reports]) => {
		if (!$areasFiltered?.length || !$reports?.length) return [];

		return $reports
			.filter((report) => $areasFiltered.find((area) => area.id === report.area_id))
			.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
	});

	// Scoring function for leaderboard
	const score = (report: Report): number => {
		return Math.max(report.tags.total_elements - report.tags.outdated_elements * 5, 0);
	};

	// Derived store for leaderboard data
	const leaderboard = derived(
		[areasFiltered, areaReports, syncStatus],
		([$areasFiltered, $areaReports, $syncStatus]) => {
			if (!$areasFiltered.length || !$areaReports.length || $syncStatus) {
				return [];
			}

			const result: LeaderboardArea[] = [];

			$areasFiltered.forEach((area) => {
				const areaReport = $areaReports.find((report) => report.area_id === area.id);

				if (areaReport) {
					const grade = getGrade(areaReport.tags.up_to_date_percent);
					result.push({ ...area, report: areaReport, grade });
				}
			});

			// Apply the same sorting logic as the original component
			return result.sort((a, b) => {
				const aScore = score(a.report);
				const bScore = score(b.report);

				// Primary sort: by score (descending - higher scores first)
				if (bScore !== aScore) {
					return bScore - aScore;
				}

				// Secondary sort: by total elements (descending - more locations first)
				return b.report.tags.total_elements - a.report.tags.total_elements;
			});
		}
	);

	// Create a derived store for leaderboard with positions
	const leaderboardWithPositions = derived(leaderboard, ($leaderboard) => {
		return $leaderboard.map((item, index) => ({
			...item,
			position: index + 1 // Position based on sorted order
		}));
	});

	// Search handlers
	const handleKeyUp = (e: KeyboardEvent) => {
		$table?.setGlobalFilter(String((e.target as HTMLInputElement)?.value));
	};

	const searchDebounce = debounce((e) => handleKeyUp(e));

	// Fuzzy filter for global search
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
		const itemRank = rankItem(row.getValue(columnId), value);
		addMeta({ itemRank });
		return itemRank.passed;
	};

	// Loading state with better logic
	$: loading =
		$syncStatus || ($leaderboardWithPositions.length === 0 && !$areaError && !$reportError);

	const renderTable = () => {
		const data = $leaderboardWithPositions;

		// Move column definitions
		const columns: ColumnDef<LeaderboardArea & { position: number }>[] = [
			{
				id: 'position',
				header: 'Position',
				accessorFn: (row) => row.position,
				cell: (info) => {
					const position = info.getValue() as number;
					if (position === 1) return '🥇';
					if (position === 2) return '🥈';
					if (position === 3) return '🥉';
					return position.toString();
				},
				enableSorting: true,
				enableGlobalFilter: false,
				sortingFn: (a, b) => {
					return a.original.position - b.original.position;
				}
			},
			{
				id: 'name',
				header: 'Name',
				accessorFn: (row) => row.tags?.name || 'Unknown',
				cell: (info) => info.row.original,
				enableSorting: true,
				// @ts-expect-error
				filterFn: 'fuzzy',
				enableGlobalFilter: true
			},
			{
				id: 'upToDate',
				header: 'Up-To-Date',
				accessorFn: (row) => row.report?.tags?.up_to_date_percent || 0,
				cell: (info) => `${info.getValue()}%`,
				enableSorting: true,
				enableGlobalFilter: false
			},
			{
				id: 'total',
				header: 'Total Locations',
				accessorFn: (row) => row.report?.tags?.total_elements || 0,
				enableSorting: true,
				enableGlobalFilter: false
			},
			{
				id: 'grade',
				header: 'Grade',
				accessorFn: (row) => row.grade || 0,
				cell: (info) => info.getValue(),
				sortingFn: (a, b) => {
					const aGrade = a.original.grade || 0;
					const bGrade = b.original.grade || 0;
					return bGrade - aGrade;
				},
				enableSorting: true,
				enableGlobalFilter: false
			}
		];

		let sorting: SortingState = [{ id: 'position', desc: false }];

		const setSorting: OnChangeFn<SortingState> = (updater) => {
			if (updater instanceof Function) {
				sorting = updater(sorting);
			} else {
				sorting = updater;
			}
			options.update((old) => ({
				...old,
				state: {
					...old.state,
					sorting
				}
			}));
		};

		let pagination: PaginationState = {
			pageIndex: 0,
			pageSize: initialPageSize
		};

		const setPagination: OnChangeFn<PaginationState> = (updater) => {
			if (updater instanceof Function) {
				pagination = updater(pagination);
			} else {
				pagination = updater;
			}
			options.update((old) => ({
				...old,
				state: {
					...old.state,
					pagination
				}
			}));
		};

		const options = writable<TableOptions<LeaderboardArea & { position: number }>>({
			data,
			columns,
			state: {
				sorting,
				pagination
			},
			filterFns: {
				fuzzy: fuzzyFilter
			},
			onSortingChange: setSorting,
			onPaginationChange: setPagination,
			globalFilterFn: fuzzyFilter,
			getCoreRowModel: getCoreRowModel(),
			getSortedRowModel: getSortedRowModel(),
			getPaginationRowModel: getPaginationRowModel(),
			getFilteredRowModel: getFilteredRowModel()
		});

		table = createSvelteTable(options);
		tableRendered = true;
	};

	$: !loading && !tableRendered && $leaderboardWithPositions.length > 0 && renderTable();

	// Better lifecycle management
	onDestroy(() => {
		// Cleanup logic if needed
	});
</script>

<section class="p-4" id="leaderboard" aria-labelledby="leaderboard-title">
	<div class="w-full rounded-3xl border border-statBorder bg-white dark:bg-white/10">
		<header>
			<h2
				id="leaderboard-title"
				class="border-b border-statBorder p-5 text-center text-lg font-semibold text-primary dark:text-white md:text-left"
			>
				{type === 'community' ? 'Community' : 'Country'} Leaderboard
				{#if !loading && $leaderboardWithPositions.length > 0}
					({$leaderboardWithPositions.length})
				{/if}
			</h2>
		</header>

		{#if loading}
			<div class="p-5">
				<div
					class="flex h-[572px] w-full animate-pulse items-center justify-center rounded-3xl border border-link/50"
					role="status"
					aria-live="polite"
				>
					<i class="fa-solid fa-table h-24 w-24 animate-pulse text-link/50" />
				</div>
			</div>
		{:else if $leaderboardWithPositions.length === 0}
			<p class="w-full p-5 text-center text-primary dark:text-white">No data available</p>
		{:else if table && $table}
			<!-- Search Input -->
			<div class="relative text-primary dark:text-white">
				<input
					type="text"
					placeholder="Search..."
					class="w-full bg-primary/5 px-5 py-2.5 text-sm focus:outline-primary dark:bg-white/5 dark:focus:outline-white"
					bind:value={globalFilter}
					on:keyup={searchDebounce}
					bind:this={searchInput}
					aria-label="Search leaderboard"
				/>
				{#if globalFilter}
					<button
						type="button"
						class="absolute right-3 top-1/2 -translate-y-1/2"
						on:click={() => {
							globalFilter = '';
							$table?.setGlobalFilter('');
						}}
						aria-label="Clear search"
					>
						<i class="fa-solid fa-circle-xmark" />
					</button>
				{:else}
					<button
						type="button"
						class="absolute right-3 top-1/2 -translate-y-1/2"
						on:click={() => {
							searchInput.focus();
						}}
						aria-label="Focus search"
					>
						<i class="fa-solid fa-magnifying-glass" />
					</button>
				{/if}
			</div>

			{#if $table.getFilteredRowModel().rows.length === 0}
				<p class="w-full p-5 text-center text-primary dark:text-white">No results found.</p>
			{:else}
				<!-- Table -->
				<div class="overflow-x-auto" role="region" aria-label="Leaderboard table">
					<table class="w-full whitespace-nowrap text-left text-primary dark:text-white">
						<thead>
							{#each $table.getHeaderGroups() as headerGroup}
								<tr>
									{#each headerGroup.headers as header}
										<th
											colSpan={header.colSpan}
											class="px-5 pb-2.5 pt-5"
											aria-sort={header.column.getIsSorted() === 'asc'
												? 'ascending'
												: header.column.getIsSorted() === 'desc'
													? 'descending'
													: 'none'}
										>
											{#if !header.isPlaceholder}
												<button
													type="button"
													class="flex select-none items-center gap-x-2"
													class:cursor-pointer={header.column.getCanSort()}
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
													<svelte:component
														this={flexRender(header.column.columnDef.header, header.getContext())}
													/>
													{#if header.column.getIsSorted().toString() === 'asc'}
														<svg
															xmlns="http://www.w3.org/2000/svg"
															viewBox="0 0 320 512"
															fill="currentColor"
															class="w-2"
															aria-hidden="true"
														>
															<path
																d="M182.6 137.4c-12.5-12.5-32.8-12.5-45.3 0l-128 128c-9.2 9.2-11.9-22.9-6.9-34.9s16.6-19.8 29.6-19.8H288c12.9 0 24.6-7.8 29.6-19.8s2.2-25.7-6.9-34.9l-128-128z"
															/>
														</svg>
													{:else if header.column.getIsSorted().toString() === 'desc'}
														<svg
															xmlns="http://www.w3.org/2000/svg"
															viewBox="0 0 320 512"
															fill="currentColor"
															class="w-2"
															aria-hidden="true"
														>
															<path
																d="M137.4 374.6c12.5 12.5 32.8 12.5 45.3 0l128-128c9.2 9.2-11.9-22.9-6.9-34.9s-16.6-19.8-29.6-19.8L32 192c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l128 128z"
															/>
														</svg>
													{/if}
												</button>
											{/if}
										</th>
									{/each}
								</tr>
							{/each}
						</thead>
						<tbody>
							{#each $table.getRowModel().rows as row, index}
								<tr class={isEven(index) ? 'bg-primary/5 dark:bg-white/5' : ''}>
									{#each row.getVisibleCells() as cell}
										<td
											class="px-5 py-2.5"
											class:text-center={cell.column.id === 'position' ||
												cell.column.id === 'grade'}
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
												{#if grade > 0}
													<div
														class="flex justify-center"
														role="img"
														aria-label="{grade} out of 5 stars"
													>
														{'★'.repeat(grade)}{'☆'.repeat(5 - grade)}
													</div>
												{:else}
													<span>N/A</span>
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

				<!-- Pagination -->
				<div
					class="flex w-full flex-col gap-5 px-5 pb-5 pt-2.5 text-primary dark:text-white md:flex-row md:items-center md:justify-between"
				>
					<select
						value={$table?.getState().pagination.pageSize}
						on:change={(e) => {
							// @ts-expect-error
							$table?.setPageSize(Number(e.target?.value));
						}}
						class="cursor-pointer bg-transparent focus:outline-primary dark:focus:outline-white"
						aria-label="Items per page"
					>
						{#each pageSizes as pageSize}
							<option value={pageSize}>
								Show {pageSize}
							</option>
						{/each}
					</select>

					<div class="flex flex-col gap-5 md:flex-row md:items-center">
						<div class="flex items-center justify-between gap-5 md:justify-start">
							<div class="flex items-center gap-5">
								<button
									type="button"
									class="text-xl font-bold {!$table?.getCanPreviousPage()
										? 'cursor-not-allowed opacity-50'
										: ''}"
									on:click={() => $table?.firstPage()}
									disabled={!$table?.getCanPreviousPage()}
									aria-label="Go to first page"
								>
									&lt;&lt;
								</button>
								<button
									type="button"
									class="text-xl font-bold {!$table?.getCanPreviousPage()
										? 'cursor-not-allowed opacity-50'
										: ''}"
									on:click={() => $table?.previousPage()}
									disabled={!$table?.getCanPreviousPage()}
									aria-label="Go to previous page"
								>
									&lt;
								</button>
							</div>
							<div class="flex items-center gap-5">
								<button
									type="button"
									class="text-xl font-bold {!$table?.getCanNextPage()
										? 'cursor-not-allowed opacity-50'
										: ''}"
									on:click={() => $table?.nextPage()}
									disabled={!$table?.getCanNextPage()}
									aria-label="Go to next page"
								>
									&gt;
								</button>
								<button
									type="button"
									class="text-xl font-bold {!$table?.getCanNextPage()
										? 'cursor-not-allowed opacity-50'
										: ''}"
									on:click={() => $table?.lastPage()}
									disabled={!$table?.getCanNextPage()}
									aria-label="Go to last page"
								>
									&gt;&gt;
								</button>
							</div>
						</div>

						<span
							class="flex items-center justify-center gap-1 md:justify-start"
							aria-live="polite"
						>
							<div>Page</div>
							<strong>
								{$table?.getState().pagination.pageIndex + 1} of
								{$table?.getPageCount().toLocaleString()}
							</strong>
						</span>
					</div>
				</div>
			{/if}

			<!-- Additional info -->
			<footer
				class="border-t border-statBorder px-5 pb-5 pt-2.5 text-center text-sm text-body dark:text-white"
			>
				<p>Data is weighted by Up-To-Date locations and then sorted by Total Locations.</p>
				<p>Leaderboard updated once every 24 hours.</p>
			</footer>
		{/if}
	</div>
</section>

{#if typeof window !== 'undefined'}
	{#if detectTheme() === 'dark' || $theme === 'dark'}
		<style>
			select option {
				--tw-bg-opacity: 1;
				background-color: rgb(55 65 81 / var(--tw-bg-opacity));
			}
		</style>
	{/if}
{/if}

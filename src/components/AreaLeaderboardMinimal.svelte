<script lang="ts">
	import {
		createSvelteTable,
		getCoreRowModel,
		getSortedRowModel,
		getPaginationRowModel,
		type ColumnDef,
		type TableOptions,
		type SortingState,
		type PaginationState
	} from '@tanstack/svelte-table';
	import { writable, derived, type Writable } from 'svelte/store';
	import { onDestroy, onMount } from 'svelte';
	import { areaError, areas, reportError, reports, syncStatus } from '$lib/store';
	import type { Area, AreaType, LeaderboardArea, Report } from '$lib/types';
	import { errToast, getGrade, validateContinents } from '$lib/utils';
	import { GradeTable } from '$lib/comp';
	import AreaLeaderboardItemName from './AreaLeaderboardItemName.svelte';
	import tippy, { type Instance as TippyInstance } from 'tippy.js';

	export let type: AreaType;

	// Tooltip elements and instances with proper typing
	let upToDateTooltip: HTMLButtonElement;
	let gradeTooltip: HTMLButtonElement;
	let upToDateTippyInstance: TippyInstance | null = null;
	let gradeTippyInstance: TippyInstance | null = null;

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

	// Table state with proper typing - default to position ascending to match original
	const sorting: Writable<SortingState> = writable([{ id: 'position', desc: false }]);
	const pagination: Writable<PaginationState> = writable({
		pageIndex: 0,
		pageSize: 10
	});

	// Move column definitions outside reactive context for better performance
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
			enableSorting: true, // Allow sorting by position
			sortingFn: (a, b) => {
				// Sort by position (ascending = best first)
				return a.original.position - b.original.position;
			}
		},
		{
			id: 'name',
			header: 'Name',
			accessorFn: (row) => row.tags?.name || 'Unknown',
			cell: (info) => info.row.original,
			enableSorting: true
		},
		{
			id: 'upToDate',
			header: 'Up-To-Date',
			accessorFn: (row) => row.report?.tags?.up_to_date_percent || 0,
			cell: (info) => `${info.getValue()}%`,
			enableSorting: true
		},
		{
			id: 'total',
			header: 'Total Locations',
			accessorFn: (row) => row.report?.tags?.total_elements || 0,
			enableSorting: true
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
			enableSorting: true
		}
	];

	// Tooltip management with proper cleanup
	const setupTooltips = () => {
		if (upToDateTooltip && !upToDateTippyInstance) {
			upToDateTippyInstance = tippy(upToDateTooltip, {
				content: 'Locations that have been verified within one year.',
				allowHTML: true
			});
		}

		if (gradeTooltip && !gradeTippyInstance) {
			gradeTippyInstance = tippy(gradeTooltip, {
				content: GradeTable,
				allowHTML: true
			});
		}
	};

	const cleanupTooltips = () => {
		upToDateTippyInstance?.destroy();
		gradeTippyInstance?.destroy();
		upToDateTippyInstance = null;
		gradeTippyInstance = null;
	};

	// Better lifecycle management
	onMount(() => {
		// Setup tooltips after mount when elements are available
		setTimeout(setupTooltips, 0);
	});

	onDestroy(cleanupTooltips);

	// Create table options reactively but more efficiently
	$: tableOptions =
		$leaderboardWithPositions.length > 0
			? ({
					data: $leaderboardWithPositions,
					columns,
					state: {
						sorting: $sorting,
						pagination: $pagination
					},
					onSortingChange: (updater) => {
						if (typeof updater === 'function') {
							sorting.update(updater);
						} else {
							sorting.set(updater);
						}
					},
					onPaginationChange: (updater) => {
						if (typeof updater === 'function') {
							pagination.update(updater);
						} else {
							pagination.set(updater);
						}
					},
					getCoreRowModel: getCoreRowModel(),
					getSortedRowModel: getSortedRowModel(),
					getPaginationRowModel: getPaginationRowModel(),
					// Add error handling
					debugTable: false,
					debugHeaders: false,
					debugColumns: false
				} satisfies TableOptions<LeaderboardArea & { position: number }>)
			: null;

	// Create table instance
	$: table = tableOptions ? createSvelteTable(tableOptions) : null;

	// Loading state with better logic
	$: loading =
		$syncStatus || ($leaderboardWithPositions.length === 0 && !$areaError && !$reportError);

	// Create stable key for table recreation - avoid JSON.stringify
	$: sortingKey = $sorting.map((s) => `${s.id}-${s.desc ? 'desc' : 'asc'}`).join('|');
	$: tableKey = `${$leaderboardWithPositions.length}-${sortingKey}`;

	// Setup tooltips when elements are bound
	$: if (upToDateTooltip || gradeTooltip) {
		setupTooltips();
	}
</script>

<section class="p-4" id="leaderboard" aria-labelledby="leaderboard-title">
	<header>
		<h2 id="leaderboard-title" class="mb-4 text-2xl font-bold text-primary dark:text-white">
			{type === 'community' ? 'Community' : 'Country'} Leaderboard
		</h2>
	</header>

	{#if loading}
		<div class="py-8 text-center" role="status" aria-live="polite">
			<p class="text-body dark:text-white">Loading leaderboard...</p>
		</div>
	{:else if $leaderboardWithPositions.length === 0}
		<div class="py-8 text-center">
			<p class="text-body dark:text-white">No data available</p>
		</div>
	{:else if table && $table}
		{#key tableKey}
			<!-- Table -->
			<div class="overflow-x-auto" role="region" aria-label="Leaderboard table">
				<table class="w-full border-collapse border border-gray-300 dark:border-gray-600">
					<thead class="bg-gray-50 dark:bg-gray-800">
						<tr>
							{#each $table.getHeaderGroups() as headerGroup}
								{#each headerGroup.headers as header}
									<th
										class="border border-gray-300 p-3 text-left font-semibold text-primary dark:border-gray-600 dark:text-white"
										class:cursor-pointer={header.column.getCanSort()}
										on:click={header.column.getToggleSortingHandler()}
										on:keydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												header.column.getToggleSortingHandler()?.(e);
											}
										}}
										role={header.column.getCanSort() ? 'button' : 'columnheader'}
										tabindex={header.column.getCanSort() ? 0 : undefined}
										aria-label={header.column.getCanSort()
											? `Sort by ${header.column.columnDef.header}, currently ${
													header.column.getIsSorted() === 'asc'
														? 'ascending'
														: header.column.getIsSorted() === 'desc'
															? 'descending'
															: 'unsorted'
												}`
											: String(header.column.columnDef.header)}
										aria-sort={header.column.getIsSorted() === 'asc'
											? 'ascending'
											: header.column.getIsSorted() === 'desc'
												? 'descending'
												: 'none'}
									>
										<div class="flex items-center gap-2">
											<span>{header.column.columnDef.header}</span>

											<!-- Tooltip buttons -->
											{#if header.column.id === 'upToDate'}
												<button
													bind:this={upToDateTooltip}
													type="button"
													class="text-sm hover:text-hover focus:outline-none focus:ring-2 focus:ring-primary"
													aria-label="Information about Up-To-Date metric"
												>
													<i class="fa-solid fa-circle-info" aria-hidden="true" />
												</button>
											{:else if header.column.id === 'grade'}
												<button
													bind:this={gradeTooltip}
													type="button"
													class="text-sm hover:text-hover focus:outline-none focus:ring-2 focus:ring-primary"
													aria-label="Information about Grade metric"
												>
													<i class="fa-solid fa-circle-info" aria-hidden="true" />
												</button>
											{/if}

											<!-- Sort indicator -->
											{#if header.column.getCanSort()}
												{#if header.column.getIsSorted() === 'asc'}
													<i class="fa-solid fa-sort-up text-xs" aria-hidden="true" />
												{:else if header.column.getIsSorted() === 'desc'}
													<i class="fa-solid fa-sort-down text-xs" aria-hidden="true" />
												{:else}
													<i class="fa-solid fa-sort text-xs opacity-50" aria-hidden="true" />
												{/if}
											{/if}
										</div>
									</th>
								{/each}
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each $table.getRowModel().rows as row}
							<tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
								{#each row.getVisibleCells() as cell}
									<td
										class="border border-gray-300 p-3 text-body dark:border-gray-600 dark:text-white"
										class:text-center={cell.column.id === 'position' || cell.column.id === 'grade'}
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
													class="flex justify-center space-x-1"
													role="img"
													aria-label="{grade} out of 5 stars"
												>
													{#each Array(grade) as _}
														<i class="fa-solid fa-star" aria-hidden="true" />
													{/each}
													{#each Array(5 - grade) as _}
														<i class="fa-solid fa-star opacity-25" aria-hidden="true" />
													{/each}
												</div>
											{:else}
												<span>N/A</span>
											{/if}
										{:else}
											{cell.getValue()}
										{/if}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/key}

		<!-- Pagination -->
		<nav class="mt-6 flex items-center justify-between" aria-label="Table pagination">
			<div class="flex items-center gap-4">
				<button
					type="button"
					on:click={() => $table.previousPage()}
					disabled={!$table.getCanPreviousPage()}
					class="rounded bg-primary px-4 py-2 text-white transition-colors hover:bg-hover focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-gray-300 disabled:dark:bg-gray-600"
					aria-label="Go to previous page"
				>
					Previous
				</button>

				<span class="text-body dark:text-white" aria-live="polite">
					Page {$table.getState().pagination.pageIndex + 1} of {$table.getPageCount()}
				</span>

				<button
					type="button"
					on:click={() => $table.nextPage()}
					disabled={!$table.getCanNextPage()}
					class="rounded bg-primary px-4 py-2 text-white transition-colors hover:bg-hover focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-gray-300 disabled:dark:bg-gray-600"
					aria-label="Go to next page"
				>
					Next
				</button>
			</div>

			<div class="text-sm text-body dark:text-white" aria-live="polite">
				Showing {$table.getRowModel().rows.length} of {$leaderboardWithPositions.length} results
			</div>
		</nav>

		<!-- Additional info -->
		<footer class="mt-4 text-center text-sm text-body dark:text-white">
			<p>Data is weighted by Up-To-Date locations and then sorted by Total Locations.</p>
			<p>Leaderboard updated once every 24 hours.</p>
		</footer>
	{/if}
</section>

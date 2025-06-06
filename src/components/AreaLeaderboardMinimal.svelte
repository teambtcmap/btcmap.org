<script lang="ts">
	import {
		createSvelteTable,
		getCoreRowModel,
		getSortedRowModel,
		getPaginationRowModel,
		type ColumnDef,
		type TableOptions
	} from '@tanstack/svelte-table';
	import { writable, derived } from 'svelte/store';
	import { areaError, areas, reportError, reports, syncStatus } from '$lib/store';
	import type { Area, AreaType, LeaderboardArea, Report } from '$lib/types';
	import { errToast, getGrade, validateContinents } from '$lib/utils';
	import { GradeTable } from '$lib/comp';
	import AreaLeaderboardItemName from './AreaLeaderboardItemName.svelte';
	import tippy from 'tippy.js';

	export let type: AreaType;

	// Tooltip elements
	let upToDateTooltip: HTMLButtonElement;
	let gradeTooltip: HTMLButtonElement;

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

			// Use same sorting logic as original
			return result.sort((a, b) => {
				const aScore = score(a.report);
				const bScore = score(b.report);

				if (bScore === aScore) {
					return b.report.tags.total_elements - a.report.tags.total_elements;
				} else {
					return bScore - aScore;
				}
			});
		}
	);

	// Loading state
	$: loading = $syncStatus || $leaderboard.length === 0;

	// Column definitions
	const columns: ColumnDef<LeaderboardArea>[] = [
		{
			id: 'position',
			header: 'Position',
			accessorFn: (row) => {
				// Use the weighted score as the accessor for sorting
				return score(row.report);
			},
			cell: (info) => {
				const table = info.table;
				const pageIndex = table.getState().pagination.pageIndex;
				const pageSize = table.getState().pagination.pageSize;
				const position = pageIndex * pageSize + info.row.index + 1;

				// Apply medal icons for top 3 positions, same as original
				if (position === 1) {
					return '🥇';
				} else if (position === 2) {
					return '🥈';
				} else if (position === 3) {
					return '🥉';
				} else {
					return position.toString();
				}
			},
			sortingFn: (a, b) => {
				// Sort by weighted score (same as original leaderboard logic)
				const aScore = score(a.original.report);
				const bScore = score(b.original.report);

				if (bScore === aScore) {
					// Tiebreaker: total elements (descending)
					return b.original.report.tags.total_elements - a.original.report.tags.total_elements;
				}
				// Primary sort: score (descending)
				return bScore - aScore;
			},
			enableSorting: true
		},
		{
			id: 'name',
			header: 'Name',
			accessorFn: (row) => row.tags?.name || 'Unknown',
			cell: (info) => {
				// Return the complete row object for the Svelte component
				return info.row.original;
			},
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
			cell: (info) => {
				const grade = info.getValue() as number;
				if (!grade) return 'N/A';

				// Return object to indicate we need custom rendering
				return { grade, isCustom: true };
			},
			sortingFn: (a, b) => {
				const aGrade = a.original.grade || 0;
				const bGrade = b.original.grade || 0;
				return bGrade - aGrade;
			},
			enableSorting: true
		}
	];

	// Tooltip setup function
	const setTooltips = () => {
		if (upToDateTooltip && gradeTooltip) {
			tippy(upToDateTooltip, {
				content: 'Locations that have been verified within one year.',
				allowHTML: true
			});

			tippy(gradeTooltip, {
				content: GradeTable,
				allowHTML: true
			});
		}
	};

	// Set up tooltips when elements are ready
	$: if (upToDateTooltip && gradeTooltip) {
		setTooltips();
	}

	// Writable stores for table state
	let sorting = writable([{ id: 'position', desc: false }]);
	let pagination = writable({
		pageIndex: 0,
		pageSize: 10
	});

	// Reactive table options
	$: options = {
		data: $leaderboard,
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
		getPaginationRowModel: getPaginationRowModel()
	} satisfies TableOptions<LeaderboardArea>;

	$: table = createSvelteTable(options);
</script>

<section class="p-4" id="leaderboard">
	<header>
		<h2 class="mb-4 text-2xl font-bold text-primary dark:text-white">
			{type === 'community' ? 'Community' : 'Country'} Leaderboard
		</h2>
	</header>

	{#if loading}
		<div class="py-8 text-center" role="status" aria-live="polite">
			<p class="text-body dark:text-white">Loading leaderboard...</p>
		</div>
	{:else if $leaderboard.length === 0}
		<div class="py-8 text-center">
			<p class="text-body dark:text-white">No data available</p>
		</div>
	{:else}
		<!-- Table -->
		<div class="overflow-x-auto">
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
									role={header.column.getCanSort() ? 'button' : undefined}
									tabindex={header.column.getCanSort() ? 0 : undefined}
									aria-label={header.column.getCanSort()
										? `Sort by ${header.column.columnDef.header}`
										: undefined}
								>
									<div class="flex items-center gap-2">
										<span>
											{header.column.columnDef.header}
										</span>

										<!-- Add tooltip buttons for specific columns -->
										{#if header.column.id === 'upToDate'}
											<button
												bind:this={upToDateTooltip}
												type="button"
												class="text-sm hover:text-hover"
												aria-label="Information about Up-To-Date metric"
											>
												<i class="fa-solid fa-circle-info" />
											</button>
										{:else if header.column.id === 'grade'}
											<button
												bind:this={gradeTooltip}
												type="button"
												class="text-sm hover:text-hover"
												aria-label="Information about Grade metric"
											>
												<i class="fa-solid fa-circle-info" />
											</button>
										{/if}

										<!-- Sort indicator -->
										{#if header.column.getCanSort()}
											{#if header.column.getIsSorted() === 'asc'}
												<i class="fa-solid fa-sort-up text-xs" />
											{:else if header.column.getIsSorted() === 'desc'}
												<i class="fa-solid fa-sort-down text-xs" />
											{:else}
												<i class="fa-solid fa-sort text-xs opacity-50" />
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
											<div class="space-x-1">
												<!-- Filled stars -->
												{#each Array(grade) as _}
													<i class="fa-solid fa-star" aria-hidden="true" />
												{/each}
												<!-- Empty stars -->
												{#each Array(5 - grade) as _}
													<i class="fa-solid fa-star opacity-25" aria-hidden="true" />
												{/each}
											</div>
										{:else}
											<span>N/A</span>
										{/if}
									{:else if typeof cell.column.columnDef.cell === 'function'}
										{cell.column.columnDef.cell(cell.getContext())}
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

		<!-- Pagination -->
		<nav class="mt-6 flex items-center justify-between" aria-label="Table pagination">
			<div class="flex items-center gap-4">
				<button
					type="button"
					on:click={() => $table.previousPage()}
					disabled={!$table.getCanPreviousPage()}
					class="rounded bg-primary px-4 py-2 text-white transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:bg-gray-300 disabled:dark:bg-gray-600"
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
					class="rounded bg-primary px-4 py-2 text-white transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:bg-gray-300 disabled:dark:bg-gray-600"
					aria-label="Go to next page"
				>
					Next
				</button>
			</div>

			<div class="text-sm text-body dark:text-white" aria-live="polite">
				Showing {$table.getRowModel().rows.length} of {$leaderboard.length} results
			</div>
		</nav>

		<!-- Additional info -->
		<footer class="mt-4 text-center text-sm text-body dark:text-white">
			<p>*Data is weighted by Up-To-Date locations and then sorted by Total Locations.</p>
			<p>*Leaderboard updated once every 24 hours.</p>
		</footer>
	{/if}
</section>

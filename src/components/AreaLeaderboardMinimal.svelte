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
		type FilterFn
	} from '@tanstack/svelte-table';
	import { writable, derived } from 'svelte/store';
	import { onDestroy, onMount } from 'svelte';
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
	import tippy from 'tippy.js';
	import type { Instance } from 'tippy.js';
	import { GradeTable } from '$lib/comp';

	export let type: AreaType;
	export let initialPageSize = 10;

	const pageSizes = [10, 20, 30, 40, 50];
	let globalFilter = '';
	let searchInput: HTMLInputElement;

	// Tooltip references for header tooltips only
	let totalTooltip: HTMLButtonElement;
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

	// Fuzzy filter for global search
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
		const itemRank = rankItem(row.getValue(columnId), value);
		addMeta({ itemRank });
		return itemRank.passed;
	};

	// Column definitions - static, defined once
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
			// @ts-expect-error TanStack table expects string literal for filterFn but we're using custom fuzzy filter
			filterFn: 'fuzzy',
			enableGlobalFilter: true
		},
		{
			id: 'total',
			header: 'Total Locations',
			accessorFn: (row) => row.report?.tags?.total_elements || 0,
			enableSorting: true,
			enableGlobalFilter: false
		},
		{
			id: 'upToDateElements',
			header: 'Verified Locations',
			accessorFn: (row) => row.report?.tags?.up_to_date_elements || 0,
			enableSorting: true,
			enableGlobalFilter: false
		},
		{
			id: 'grade',
			header: () => {
				return `Grade`;
			},
			accessorFn: (row) => row.grade || 0,
			cell: (info) => info.getValue(),
			sortingFn: (a, b) => {
				const aGrade = a.original.grade || 0;
				const bGrade = b.original.grade || 0;

				// Primary sort: by grade (descending - higher grades first)
				if (bGrade !== aGrade) {
					return bGrade - aGrade;
				}

				// Secondary sort: by up_to_date_percent (descending - higher percentages first)
				const aPercent = a.original.report?.tags?.up_to_date_percent || 0;
				const bPercent = b.original.report?.tags?.up_to_date_percent || 0;
				return bPercent - aPercent;
			},
			enableSorting: true,
			enableGlobalFilter: false
		}
	];

	// Table state - initialized once
	let sorting: SortingState = [{ id: 'position', desc: false }];
	let pagination: PaginationState = {
		pageIndex: 0,
		pageSize: initialPageSize
	};

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

	// Table options store - created once
	const options = writable<TableOptions<LeaderboardArea & { position: number }>>({
		data: [], // Start with empty data
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

	// Create table instance once
	const table = createSvelteTable(options);

	// Update only data reactively, not entire table
	$: if ($leaderboardWithPositions) {
		options.update((current) => ({
			...current,
			data: $leaderboardWithPositions
		}));
	}

	// Search handlers
	const handleKeyUp = (e: KeyboardEvent) => {
		$table?.setGlobalFilter(String((e.target as HTMLInputElement)?.value));
	};

	const searchDebounce = debounce((e) => handleKeyUp(e));

	// Loading state
	$: loading =
		$syncStatus || ($leaderboardWithPositions.length === 0 && !$areaError && !$reportError);

	// Better lifecycle management
	onMount(() => {
		setHeaderTooltips();
	});

	onDestroy(() => {
		// Cleanup will be handled by the action
	});

	// Simplified tooltip setup function for header tooltips only
	const setHeaderTooltips = () => {
		if (totalTooltip) {
			tippy(totalTooltip, {
				content: 'All locations inc. ATMS',
				allowHTML: true
			});
		}

		if (upToDateTooltip) {
			tippy(upToDateTooltip, {
				content: 'Locations verified within the past year',
				allowHTML: true
			});
		}

		if (gradeTooltip) {
			tippy(gradeTooltip, {
				content: GradeTable,
				allowHTML: true
			});
		}
	};

	// Svelte action for grade tooltips - more idiomatic approach
	function gradeTooltipAction(node: HTMLElement, data: { percentage?: number; avgDate?: string }) {
		let instance: Instance | undefined;

		function setup() {
			if (data.percentage !== undefined) {
				let content = `${data.percentage.toFixed(1)}% up-to-date`;

				if (data.avgDate) {
					const verificationDate = new Date(data.avgDate);
					const now = new Date();
					const diffTime = now.getTime() - verificationDate.getTime();
					const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
					content += `<br>Average verification: ${diffDays} days ago`;
				}

				instance = tippy(node, {
					content,
					allowHTML: true
				});
			}
		}

		function cleanup() {
			if (instance) {
				instance.destroy();
				instance = undefined;
			}
		}

		setup();

		return {
			update(newData: { percentage?: number; avgDate?: string }) {
				cleanup();
				data = newData;
				setup();
			},
			destroy() {
				cleanup();
			}
		};
	}

	// Set header tooltips when elements are available
	$: upToDateTooltip && totalTooltip && gradeTooltip && setHeaderTooltips();
</script>

<section id="leaderboard" aria-labelledby="leaderboard-title">
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
		{:else}
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
				<!-- Mobile: Card layout like the old component but enhanced -->
				<div class="block space-y-1 lg:hidden">
					{#each $table.getRowModel().rows as row, index (row.id)}
						{@const area = row.original}
						{@const position = area.position}
						{@const grade = area.grade || 0}
						{@const percentage = area.report?.tags?.up_to_date_percent}
						{@const avgDate = area.report?.tags?.avg_verification_date}
						{@const totalElements = area.report?.tags?.total_elements || 0}
						{@const upToDateElements = area.report?.tags?.up_to_date_elements || 0}

						<!-- Card layout with better color alignment to desktop table -->
						<div
							class="grid grid-cols-12 items-center gap-3 px-1 py-3 text-center {isEven(index)
								? 'bg-primary/5 dark:bg-white/5'
								: 'bg-white dark:bg-transparent'}"
							role="row"
						>
							<!-- Position (2 columns) - smaller font on mobile -->
							<div class="col-span-2 text-sm">
								{#if position === 1}🥇
								{:else if position === 2}🥈
								{:else if position === 3}🥉
								{:else}
									<span class="text-primary dark:text-white">{position}</span>
								{/if}
							</div>

							<!-- Name (4 columns for more space) - smaller font on mobile -->
							<div class="col-span-4 text-left text-sm">
								<AreaLeaderboardItemName
									{type}
									avatar={type === 'community'
										? area.tags?.['icon:square'] || ''
										: `https://static.btcmap.org/images/countries/${area.id}.svg`}
									name={area.tags?.name || 'Unknown'}
									id={area.tags?.url_alias || area.id || ''}
								/>
							</div>

							<!-- Total Locations (2 columns) -->
							<div class="col-span-2">
								<div class="text-xs text-body dark:text-white/70">Total</div>
								<div class="text-sm font-semibold text-primary dark:text-white">
									{totalElements}
								</div>
							</div>

							<!-- Verified Locations (2 columns) -->
							<div class="col-span-2">
								<div class="text-xs text-body dark:text-white/70">Verified</div>
								<div class="text-sm font-semibold text-primary dark:text-white">
									{upToDateElements}
								</div>
							</div>

							<!-- Grade (2 columns) -->
							<div class="col-span-2">
								<div class="text-xs text-body dark:text-white/70">Grade</div>
								<div class="text-sm">
									{#if grade > 0}
										<div
											class="cursor-help text-primary dark:text-white"
											role="img"
											aria-label="{grade} out of 5 stars, {percentage?.toFixed(1)}% up-to-date"
											use:gradeTooltipAction={{ percentage, avgDate }}
										>
											{grade}/5
										</div>
									{:else}
										<span class="text-primary dark:text-white">N/A</span>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>

				<!-- Desktop: Keep the existing table -->
				<div class="hidden lg:block" role="region" aria-label="Leaderboard table">
					<table
						class="w-full text-left text-xs text-primary dark:text-white lg:text-sm xl:text-lg"
					>
						<thead>
							{#each $table.getHeaderGroups() as headerGroup (headerGroup.id)}
								<tr>
									{#each headerGroup.headers as header (header.id)}
										<th
											colSpan={header.colSpan}
											class="px-2 pb-2.5 pt-5 md:px-5"
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
													class="flex select-none items-center gap-x-1 leading-tight md:gap-x-2"
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
															<i class="fa-solid fa-circle-info text-sm" />
														</button>
													{:else if header.column.id === 'upToDateElements'}
														<button
															bind:this={upToDateTooltip}
															type="button"
															class="ml-1 cursor-default"
															aria-label="Information about verified locations"
														>
															<i class="fa-solid fa-circle-info text-sm" />
														</button>
													{:else if header.column.id === 'grade'}
														<button
															bind:this={gradeTooltip}
															type="button"
															class="ml-1 cursor-default"
															aria-label="Information about Grade metric"
														>
															<i class="fa-solid fa-circle-info text-sm" />
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
							{#each $table.getRowModel().rows as row, index (row.id)}
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
												{#if grade > 0}
													<div
														class="flex cursor-help justify-center"
														role="img"
														aria-label="{grade} out of 5 stars, {percentage?.toFixed(
															1
														)}% up-to-date"
														use:gradeTooltipAction={{ percentage, avgDate }}
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
							// @ts-expect-error Select onChange event target type assertion for page size change
							$table?.setPageSize(Number(e.target?.value));
						}}
						class="cursor-pointer bg-transparent focus:outline-primary dark:focus:outline-white"
						aria-label="Items per page"
					>
						{#each pageSizes as pageSize (pageSize)}
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
			<footer class="border-t border-statBorder px-5 pb-5 pt-2.5 text-sm text-body dark:text-white">
				<p>Position is calculated as follows:</p>

				<ul class="list-inside list-disc">
					<li>Primary: Total locations minus 5x outdated elements.</li>
					<li>Secondary: Total number of locations.</li>
				</ul>

				<p>Locations include ATMs.</p>
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

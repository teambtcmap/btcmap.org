<script lang="ts">
	import {
		createSvelteTable,
		getCoreRowModel,
		getSortedRowModel,
		getPaginationRowModel,
		getFilteredRowModel,
		type ColumnDef,
		type TableOptions,
		type SortingState,
		type PaginationState,
		type OnChangeFn,
		type FilterFn
	} from '@tanstack/svelte-table';
	import { writable, derived } from 'svelte/store';
	import { onMount } from 'svelte';
	import { areaError, areas, reportError, reports, syncStatus, theme } from '$lib/store';
	import type { AreaType, LeaderboardArea, Report } from '$lib/types';
	import { errToast, getGrade, validateContinents, detectTheme, debounce } from '$lib/utils';

	import AreaLeaderboardMobileCard from './AreaLeaderboardMobileCard.svelte';
	import AreaLeaderboardDesktopTable from './AreaLeaderboardDesktopTable.svelte';
	import LeaderboardSearch from './LeaderboardSearch.svelte';
	import LeaderboardPagination from './LeaderboardPagination.svelte';
	import SortHeaderButton from './SortHeaderButton.svelte';
	import { rankItem } from '@tanstack/match-sorter-utils';
	import tippy from 'tippy.js';

	import { GradeTable } from '$lib/comp';

	export let type: AreaType;
	export let initialPageSize = 10;

	const pageSizes = [10, 20, 30, 40, 50];
	let globalFilter = '';

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

	// Set header tooltips when elements are available
	$: upToDateTooltip && totalTooltip && gradeTooltip && setHeaderTooltips();
</script>

<section id="leaderboard" aria-labelledby="leaderboard-title">
	<div
		class="w-full rounded-3xl border border-gray-200 bg-white dark:border-white/95 dark:bg-white/10"
	>
		<header>
			<h2
				id="leaderboard-title"
				class="border-b border-gray-200 p-5 text-center text-lg font-semibold text-primary md:text-left dark:border-white/95 dark:text-white"
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
			<LeaderboardSearch table={$table} bind:globalFilter {searchDebounce} />

			{#if $table.getFilteredRowModel().rows.length === 0}
				<p class="w-full p-5 text-center text-primary dark:text-white">No results found.</p>
			{:else}
				<!-- Mobile: Three-row card layout with sorting headers -->
				<div class="block lg:hidden">
					<!-- Mobile sorting headers -->
					<div class="border-b border-gray-200 bg-primary/5 dark:border-white/95 dark:bg-white/5">
						<div class="grid grid-cols-4 gap-3 px-4 py-3 text-center text-xs">
							<SortHeaderButton
								column={$table?.getColumn('position')}
								label="Position"
								ariaLabel="Sort by position"
							/>

							<SortHeaderButton
								column={$table?.getColumn('total')}
								label="Total"
								ariaLabel="Sort by total locations"
							/>

							<SortHeaderButton
								column={$table?.getColumn('upToDateElements')}
								label="Verified"
								ariaLabel="Sort by verified locations"
							/>

							<SortHeaderButton
								column={$table?.getColumn('grade')}
								label="Grade"
								ariaLabel="Sort by grade"
							/>
						</div>
					</div>

					<AreaLeaderboardMobileCard table={$table} {type} />
				</div>

				<AreaLeaderboardDesktopTable
					table={$table}
					{type}
					bind:totalTooltip
					bind:upToDateTooltip
					bind:gradeTooltip
				/>

				<LeaderboardPagination table={$table} {pageSizes} />
			{/if}

			<footer
				class="border-t border-gray-200 px-5 pt-2.5 pb-5 text-sm text-body dark:border-white/95 dark:text-white"
			>
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

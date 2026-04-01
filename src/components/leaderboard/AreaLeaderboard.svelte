<script lang="ts">
import { rankItem } from "@tanstack/match-sorter-utils";
import {
	type ColumnDef,
	createSvelteTable,
	type FilterFn,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type OnChangeFn,
	type PaginationState,
	type SortingState,
	type TableOptions,
} from "@tanstack/svelte-table";
import { onDestroy, onMount } from "svelte";
import { writable } from "svelte/store";
import { _, locale } from "svelte-i18n";
import tippy from "tippy.js";

import Icon from "$components/Icon.svelte";
import AreaLeaderboardDesktopTable from "$components/leaderboard/AreaLeaderboardDesktopTable.svelte";
import AreaLeaderboardMobileCard from "$components/leaderboard/AreaLeaderboardMobileCard.svelte";
import LeaderboardPagination from "$components/leaderboard/LeaderboardPagination.svelte";
import LeaderboardSearch from "$components/leaderboard/LeaderboardSearch.svelte";
import SortHeaderButton from "$components/leaderboard/SortHeaderButton.svelte";
import { GradeTable } from "$lib/constants";
import { theme } from "$lib/theme";
import type { ApiLeaderboardArea, AreaType } from "$lib/types";
import { debounce, errToast } from "$lib/utils";

export let type: AreaType;
export let initialPageSize = 10;

const pageSizes = [10, 20, 30, 40, 50];
let globalFilter = "";

// Tooltip references for header tooltips only
let totalTooltip: HTMLButtonElement;
let upToDateTooltip: HTMLButtonElement;
let gradeTooltip: HTMLButtonElement;

// Track instances so they can be destroyed on component teardown
let tippyInstances: { destroy(): void }[] = [];

// API data store
const leaderboardData = writable<ApiLeaderboardArea[]>([]);
const loading = writable(true);
const error = writable<string | null>(null);

const fetchLeaderboardData = async () => {
	loading.set(true);
	error.set(null);

	try {
		const endpoint =
			type === "community"
				? "https://api.btcmap.org/v4/communities/top"
				: "https://api.btcmap.org/v4/countries/top";

		const response = await fetch(endpoint);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data: ApiLeaderboardArea[] = await response.json();
		leaderboardData.set(data);
	} catch (e) {
		const message =
			e instanceof Error ? e.message : "Failed to fetch leaderboard data";
		error.set(message);
		errToast(message);
	} finally {
		loading.set(false);
	}
};

onMount(() => {
	fetchLeaderboardData();
});

// Fuzzy filter for global search
const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
	const itemRank = rankItem(row.getValue(columnId), value);
	addMeta({ itemRank });
	return itemRank.passed;
};

// Column definitions - headers use i18n for locale reactivity
const columns: ColumnDef<ApiLeaderboardArea & { position: number }>[] = [
	{
		id: "position",
		header: () => $_(`areaLeaderboard.position`),
		accessorFn: (row) => row.position,
		cell: (info) => {
			const position = info.getValue() as number;
			if (position === 1) return "🥇";
			if (position === 2) return "🥈";
			if (position === 3) return "🥉";
			return position.toString();
		},
		enableSorting: true,
		enableGlobalFilter: false,
		sortingFn: (a, b) => {
			return a.original.position - b.original.position;
		},
	},
	{
		id: "name",
		header: () => $_(`areaLeaderboard.name`),
		accessorFn: (row) => row.name || "Unknown",
		cell: (info) => info.row.original,
		enableSorting: true,
		// @ts-expect-error TanStack table expects string literal for filterFn but we're using custom fuzzy filter
		filterFn: "fuzzy",
		enableGlobalFilter: true,
	},
	{
		id: "total",
		header: () => $_(`areaLeaderboard.totalLocations`),
		accessorFn: (row) => row.places_total || 0,
		enableSorting: true,
		enableGlobalFilter: false,
	},
	{
		id: "upToDateElements",
		header: () => $_(`areaLeaderboard.verifiedLocations`),
		accessorFn: (row) => row.places_verified_1y || 0,
		enableSorting: true,
		enableGlobalFilter: false,
	},
	{
		id: "grade",
		header: () => $_(`areaLeaderboard.grade`),
		accessorFn: (row) => row.grade || 0,
		cell: (info) => info.getValue(),
		sortingFn: (a, b) => {
			const aGrade = a.original.grade || 0;
			const bGrade = b.original.grade || 0;

			// Primary sort: by grade (descending - higher grades first)
			if (bGrade !== aGrade) {
				return bGrade - aGrade;
			}

			// Secondary sort: by places_verified_1y / places_total ratio (descending - higher percentages first)
			const aTotal = a.original.places_total || 0;
			const bTotal = b.original.places_total || 0;
			const aPercent =
				aTotal > 0 ? (a.original.places_verified_1y || 0) / aTotal : 0;
			const bPercent =
				bTotal > 0 ? (b.original.places_verified_1y || 0) / bTotal : 0;
			return bPercent - aPercent;
		},
		enableSorting: true,
		enableGlobalFilter: false,
	},
];

// Table state - initialized once
let sorting: SortingState = [{ id: "position", desc: false }];
let pagination: PaginationState = {
	pageIndex: 0,
	pageSize: initialPageSize,
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
			sorting,
		},
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
			pagination,
		},
	}));
};

// Table options store - created once
const options = writable<
	TableOptions<ApiLeaderboardArea & { position: number }>
>({
	data: [], // Start with empty data
	columns,
	state: {
		sorting,
		pagination,
	},
	filterFns: {
		fuzzy: fuzzyFilter,
	},
	onSortingChange: setSorting,
	onPaginationChange: setPagination,
	globalFilterFn: fuzzyFilter,
	getCoreRowModel: getCoreRowModel(),
	getSortedRowModel: getSortedRowModel(),
	getPaginationRowModel: getPaginationRowModel(),
	getFilteredRowModel: getFilteredRowModel(),
});

// Create table instance once
const table = createSvelteTable(options);

// Update only data reactively with positions, not entire table
$: if ($leaderboardData) {
	const dataWithPosition = $leaderboardData.map((item, index) => ({
		...item,
		position: index + 1,
	}));
	options.update((current) => ({
		...current,
		data: dataWithPosition,
	}));
}

// Search handlers
const handleKeyUp = (e: KeyboardEvent) => {
	$table?.setGlobalFilter(String((e.target as HTMLInputElement)?.value));
};

const searchDebounce = debounce((e) => handleKeyUp(e));

// Simplified tooltip setup function for header tooltips only
const setHeaderTooltips = () => {
	// Destroy any previously created instances before re-creating them
	tippyInstances.forEach((instance) => instance.destroy());
	tippyInstances = [];

	if (totalTooltip) {
		tippyInstances.push(
			tippy(totalTooltip, {
				content: $_(`areaLeaderboard.totalTooltip`),
				allowHTML: true,
			}),
		);
	}

	if (upToDateTooltip) {
		tippyInstances.push(
			tippy(upToDateTooltip, {
				content: $_(`areaLeaderboard.verifiedTooltip`),
				allowHTML: true,
			}),
		);
	}

	if (gradeTooltip) {
		tippyInstances.push(
			tippy(gradeTooltip, {
				content: GradeTable,
				allowHTML: true,
			}),
		);
	}
};

onDestroy(() => {
	tippyInstances.forEach((instance) => instance.destroy());
	tippyInstances = [];
});

// Set header tooltips when elements are available or locale changes
$: upToDateTooltip &&
	totalTooltip &&
	gradeTooltip &&
	$locale &&
	setHeaderTooltips();
</script>

<section id="leaderboard" aria-labelledby="leaderboard-title">
	<div
		class="w-full rounded-3xl border border-gray-300 bg-white dark:border-white/95 dark:bg-white/10"
	>
		<header>
			<h2
				id="leaderboard-title"
				class="border-b border-gray-300 p-5 text-center text-lg font-semibold text-primary md:text-left dark:border-white/95 dark:text-white"
			>
				{type === 'community' ? $_(`areaLeaderboard.communityLeaderboard`) : $_(`areaLeaderboard.countryLeaderboard`)}
				{#if !$loading && $leaderboardData.length > 0}
					({$leaderboardData.length})
				{/if}
			</h2>
		</header>

		{#if $loading}
			<div class="p-5">
				<div
					class="flex h-[572px] w-full animate-pulse items-center justify-center rounded-3xl border border-link/50"
					role="status"
					aria-live="polite"
				>
					<Icon type="fa" icon="table" w="96" h="96" class="animate-pulse text-link/50" />
				</div>
			</div>
		{:else if $leaderboardData.length === 0}
			<p class="w-full p-5 text-center text-primary dark:text-white">{$_(`areaLeaderboard.noData`)}</p>
		{:else}
			<LeaderboardSearch table={$table} bind:globalFilter {searchDebounce} />

			{#if $table.getFilteredRowModel().rows.length === 0}
				<p class="w-full p-5 text-center text-primary dark:text-white">{$_(`areaLeaderboard.noResults`)}</p>
			{:else}
				<!-- Mobile: Three-row card layout with sorting headers -->
				<div class="block lg:hidden">
					<!-- Mobile sorting headers -->
					<div class="border-b border-gray-300 bg-primary/5 dark:border-white/95 dark:bg-white/5">
						<div class="grid grid-cols-4 gap-3 px-4 py-3 text-center text-xs">
							<SortHeaderButton
								column={$table?.getColumn('position')}
								label={$_(`areaLeaderboard.position`)}
								ariaLabel={$_(`areaLeaderboard.sortByPosition`)}
							/>

							<SortHeaderButton
								column={$table?.getColumn('total')}
								label={$_(`areaLeaderboard.totalLocations`)}
								ariaLabel={$_(`areaLeaderboard.sortByTotal`)}
							/>

							<SortHeaderButton
								column={$table?.getColumn('upToDateElements')}
								label={$_(`areaLeaderboard.verifiedLocations`)}
								ariaLabel={$_(`areaLeaderboard.sortByVerified`)}
							/>

							<SortHeaderButton
								column={$table?.getColumn('grade')}
								label={$_(`areaLeaderboard.grade`)}
								ariaLabel={$_(`areaLeaderboard.sortByGrade`)}
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
				class="border-t border-gray-300 px-5 pt-2.5 pb-5 text-sm text-body dark:border-white/95 dark:text-white"
			>
				<p>{$_(`areaLeaderboard.positionCalc`)}</p>

				<ul class="list-inside list-disc">
					<li>{$_(`areaLeaderboard.primaryCalc`)}</li>
					<li>{$_(`areaLeaderboard.secondaryCalc`)}</li>
				</ul>

				<p>{$_(`areaLeaderboard.locationsNote`)}</p>
			</footer>
		{/if}
	</div>
</section>

{#if typeof window !== 'undefined'}
	{#if $theme === 'dark'}
		<style>
			select option {
				--tw-bg-opacity: 1;
				background-color: rgb(55 65 81 / var(--tw-bg-opacity));
			}
		</style>
	{/if}
{/if}

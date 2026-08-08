<script lang="ts">
import type { ColumnDef } from "@tanstack/svelte-table";
import { createTable } from "@tanstack/svelte-table";
import { onDestroy, onMount } from "svelte";
import { _, locale } from "svelte-i18n";
import tippy from "tippy.js";

import Icon from "$components/Icon.svelte";
import AreaLeaderboardDesktopTable from "$components/leaderboard/AreaLeaderboardDesktopTable.svelte";
import AreaLeaderboardMobileCard from "$components/leaderboard/AreaLeaderboardMobileCard.svelte";
import LeaderboardPagination from "$components/leaderboard/LeaderboardPagination.svelte";
import LeaderboardSearch from "$components/leaderboard/LeaderboardSearch.svelte";
import SortHeaderButton from "$components/leaderboard/SortHeaderButton.svelte";
import { API_BASE } from "$lib/api-base";
import { GradeTable } from "$lib/constants";
import type { BtcmapTableFeatures } from "$lib/tableFeatures";
import { btcmapTableFeatures } from "$lib/tableFeatures";
import { theme } from "$lib/theme";
import type {
	ApiLeaderboardArea,
	AreaLeaderboardRow,
	AreaType,
} from "$lib/types";
import { debounce, errToast } from "$lib/utils";

let {
	type,
	initialPageSize = 10,
}: { type: AreaType; initialPageSize?: number } = $props();

const pageSizes = [10, 20, 30, 40, 50];
let globalFilter = $state("");

// Tooltip trigger elements, bound upward from the desktop table's headers
let totalTooltip = $state<HTMLButtonElement>();
let upToDateTooltip = $state<HTMLButtonElement>();
let gradeTooltip = $state<HTMLButtonElement>();

// Track instances so they can be destroyed on component teardown
let tippyInstances: { destroy(): void }[] = [];

let leaderboardData = $state<ApiLeaderboardArea[]>([]);
let loading = $state(true);

const fetchLeaderboardData = async () => {
	loading = true;

	try {
		const endpoint =
			type === "community"
				? `${API_BASE}/v4/communities/top`
				: `${API_BASE}/v4/countries/top`;

		const response = await fetch(endpoint);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data: ApiLeaderboardArea[] = await response.json();
		leaderboardData = data;
	} catch (e) {
		const message =
			e instanceof Error ? e.message : "Failed to fetch leaderboard data";
		errToast(message);
	} finally {
		loading = false;
	}
};

onMount(() => {
	fetchLeaderboardData();
});

// Column definitions - headers are functions so they re-translate on locale
// change without rebuilding the table
const columns: ColumnDef<BtcmapTableFeatures, AreaLeaderboardRow>[] = [
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
		sortFn: (a, b) => {
			return a.original.position - b.original.position;
		},
	},
	{
		id: "name",
		header: () => $_(`areaLeaderboard.name`),
		accessorFn: (row) => row.name || "Unknown",
		cell: (info) => info.row.original,
		enableSorting: true,
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
		sortFn: (a, b) => {
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

// Rows re-derive (with positions) whenever the fetched data lands; the
// table sees them through the getter option below
const rows = $derived(
	leaderboardData.map((item, index) => ({
		...item,
		position: index + 1,
	})),
);

const table = createTable({
	features: btcmapTableFeatures,
	columns,
	get data() {
		return rows;
	},
	initialState: {
		// svelte-ignore state_referenced_locally -- initialState is initial by design
		pagination: { pageIndex: 0, pageSize: initialPageSize },
		sorting: [{ id: "position", desc: false }],
	},
	globalFilterFn: "fuzzy",
});

// Search handlers
const handleKeyUp = (e: KeyboardEvent) => {
	table.setGlobalFilter(String((e.target as HTMLInputElement)?.value));
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
$effect(() => {
	if (upToDateTooltip && totalTooltip && gradeTooltip && $locale) {
		setHeaderTooltips();
	}
});
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
				{#if !loading && leaderboardData.length > 0}
					({leaderboardData.length})
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
					<Icon type="fa" icon="table" w="96" h="96" class="animate-pulse text-link/50" />
				</div>
			</div>
		{:else if leaderboardData.length === 0}
			<p class="w-full p-5 text-center text-primary dark:text-white">{$_(`areaLeaderboard.noData`)}</p>
		{:else}
			<LeaderboardSearch {table} bind:globalFilter {searchDebounce} />

			{#if table.getFilteredRowModel().rows.length === 0}
				<p class="w-full p-5 text-center text-primary dark:text-white">{$_(`areaLeaderboard.noResults`)}</p>
			{:else}
				<!-- Mobile: Three-row card layout with sorting headers -->
				<div class="block lg:hidden">
					<!-- Mobile sorting headers -->
					<div class="border-b border-gray-300 bg-primary/5 dark:border-white/95 dark:bg-white/5">
						<div class="grid grid-cols-4 gap-3 px-4 py-3 text-center text-xs">
							<SortHeaderButton
								column={table.getColumn('position')}
								label={$_(`areaLeaderboard.position`)}
								ariaLabel={$_(`areaLeaderboard.sortByPosition`)}
							/>

							<SortHeaderButton
								column={table.getColumn('total')}
								label={$_(`areaLeaderboard.totalLocations`)}
								ariaLabel={$_(`areaLeaderboard.sortByTotal`)}
							/>

							<SortHeaderButton
								column={table.getColumn('upToDateElements')}
								label={$_(`areaLeaderboard.verifiedLocations`)}
								ariaLabel={$_(`areaLeaderboard.sortByVerified`)}
							/>

							<SortHeaderButton
								column={table.getColumn('grade')}
								label={$_(`areaLeaderboard.grade`)}
								ariaLabel={$_(`areaLeaderboard.sortByGrade`)}
							/>
						</div>
					</div>

					<AreaLeaderboardMobileCard {table} {type} />
				</div>

				<AreaLeaderboardDesktopTable
					{table}
					{type}
					bind:totalTooltip
					bind:upToDateTooltip
					bind:gradeTooltip
				/>

				<LeaderboardPagination {table} {pageSizes} />
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

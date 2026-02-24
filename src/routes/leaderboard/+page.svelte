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
import { get, writable } from "svelte/store";

import FormSelect from "$components/form/FormSelect.svelte";
import Icon from "$components/Icon.svelte";
import LoadingSpinner from "$components/LoadingSpinner.svelte";
import LeaderboardPagination from "$components/leaderboard/LeaderboardPagination.svelte";
import LeaderboardSearch from "$components/leaderboard/LeaderboardSearch.svelte";
import SortHeaderButton from "$components/leaderboard/SortHeaderButton.svelte";
import TaggerLeaderboardDesktopTable from "$components/leaderboard/TaggerLeaderboardDesktopTable.svelte";
import TaggerLeaderboardMobileCard from "$components/leaderboard/TaggerLeaderboardMobileCard.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import { _ } from "$lib/i18n";
import { excludeLeader } from "$lib/store";
import { theme } from "$lib/theme";
import type { RpcGetMostActiveUsersItem, TaggerLeaderboard } from "$lib/types";
import { debounce } from "$lib/utils";

import { goto } from "$app/navigation";
import { page } from "$app/stores";

type TaggerRow = TaggerLeaderboard & {
	position: number;
	tipDestination?: string;
};

type PeriodOption = "3-months" | "6-months" | "12-months" | "all-time";
const DEFAULT_PERIOD: PeriodOption = "12-months";
const DEFAULT_PERIOD_OPTIONS: PeriodOption[] = [
	"3-months",
	"6-months",
	"12-months",
	"all-time",
];

export let data;

const pageSizes = [10, 20, 30, 40, 50];
let loading = true;
let periodLoading = false;
let errorMessage: string | null = data?.error ?? null;
let leaderboardRows: TaggerRow[] = [];
let totalTaggers: number;

const validatePeriodOption = (value: unknown): value is PeriodOption => {
	return (
		typeof value === "string" &&
		DEFAULT_PERIOD_OPTIONS.includes(value as PeriodOption)
	);
};

let periodOptions: PeriodOption[];
let selectedPeriod: PeriodOption;
let lastResolvedPeriod: PeriodOption = DEFAULT_PERIOD;

$: {
	const incoming = Array.isArray(data?.periodOptions)
		? data?.periodOptions
		: DEFAULT_PERIOD_OPTIONS;
	const validOptions = Array.from(
		new Set(incoming.filter((option) => validatePeriodOption(option))),
	) as PeriodOption[];
	periodOptions =
		validOptions.length > 0 ? validOptions : [...DEFAULT_PERIOD_OPTIONS];
}

$: {
	const periodFromData = validatePeriodOption(data?.period)
		? (data.period as PeriodOption)
		: DEFAULT_PERIOD;
	const validPeriod = periodOptions.includes(periodFromData)
		? periodFromData
		: DEFAULT_PERIOD;
	if (validPeriod !== lastResolvedPeriod) {
		// Track resolved period to prevent loops

		lastResolvedPeriod = validPeriod;
		selectedPeriod = validPeriod;
	}
}

const extractLightningDestination = (tip?: string): string | undefined => {
	if (!tip) return undefined;
	const trimmed = tip.trim();
	if (!trimmed) return undefined;
	const lightningMatch = trimmed.match(/lightning:[^\s)]+/i);
	if (lightningMatch) {
		return lightningMatch[0].replace(/^lightning:/i, "");
	}
	return trimmed.replace(/^lightning:/i, "");
};

const normalizeUsers = (
	users: RpcGetMostActiveUsersItem[],
	excluded: Set<number>,
): TaggerRow[] => {
	return users
		.filter((user) => !excluded.has(user.id))
		.map((user) => {
			const avatar = user.image_url || "/images/satoshi-nakamoto.png";
			const totalEdits = user.edits;
			return {
				avatar,
				tagger: user.name,
				id: user.id,
				created: user.created,
				updated: user.updated,
				deleted: user.deleted,
				total: totalEdits,
				tip: user.tip_address,
				tipDestination: extractLightningDestination(user.tip_address),
			};
		})
		.sort((a, b) => {
			if (b.total !== a.total) return b.total - a.total;
			if (b.updated !== a.updated) return b.updated - a.updated;
			return a.tagger.localeCompare(b.tagger);
		})
		.map((item, index) => ({ ...item, position: index + 1 }));
};

$: {
	if (data?.rpcResult?.users?.length) {
		const excluded = new Set(get(excludeLeader));
		const normalizedUsers = normalizeUsers(data.rpcResult.users, excluded);
		leaderboardRows = normalizedUsers;
		totalTaggers = normalizedUsers.length;
		loading = false;
		periodLoading = false;
		errorMessage = null;
	} else if (data?.error) {
		loading = false;
		periodLoading = false;
		errorMessage = data.error;
		leaderboardRows = [];
		totalTaggers = 0;
	} else {
		leaderboardRows = [];
		totalTaggers = 0;
	}
}

const fuzzyFilter: FilterFn<TaggerRow> = (row, columnId, value, addMeta) => {
	const itemRank = rankItem(row.getValue(columnId), value);
	addMeta?.({ itemRank });
	return itemRank.passed;
};

$: translate = $_;
$: periodLabels = {
	"3-months": translate("leaderboard.period3Months"),
	"6-months": translate("leaderboard.period6Months"),
	"12-months": translate("leaderboard.period12Months"),
	"all-time": translate("leaderboard.periodAllTime"),
};
let columns: ColumnDef<TaggerRow>[] = [];
$: columns = [
	{
		id: "position",
		header: translate("leaderboard.position"),
		accessorFn: (row) => row.position,
		enableSorting: true,
		enableGlobalFilter: false,
		sortingFn: (a, b) => a.original.position - b.original.position,
	},
	{
		id: "name",
		header: translate("leaderboard.name"),
		accessorFn: (row) => row.tagger,
		enableSorting: true,
		filterFn: fuzzyFilter,
		enableGlobalFilter: true,
	},
	{
		id: "total",
		header: translate("leaderboard.total"),
		accessorFn: (row) => row.total,
		enableSorting: true,
		enableGlobalFilter: false,
	},
	{
		id: "created",
		header: translate("leaderboard.created"),
		accessorFn: (row) => row.created,
		enableSorting: true,
		enableGlobalFilter: false,
	},
	{
		id: "updated",
		header: translate("leaderboard.updated"),
		accessorFn: (row) => row.updated,
		enableSorting: true,
		enableGlobalFilter: false,
	},
	{
		id: "deleted",
		header: translate("leaderboard.deleted"),
		accessorFn: (row) => row.deleted,
		enableSorting: true,
		enableGlobalFilter: false,
	},
	{
		id: "tip",
		header: translate("leaderboard.tip"),
		accessorFn: (row) => row.tipDestination ?? "",
		enableSorting: false,
		enableGlobalFilter: false,
	},
];

let sorting: SortingState = [{ id: "total", desc: true }];
let pagination: PaginationState = {
	pageIndex: 0,
	pageSize: pageSizes[0],
};

const setSorting: OnChangeFn<SortingState> = (updater) => {
	sorting = updater instanceof Function ? updater(sorting) : updater;
	options.update((old) => ({
		...old,
		state: {
			...old.state,
			sorting,
		},
	}));
};

const setPagination: OnChangeFn<PaginationState> = (updater) => {
	pagination = updater instanceof Function ? updater(pagination) : updater;
	options.update((old) => ({
		...old,
		state: {
			...old.state,
			pagination,
		},
	}));
};

const options = writable<TableOptions<TaggerRow>>({
	data: leaderboardRows,
	columns: [],
	state: {
		sorting,
		pagination,
	},
	onSortingChange: setSorting,
	onPaginationChange: setPagination,
	globalFilterFn: fuzzyFilter,
	getCoreRowModel: getCoreRowModel(),
	getSortedRowModel: getSortedRowModel(),
	getPaginationRowModel: getPaginationRowModel(),
	getFilteredRowModel: getFilteredRowModel(),
});

const table = createSvelteTable(options);

$: options.update((current) => ({
	...current,
	columns,
	data: leaderboardRows,
}));

const handleKeyUp = (e: KeyboardEvent) => {
	$table?.setGlobalFilter(String((e.target as HTMLInputElement)?.value));
};

const searchDebounce = debounce((e) => handleKeyUp(e));

const handlePeriodChange = async (event: Event) => {
	const nextValue = (event.target as HTMLSelectElement).value as PeriodOption;
	const search = new URLSearchParams($page.url.searchParams);
	if (nextValue === DEFAULT_PERIOD) {
		search.delete("period");
	} else {
		search.set("period", nextValue);
	}
	const nextSearch = search.toString();
	const nextUrl = nextSearch ? `/leaderboard?${nextSearch}` : "/leaderboard";
	periodLoading = true;
	selectedPeriod = nextValue;

	// eslint-disable-next-line svelte/no-navigation-without-resolve
	await goto(nextUrl, {
		replaceState: true,
		noScroll: true,
	});
};
</script>

<svelte:head>
	<title>BTC Map - {$_(`leaderboard.taggerHero`)}</title>
	<meta property="og:image" content="https://btcmap.org/images/og/leader.png" />
	<meta property="twitter:title" content="BTC Map - {$_(`leaderboard.taggerHero`)}" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/leader.png" />
</svelte:head>

<div class="mt-10 mb-20">
	<div class="mb-10 flex justify-center">
		<div id="hero" class="flex h-[324px] w-full items-end justify-center">
			<img src="/images/supertagger-king.svg" alt="ultimate supertagger" />
		</div>
	</div>

	<div class="mx-auto w-12/12 space-y-10 xl:w-[1200px]">
		<h1
			class="{$theme === 'dark'
				? 'text-white'
				: 'gradient'} text-center text-4xl !leading-tight font-semibold md:text-5xl"
		>
			{$_('leaderboard.taggerHero')}
		</h1>

		<PrimaryButton
			style="w-[207px] mx-auto py-3 rounded-xl"
			link="https://gitea.btcmap.org/teambtcmap/btcmap-general/wiki/Tagging-Merchants#shadowy-supertaggers-"
			external
		>
			{$_('leaderboard.joinButton')}
		</PrimaryButton>

		<section id="leaderboard" aria-labelledby="leaderboard-title">
			<div
				class="w-full rounded-3xl border border-gray-300 bg-white dark:border-white/95 dark:bg-white/10"
			>
				<header>
					<h2
						id="leaderboard-title"
						class="border-b border-gray-300 p-5 text-center text-lg font-semibold text-primary md:text-left dark:border-white/95 dark:text-white"
					>
						{$_('leaderboard.taggerHero')}
						{#if !loading && !errorMessage && totalTaggers}
							({totalTaggers})
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
							<span class="sr-only">{$_('leaderboard.loadingData')}</span>
							<Icon type="fa" icon="table" w="96" h="96" class="animate-pulse text-link/50" />
						</div>
					</div>
				{:else if periodLoading}
					<div class="p-5">
						<div
							class="flex h-[572px] w-full items-center justify-center rounded-3xl border border-link/50"
							role="status"
							aria-live="polite"
						>
							<div class="flex flex-col items-center gap-4">
								<LoadingSpinner color="text-link" size="h-12 w-12" />
								<p class="text-lg font-medium text-primary dark:text-white">
									{$_('leaderboard.loadingPeriod', {
										values: { period: periodLabels[selectedPeriod] },
									})}
								</p>
							</div>
						</div>
					</div>
				{:else if errorMessage}
					<p class="w-full p-5 text-center text-primary dark:text-white">
						{$_('leaderboard.failedToLoad')}
					</p>
				{:else if !leaderboardRows.length}
					<p class="w-full p-5 text-center text-primary dark:text-white">{$_('leaderboard.noData')}</p>
				{:else}
					<div class="p-5">
						<div
							class="mb-6 flex flex-col gap-4 px-4 py-3 md:flex-row md:items-center md:justify-between"
						>
							<div class="flex-1">
								<LeaderboardSearch
									table={$table}
									globalFilter={$table.getState().globalFilter}
									on:globalFilterChange={(e) => $table?.setGlobalFilter(e.detail)}
									{searchDebounce}
								/>
							</div>
							<label
								class="flex flex-col gap-2 text-sm font-medium text-primary md:flex-row md:items-center md:gap-3 dark:text-white"
								for="period-select"
							>
								<span>{$_('leaderboard.periodLabel')}</span>
								<FormSelect
									id="period-select"
									value={selectedPeriod}
									on:change={handlePeriodChange}
									ariaLabel={$_('leaderboard.periodAria')}
									style="md:w-auto"
								>
									{#each periodOptions as option (option)}
										<option value={option}>{periodLabels[option]}</option>
									{/each}
								</FormSelect>
							</label>
						</div>

						{#if $table.getFilteredRowModel().rows.length === 0}
							<p class="w-full p-5 text-center text-primary dark:text-white">{$_('leaderboard.noResults')}</p>
						{:else}
							<div class="block lg:hidden">
								<div
									class="border-b border-gray-300 bg-primary/5 dark:border-white/95 dark:bg-white/5"
								>
									<div class="grid grid-cols-4 gap-3 px-4 py-3 text-center text-xs">
										<SortHeaderButton
											column={$table?.getColumn('position')}
											label={$_('leaderboard.position')}
											ariaLabel={$_('leaderboard.sortPosition')}
										/>
										<SortHeaderButton
											column={$table?.getColumn('total')}
											label={$_('leaderboard.total')}
											ariaLabel={$_('leaderboard.sortTotal')}
										/>
										<SortHeaderButton
											column={$table?.getColumn('created')}
											label={$_('leaderboard.created')}
											ariaLabel={$_('leaderboard.sortCreated')}
										/>
										<SortHeaderButton
											column={$table?.getColumn('updated')}
											label={$_('leaderboard.updated')}
											ariaLabel={$_('leaderboard.sortUpdated')}
										/>
									</div>
								</div>

								<TaggerLeaderboardMobileCard table={$table} />
							</div>

							<TaggerLeaderboardDesktopTable table={$table} />
							<LeaderboardPagination table={$table} {pageSizes} />
						{/if}
					</div>
				{/if}
			</div>
		</section>
	</div>
</div>

<style>
	#hero {
		background-image: url('/images/confetti.png');
		background-repeat: no-repeat;
		background-position: center;
	}
</style>

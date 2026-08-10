<script lang="ts">
import type { ColumnDef } from "@tanstack/svelte-table";
import { createTable } from "@tanstack/svelte-table";

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
import type { BtcmapTableFeatures } from "$lib/tableFeatures";
import { btcmapTableFeatures } from "$lib/tableFeatures";
import { theme } from "$lib/theme";
import type { TaggerLeaderboard } from "$lib/types";
import { debounce } from "$lib/utils";

import type { PageData } from "./$types";
import { goto } from "$app/navigation";
import { page } from "$app/stores";

type TopEditorItem = {
	id: number;
	name: string;
	avatar_url: string;
	total_edits: number;
	places_created: number;
	places_updated: number;
	places_deleted: number;
	tip_url: string | null;
};

type TaggerRow = TaggerLeaderboard & {
	position: number;
	tipDestination?: string;
};

type PeriodOption = "3-months" | "6-months" | "12-months" | "all-time";
const DEFAULT_PERIOD: PeriodOption = "3-months";
const DEFAULT_PERIOD_OPTIONS: PeriodOption[] = [
	"3-months",
	"6-months",
	"12-months",
	"all-time",
];

let { data }: { data: PageData } = $props();

const pageSizes = [10, 20, 30, 40, 50];
let periodLoading = $state(false);

const validatePeriodOption = (value: unknown): value is PeriodOption => {
	return (
		typeof value === "string" &&
		DEFAULT_PERIOD_OPTIONS.includes(value as PeriodOption)
	);
};

const periodOptions = $derived.by((): PeriodOption[] => {
	const incoming = Array.isArray(data?.periodOptions)
		? data?.periodOptions
		: DEFAULT_PERIOD_OPTIONS;
	const validOptions = Array.from(
		new Set(incoming.filter((option) => validatePeriodOption(option))),
	) as PeriodOption[];
	return validOptions.length > 0 ? validOptions : [...DEFAULT_PERIOD_OPTIONS];
});

const resolvedPeriod = $derived.by((): PeriodOption => {
	const periodFromData = validatePeriodOption(data?.period)
		? (data.period as PeriodOption)
		: DEFAULT_PERIOD;
	return periodOptions.includes(periodFromData)
		? periodFromData
		: DEFAULT_PERIOD;
});
// Writable derived: shows the pick optimistically while goto() reloads the
// data, then re-derives from the loader's answer.
let selectedPeriod = $derived(resolvedPeriod);

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

const normalizeUsers = (users: TopEditorItem[]): TaggerRow[] => {
	return users
		.map((user) => {
			const avatar = user.avatar_url || "/images/satoshi-nakamoto.png";
			const totalEdits = user.total_edits;
			const tip = user.tip_url ?? "";
			return {
				avatar,
				tagger: user.name,
				id: user.id,
				created: user.places_created,
				updated: user.places_updated,
				deleted: user.places_deleted,
				total: totalEdits,
				tip,
				tipDestination: extractLightningDestination(tip || undefined),
			};
		})
		.sort((a, b) => {
			if (b.total !== a.total) return b.total - a.total;
			if (b.updated !== a.updated) return b.updated - a.updated;
			return a.tagger.localeCompare(b.tagger);
		})
		.map((item, index) => ({ ...item, position: index + 1 }));
};

const normalizedRows = $derived(
	Array.isArray(data?.result?.users) ? normalizeUsers(data.result.users) : null,
);
const leaderboardRows = $derived(normalizedRows ?? []);
const totalTaggers = $derived(leaderboardRows.length);
const errorMessage = $derived(normalizedRows ? null : (data?.error ?? null));
const loading = $derived(!normalizedRows && !data?.error);

const periodLabels = $derived({
	"3-months": $_("leaderboard.period3Months"),
	"6-months": $_("leaderboard.period6Months"),
	"12-months": $_("leaderboard.period12Months"),
	"all-time": $_("leaderboard.periodAllTime"),
});

// Columns re-derive on locale change; the table picks them up through the
// getter option below — no manual rebuild plumbing needed.
const columns: ColumnDef<BtcmapTableFeatures, TaggerRow>[] = $derived([
	{
		id: "position",
		header: $_("leaderboard.position"),
		accessorFn: (row) => row.position,
		enableSorting: true,
		enableGlobalFilter: false,
		sortFn: (a, b) => a.original.position - b.original.position,
	},
	{
		id: "name",
		header: $_("leaderboard.name"),
		accessorFn: (row) => row.tagger,
		enableSorting: true,
		filterFn: "fuzzy",
		enableGlobalFilter: true,
	},
	{
		id: "total",
		header: $_("leaderboard.total"),
		accessorFn: (row) => row.total,
		enableSorting: true,
		enableGlobalFilter: false,
	},
	{
		id: "created",
		header: $_("leaderboard.created"),
		accessorFn: (row) => row.created,
		enableSorting: true,
		enableGlobalFilter: false,
	},
	{
		id: "updated",
		header: $_("leaderboard.updated"),
		accessorFn: (row) => row.updated,
		enableSorting: true,
		enableGlobalFilter: false,
	},
	{
		id: "deleted",
		header: $_("leaderboard.deleted"),
		accessorFn: (row) => row.deleted,
		enableSorting: true,
		enableGlobalFilter: false,
	},
	{
		id: "tip",
		header: $_("leaderboard.tip"),
		accessorFn: (row) => row.tipDestination ?? "",
		enableSorting: false,
		enableGlobalFilter: false,
	},
]);

const table = createTable({
	features: btcmapTableFeatures,
	get columns() {
		return columns;
	},
	get data() {
		return leaderboardRows;
	},
	initialState: {
		pagination: { pageIndex: 0, pageSize: pageSizes[0] },
		sorting: [{ id: "total", desc: true }],
	},
	globalFilterFn: "fuzzy",
});

const globalFilter = $derived(String(table.atoms.globalFilter.get() ?? ""));

const handleKeyUp = (e: KeyboardEvent) => {
	table.setGlobalFilter(String((e.target as HTMLInputElement)?.value));
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

	try {
		await goto(nextUrl, {
			replaceState: true,
			noScroll: true,
		});
	} finally {
		periodLoading = false;
	}
};
</script>

<svelte:head>
	<title>BTC Map - {$_(`leaderboard.taggerHero`)}</title>
	<meta property="og:image" content="https://btcmap.org/images/og/leader.png" />
	<meta name="twitter:title" content="BTC Map - {$_(`leaderboard.taggerHero`)}" />
	<meta name="twitter:image" content="https://btcmap.org/images/og/leader.png" />
</svelte:head>

<div class="mt-10 mb-20">
	<div class="mb-10 flex justify-center">
		<div id="hero" class="flex h-[324px] w-full items-end justify-center">
			<img src="/images/supertagger-king.svg" alt={$_('leaderboard.ultimateSupertaggerAlt')} />
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
			link="https://wiki.btcmap.org/Tagging-Merchants#shadowy-supertaggers-"
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
								<LeaderboardSearch {table} {globalFilter} {searchDebounce} />
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

						{#if table.getFilteredRowModel().rows.length === 0}
							<p class="w-full p-5 text-center text-primary dark:text-white">{$_('leaderboard.noResults')}</p>
						{:else}
							<div class="block lg:hidden">
								<div
									class="border-b border-gray-300 bg-primary/5 dark:border-white/95 dark:bg-white/5"
								>
									<div class="grid grid-cols-4 gap-3 px-4 py-3 text-center text-xs">
										<SortHeaderButton
											column={table.getColumn('position')}
											label={$_('leaderboard.position')}
											ariaLabel={$_('leaderboard.sortPosition')}
										/>
										<SortHeaderButton
											column={table.getColumn('total')}
											label={$_('leaderboard.total')}
											ariaLabel={$_('leaderboard.sortTotal')}
										/>
										<SortHeaderButton
											column={table.getColumn('created')}
											label={$_('leaderboard.created')}
											ariaLabel={$_('leaderboard.sortCreated')}
										/>
										<SortHeaderButton
											column={table.getColumn('updated')}
											label={$_('leaderboard.updated')}
											ariaLabel={$_('leaderboard.sortUpdated')}
										/>
									</div>
								</div>

								<TaggerLeaderboardMobileCard {table} />
							</div>

							<TaggerLeaderboardDesktopTable {table} />
							<LeaderboardPagination {table} {pageSizes} />
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

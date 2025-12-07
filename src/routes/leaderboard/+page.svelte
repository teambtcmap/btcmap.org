<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Footer from '$components/layout/Footer.svelte';
	import Header from '$components/layout/Header.svelte';
	import HeaderPlaceholder from '$components/layout/HeaderPlaceholder.svelte';
	import Icon from '$components/Icon.svelte';
	import LeaderboardPagination from '$components/leaderboard/LeaderboardPagination.svelte';
	import LeaderboardSearch from '$components/leaderboard/LeaderboardSearch.svelte';
	import SortHeaderButton from '$components/leaderboard/SortHeaderButton.svelte';
	import TaggerLeaderboardDesktopTable from '$components/leaderboard/TaggerLeaderboardDesktopTable.svelte';
	import TaggerLeaderboardMobileCard from '$components/leaderboard/TaggerLeaderboardMobileCard.svelte';
	import PrimaryButton from '$components/PrimaryButton.svelte';
	import LoadingSpinner from '$components/LoadingSpinner.svelte';
	import {
		createSvelteTable,
		getCoreRowModel,
		getFilteredRowModel,
		getPaginationRowModel,
		getSortedRowModel,
		type ColumnDef,
		type FilterFn,
		type OnChangeFn,
		type PaginationState,
		type SortingState,
		type TableOptions
	} from '@tanstack/svelte-table';
	import { rankItem } from '@tanstack/match-sorter-utils';
	import { page } from '$app/stores';
	import { writable, get } from 'svelte/store';
	import { excludeLeader, theme } from '$lib/store';
	import type { RpcGetMostActiveUsersItem, TaggerLeaderboard } from '$lib/types';
	import { debounce, detectTheme } from '$lib/utils';

	type TaggerRow = TaggerLeaderboard & {
		position: number;
		tipDestination?: string;
	};

	type PeriodOption = '3-months' | '6-months' | '12-months' | 'all-time';
	const DEFAULT_PERIOD: PeriodOption = '12-months';
	const DEFAULT_PERIOD_OPTIONS: PeriodOption[] = ['3-months', '6-months', '12-months', 'all-time'];
	const periodLabels: Record<PeriodOption, string> = {
		'3-months': 'Last 3 months',
		'6-months': 'Last 6 months',
		'12-months': 'Last 12 months',
		'all-time': 'All Time'
	};

	export let data;

	const pageSizes = [10, 20, 30, 40, 50];
	let globalFilter = '';
	let loading = true;
	let periodLoading = false;
	let errorMessage: string | null = data?.error ?? null;
	let leaderboardRows: TaggerRow[] = [];
	let totalTaggers = 0;

	const validatePeriodOption = (value: unknown): value is PeriodOption => {
		return typeof value === 'string' && DEFAULT_PERIOD_OPTIONS.includes(value as PeriodOption);
	};

	let periodOptions: PeriodOption[] = [...DEFAULT_PERIOD_OPTIONS];
	let selectedPeriod: PeriodOption = DEFAULT_PERIOD;
	let lastResolvedPeriod: PeriodOption = DEFAULT_PERIOD;

	$: {
		const incoming = Array.isArray(data?.periodOptions)
			? data?.periodOptions
			: DEFAULT_PERIOD_OPTIONS;
		periodOptions = Array.from(
			new Set(incoming.filter((option) => validatePeriodOption(option)))
		) as PeriodOption[];
		if (!periodOptions.length) {
			periodOptions = [...DEFAULT_PERIOD_OPTIONS];
		}
	}

	$: {
		const periodFromData = validatePeriodOption(data?.period)
			? (data.period as PeriodOption)
			: DEFAULT_PERIOD;
		const validPeriod = periodOptions.includes(periodFromData) ? periodFromData : DEFAULT_PERIOD;
		if (validPeriod !== lastResolvedPeriod) {
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
			return lightningMatch[0].replace(/^lightning:/i, '');
		}
		return trimmed.replace(/^lightning:/i, '');
	};

	const normalizeUsers = (
		users: RpcGetMostActiveUsersItem[],
		excluded: Set<number>
	): TaggerRow[] => {
		return users
			.filter((user) => !excluded.has(user.id))
			.map((user) => {
				const avatar = user.image_url || '/images/satoshi-nakamoto.png';
				const totalEdits = user.edits ?? user.created + user.updated + user.deleted;
				return {
					avatar,
					tagger: user.name,
					id: user.id,
					created: user.created,
					updated: user.updated,
					deleted: user.deleted,
					total: totalEdits,
					tip: user.tip_address,
					tipDestination: extractLightningDestination(user.tip_address)
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
			leaderboardRows = normalizeUsers(data.rpcResult.users, excluded);
			totalTaggers = leaderboardRows.length;
			loading = false;
			periodLoading = false;
			errorMessage = null;
		} else if (data?.error) {
			leaderboardRows = [];
			totalTaggers = 0;
			loading = false;
			periodLoading = false;
			errorMessage = data.error;
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

	const columns: ColumnDef<TaggerRow>[] = [
		{
			id: 'position',
			header: 'Position',
			accessorFn: (row) => row.position,
			enableSorting: true,
			enableGlobalFilter: false,
			sortingFn: (a, b) => a.original.position - b.original.position
		},
		{
			id: 'name',
			header: 'Name',
			accessorFn: (row) => row.tagger,
			enableSorting: true,
			filterFn: fuzzyFilter,
			enableGlobalFilter: true
		},
		{
			id: 'total',
			header: 'Total',
			accessorFn: (row) => row.total,
			enableSorting: true,
			enableGlobalFilter: false
		},
		{
			id: 'created',
			header: 'Created',
			accessorFn: (row) => row.created,
			enableSorting: true,
			enableGlobalFilter: false
		},
		{
			id: 'updated',
			header: 'Updated',
			accessorFn: (row) => row.updated,
			enableSorting: true,
			enableGlobalFilter: false
		},
		{
			id: 'deleted',
			header: 'Deleted',
			accessorFn: (row) => row.deleted,
			enableSorting: true,
			enableGlobalFilter: false
		},
		{
			id: 'tip',
			header: 'Tip',
			accessorFn: (row) => row.tipDestination ?? '',
			enableSorting: false,
			enableGlobalFilter: false
		}
	];

	let sorting: SortingState = [{ id: 'total', desc: true }];
	let pagination: PaginationState = {
		pageIndex: 0,
		pageSize: pageSizes[0]
	};

	const setSorting: OnChangeFn<SortingState> = (updater) => {
		sorting = updater instanceof Function ? updater(sorting) : updater;
		options.update((old) => ({
			...old,
			state: {
				...old.state,
				sorting
			}
		}));
	};

	const setPagination: OnChangeFn<PaginationState> = (updater) => {
		pagination = updater instanceof Function ? updater(pagination) : updater;
		options.update((old) => ({
			...old,
			state: {
				...old.state,
				pagination
			}
		}));
	};

	const options = writable<TableOptions<TaggerRow>>({
		data: leaderboardRows,
		columns,
		state: {
			sorting,
			pagination
		},
		onSortingChange: setSorting,
		onPaginationChange: setPagination,
		globalFilterFn: fuzzyFilter,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getFilteredRowModel: getFilteredRowModel()
	});

	const table = createSvelteTable(options);

	$: options.update((current) => ({
		...current,
		data: leaderboardRows
	}));

	const handleKeyUp = (e: KeyboardEvent) => {
		$table?.setGlobalFilter(String((e.target as HTMLInputElement)?.value));
	};

	const searchDebounce = debounce((e) => handleKeyUp(e));

	const handlePeriodChange = async (event: Event) => {
		const nextValue = (event.target as HTMLSelectElement).value as PeriodOption;
		const search = new URLSearchParams($page.url.searchParams);
		if (nextValue === DEFAULT_PERIOD) {
			search.delete('period');
		} else {
			search.set('period', nextValue);
		}
		const query = search.toString();
		selectedPeriod = nextValue;
		periodLoading = true;
		// @ts-expect-error resolve function returns union type that doesn't match goto's strict route types
		await goto(resolve(query ? `/leaderboard?${query}` : '/leaderboard'), {
			replaceState: true,
			noScroll: true
		});
	};
</script>

<svelte:head>
	<title>BTC Map - Leaderboard</title>
	<meta property="og:image" content="https://btcmap.org/images/og/leader.png" />
	<meta property="twitter:title" content="BTC Map - Leaderboard" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/leader.png" />
</svelte:head>

<div class="bg-teal dark:bg-dark">
	<Header />

	<main class="mt-10">
		<div class="mb-10 flex justify-center">
			<div id="hero" class="flex h-[324px] w-full items-end justify-center">
				<img src="/images/supertagger-king.svg" alt="ultimate supertagger" />
			</div>
		</div>

		<div class="mx-auto w-10/12 space-y-10 xl:w-[1200px]">
			{#if typeof window !== 'undefined'}
				<h1
					class="{detectTheme() === 'dark' || $theme === 'dark'
						? 'text-white'
						: 'gradient'} text-center text-4xl !leading-tight font-semibold md:text-5xl"
				>
					Top Editors
				</h1>
			{:else}
				<HeaderPlaceholder />
			{/if}

			<PrimaryButton
				style="w-[207px] mx-auto py-3 rounded-xl"
				link="https://gitea.btcmap.org/teambtcmap/btcmap-general/wiki/Tagging-Merchants#shadowy-supertaggers-"
				external
			>
				Join Them
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
							Top Editors
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
								<Icon type="fa" icon="table" w="96" h="96" style="animate-pulse text-link/50" />
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
										Loading {periodLabels[selectedPeriod].toLowerCase()} data...
									</p>
								</div>
							</div>
						</div>
					{:else if errorMessage}
						<p class="w-full p-5 text-center text-primary dark:text-white">
							Failed to load leaderboard: {errorMessage}
						</p>
					{:else if !leaderboardRows.length}
						<p class="w-full p-5 text-center text-primary dark:text-white">No data available</p>
					{:else}
						<div class="p-5">
							<div class="mb-6 px-4 py-3 text-center md:text-left">
								<p class="text-lg font-semibold text-primary dark:text-white">Time period</p>
								<p class="text-sm text-primary/80 dark:text-white/80">
									Showing {periodLabels[selectedPeriod]}
								</p>
							</div>

							<div class="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
								<label
									class="flex flex-col gap-2 px-4 py-3 text-sm font-medium text-primary md:flex-row md:items-center md:gap-3 dark:text-white"
								>
									<span>Period</span>
									<select
										class="rounded-xl border border-primary/40 bg-white/80 px-4 py-2 text-primary focus:border-primary focus:outline-none dark:border-white/50 dark:bg-dark/40 dark:text-white"
										value={selectedPeriod}
										on:change={handlePeriodChange}
										aria-label="Select leaderboard period"
									>
										{#each periodOptions as option (option)}
											<option value={option}>{periodLabels[option]}</option>
										{/each}
									</select>
								</label>

								<LeaderboardSearch
									table={$table}
									globalFilter={$table.getState().globalFilter}
									on:globalFilterChange={(e) => $table?.setGlobalFilter(e.detail)}
									{searchDebounce}
								/>
							</div>

							{#if $table.getFilteredRowModel().rows.length === 0}
								<p class="w-full p-5 text-center text-primary dark:text-white">No results found.</p>
							{:else}
								<div class="block lg:hidden">
									<div
										class="border-b border-gray-300 bg-primary/5 dark:border-white/95 dark:bg-white/5"
									>
										<div class="grid grid-cols-4 gap-3 px-4 py-3 text-center text-xs">
											<SortHeaderButton
												column={$table?.getColumn('position')}
												label="Position"
												ariaLabel="Sort by position"
											/>
											<SortHeaderButton
												column={$table?.getColumn('total')}
												label="Total"
												ariaLabel="Sort by total edits"
											/>
											<SortHeaderButton
												column={$table?.getColumn('created')}
												label="Created"
												ariaLabel="Sort by created edits"
											/>
											<SortHeaderButton
												column={$table?.getColumn('updated')}
												label="Updated"
												ariaLabel="Sort by updated edits"
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

			<Footer />
		</div>
	</main>
</div>

<style>
	#hero {
		background-image: url('/images/confetti.png');
		background-repeat: no-repeat;
		background-position: center;
	}
</style>

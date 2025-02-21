<script lang="ts">
	import { run } from 'svelte/legacy';

	import { IssueCell } from '$lib/comp';
	import { theme } from '$lib/store';
	import type { Issues } from '$lib/types';
	import { debounce, detectTheme, getIssueHelpLink, getIssueIcon, isEven } from '$lib/utils';
	import { rankItem } from '@tanstack/match-sorter-utils';
	import type {
		ColumnDef,
		FilterFn,
		OnChangeFn,
		PaginationState,
		SortingState,
		Table,
		TableOptions
	} from '@tanstack/svelte-table';
	import {
		createSvelteTable,
		flexRender,
		getCoreRowModel,
		getFilteredRowModel,
		getPaginationRowModel,
		getSortedRowModel
	} from '@tanstack/svelte-table';
	import { writable, type Readable } from 'svelte/store';

	interface Props {
		title: string;
		issues: Issues;
		loading: boolean;
		initialPageSize?: number;
	}

	let {
		title,
		issues,
		loading,
		initialPageSize = 10
	}: Props = $props();

	type IssueFormatted = {
		icon: string;
		name: string;
		type: string;
		viewLink: string;
		editLink: string;
		helpLink: string | undefined;
	};

	let table: Readable<Table<IssueFormatted>> | undefined = $state();
	let tableRendered = $state(false);

	const pageSizes = [10, 20, 30, 40, 50];

	let globalFilter = $state('');
	let searchInput: HTMLInputElement = $state();

	const handleKeyUp = (e: any) => {
		$table?.setGlobalFilter(String(e?.target?.value));
	};

	const searchDebounce = debounce((e) => handleKeyUp(e));

	const renderTable = () => {
		const data = issues
			.sort((a, b) => {
				if (a.type === b.type) {
					return b.severity - a.severity;
				} else {
					if (a.type < b.type) {
						return -1;
					}

					if (a.type > b.type) {
						return 1;
					}

					return 0;
				}
			})
			.map((issue) => {
				const icon = getIssueIcon(issue.type);
				const name = issue.merchantName || 'Unnamed Merchant';
				const type = issue.description;
				const id = issue.merchantId.split(':');
				const viewLink = id[0] + '/' + id[1];
				const editLink = id[0] + '=' + id[1];
				const helpLink = getIssueHelpLink(issue.type);

				return { icon, name, type, viewLink, editLink, helpLink };
			});

		const columns: ColumnDef<IssueFormatted>[] = [
			{
				accessorKey: 'icon',
				header: '',
				cell: (info) => flexRender(IssueCell, { id: 'icon', value: info.getValue() }),
				enableSorting: false,
				enableGlobalFilter: false
			},
			{
				accessorKey: 'name',
				header: 'Merchant Name',
				cell: (info) => flexRender(IssueCell, { id: 'name', value: info.getValue() }),
				// @ts-expect-error
				filterFn: 'fuzzy',
				enableGlobalFilter: true
			},
			{
				accessorKey: 'type',
				header: 'Description',
				cell: (info) => flexRender(IssueCell, { id: 'type', value: info.getValue() }),
				enableGlobalFilter: false
			},
			{
				accessorKey: 'viewLink',
				header: '',
				cell: (info) => flexRender(IssueCell, { id: 'viewLink', value: info.getValue() }),
				enableSorting: false,
				enableGlobalFilter: false
			},
			{
				accessorKey: 'editLink',
				header: '',
				cell: (info) => flexRender(IssueCell, { id: 'editLink', value: info.getValue() }),
				enableSorting: false,
				enableGlobalFilter: false
			},
			{
				accessorKey: 'helpLink',
				header: '',
				cell: (info) => flexRender(IssueCell, { id: 'helpLink', value: info.getValue() }),
				enableSorting: false,
				enableGlobalFilter: false
			}
		];

		let sorting: SortingState = [];

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

		const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
			// Rank the item
			const itemRank = rankItem(row.getValue(columnId), value);

			// Store the itemRank info
			addMeta({ itemRank });

			// Return if the item should be filtered in/out
			return itemRank.passed;
		};

		const options = writable<TableOptions<IssueFormatted>>({
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

	run(() => {
		!loading && !tableRendered && renderTable();
	});
</script>

<section id="issues">
	<div class="w-full rounded-3xl border border-statBorder dark:bg-white/10">
		<h3
			class="border-b border-statBorder p-5 text-center text-lg font-semibold text-primary dark:text-white md:text-left"
		>
			{title}

			{#if !loading}
				({issues.length})
			{/if}
		</h3>

		{#if loading}
			<div class="p-5">
				<div
					class="flex h-[572px] w-full animate-pulse items-center justify-center rounded-3xl border border-link/50"
				>
					<i class="fa-solid fa-table h-24 w-24 animate-pulse text-link/50"></i>
				</div>
			</div>
		{:else if !issues.length}
			<p class="w-full p-5 text-center text-primary dark:text-white">No tagging issues!</p>
		{:else if $table}
			<div class="relative text-primary dark:text-white">
				<input
					type="text"
					placeholder="Search..."
					class="w-full bg-primary/5 px-5 py-2.5 text-sm focus:outline-primary dark:bg-white/5 dark:focus:outline-white"
					bind:value={globalFilter}
					onkeyup={searchDebounce}
					bind:this={searchInput}
				/>
				{#if globalFilter}
					<button
						class="absolute right-3 top-1/2 -translate-y-1/2"
						onclick={() => {
							globalFilter = '';
							$table?.setGlobalFilter('');
						}}
					>
						<i class="fa-solid fa-circle-xmark"></i>
					</button>
				{:else}
					<button
						class="absolute right-3 top-1/2 -translate-y-1/2"
						onclick={() => {
							searchInput.focus();
						}}
					>
						<i class="fa-solid fa-magnifying-glass"></i>
					</button>
				{/if}
			</div>
			{#if $table.getFilteredRowModel().rows.length === 0}
				<p class="w-full p-5 text-center text-primary dark:text-white">No results found.</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full whitespace-nowrap text-left text-primary dark:text-white">
						<thead>
							{#each $table.getHeaderGroups() as headerGroup}
								<tr>
									{#each headerGroup.headers as header}
										<th colSpan={header.colSpan} class="px-5 pb-2.5 pt-5">
											{#if !header.isPlaceholder}
												{@const SvelteComponent = flexRender(header.column.columnDef.header, header.getContext())}
												<button
													class="flex select-none items-center gap-x-2"
													onclick={header.column.getToggleSortingHandler()}
												>
													<SvelteComponent
													/>
													{#if header.column.getIsSorted().toString() === 'asc'}
														<svg
															xmlns="http://www.w3.org/2000/svg"
															viewBox="0 0 320 512"
															fill="currentColor"
															class="w-2"
															><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path
																d="M182.6 137.4c-12.5-12.5-32.8-12.5-45.3 0l-128 128c-9.2 9.2-11.9 22.9-6.9 34.9s16.6 19.8 29.6 19.8H288c12.9 0 24.6-7.8 29.6-19.8s2.2-25.7-6.9-34.9l-128-128z"
															/></svg
														>
													{:else if header.column.getIsSorted().toString() === 'desc'}
														<svg
															xmlns="http://www.w3.org/2000/svg"
															viewBox="0 0 320 512"
															fill="currentColor"
															class="w-2"
															><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path
																d="M137.4 374.6c12.5 12.5 32.8 12.5 45.3 0l128-128c9.2-9.2 11.9-22.9 6.9-34.9s-16.6-19.8-29.6-19.8L32 192c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l128 128z"
															/></svg
														>
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
										{@const SvelteComponent_1 = flexRender(cell.column.columnDef.cell, cell.getContext())}
										<td class="px-5 py-2.5">
											<SvelteComponent_1
											/>
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div
					class="flex w-full flex-col gap-5 px-5 pb-5 pt-2.5 text-primary dark:text-white md:flex-row md:items-center md:justify-between"
				>
					<select
						value={$table?.getState().pagination.pageSize}
						onchange={(e) => {
							// @ts-expect-error
							$table?.setPageSize(Number(e.target?.value));
						}}
						class="cursor-pointer bg-transparent focus:outline-primary dark:focus:outline-white"
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
									class="text-xl font-bold {!$table?.getCanPreviousPage()
										? 'cursor-not-allowed opacity-50'
										: ''}"
									onclick={() => $table?.firstPage()}
									disabled={!$table?.getCanPreviousPage()}
								>
									{'<<'}
								</button>
								<button
									class="text-xl font-bold {!$table?.getCanPreviousPage()
										? 'cursor-not-allowed opacity-50'
										: ''}"
									onclick={() => $table?.previousPage()}
									disabled={!$table?.getCanPreviousPage()}
								>
									{'<'}
								</button>
							</div>
							<div class="flex items-center gap-5">
								<button
									class="text-xl font-bold {!$table?.getCanNextPage()
										? 'cursor-not-allowed opacity-50'
										: ''}"
									onclick={() => $table?.nextPage()}
									disabled={!$table?.getCanNextPage()}
								>
									{'>'}
								</button>
								<button
									class="text-xl font-bold {!$table?.getCanNextPage()
										? 'cursor-not-allowed opacity-50'
										: ''}"
									onclick={() => $table?.lastPage()}
									disabled={!$table?.getCanNextPage()}
								>
									{'>>'}
								</button>
							</div>
						</div>

						<span class="flex items-center justify-center gap-1 md:justify-start">
							<div>Page</div>
							<strong>
								{$table?.getState().pagination.pageIndex + 1} of
								{$table?.getPageCount().toLocaleString()}
							</strong>
						</span>
					</div>
				</div>
			{/if}
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

<script lang="ts">
	import { IssueCell } from '$lib/comp';
	import { theme } from '$lib/store';
	import type { RpcIssue } from '$lib/types';
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

	export let title: string;
	export let issues: RpcIssue[];
	export let loading: boolean;
	export let initialPageSize = 10;

	type IssueFormatted = {
		icon: string;
		name: string;
		type: string;
		viewLink: string;
		editLink: string;
		helpLink: string | undefined;
	};

	let table: Readable<Table<IssueFormatted>> | undefined;
	let tableRendered = false;

	const pageSizes = [10, 20, 30, 40, 50];

	let globalFilter = '';
	let searchInput: HTMLInputElement;

	const handleKeyUp = (e: KeyboardEvent) => {
		$table?.setGlobalFilter(String((e.target as HTMLInputElement)?.value));
	};

	const searchDebounce = debounce((e) => handleKeyUp(e));

	const renderTable = () => {
		const data = issues.map((issue) => {
			const icon = getIssueIcon(issue.issue_code);
			const name = issue.element_name;
			var type: string = 'TODO';
			if (issue.issue_code == 'missing_icon') {
				type = 'Icon is missing';
			} else if (issue.issue_code == 'not_verified') {
				type = 'Last verification date is missing';
			} else if (issue.issue_code == 'outdated') {
				type = 'Outdated, needs re-verification';
			} else if (issue.issue_code == 'outdated_soon') {
				type = 'Soon to be outdated, needs re-verification';
			} else if (issue.issue_code.startsWith('invalid_tag_value')) {
				type = `Tag value is not formatted properly (${issue.issue_code})`;
			} else if (issue.issue_code.startsWith('misspelled_tag_name')) {
				type = `Spelling issue in tag name (${issue.issue_code})`;
			} else {
				type = issue.issue_code;
			}
			const viewLink = `${issue.element_osm_type}/${issue.element_osm_id}`;
			const editLink = `${issue.element_osm_type}=${issue.element_osm_id}`;
			const helpLink = getIssueHelpLink(issue.issue_code);
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

		// https://tanstack.com/table/v8/docs/framework/svelte/examples/filtering
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

	$: !loading && !tableRendered && renderTable();
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
					<i class="fa-solid fa-table h-24 w-24 animate-pulse text-link/50" />
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
					on:keyup={searchDebounce}
					bind:this={searchInput}
				/>
				{#if globalFilter}
					<button
						class="absolute right-3 top-1/2 -translate-y-1/2"
						on:click={() => {
							globalFilter = '';
							$table?.setGlobalFilter('');
						}}
					>
						<i class="fa-solid fa-circle-xmark" />
					</button>
				{:else}
					<button
						class="absolute right-3 top-1/2 -translate-y-1/2"
						on:click={() => {
							searchInput.focus();
						}}
					>
						<i class="fa-solid fa-magnifying-glass" />
					</button>
				{/if}
			</div>
			{#if $table.getFilteredRowModel().rows.length === 0}
				<p class="w-full p-5 text-center text-primary dark:text-white">No results found.</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full whitespace-nowrap text-left text-primary dark:text-white">
						<thead>
							{#each $table.getHeaderGroups() as headerGroup, index (index)}
								<tr>
									{#each headerGroup.headers as header, index (index)}
										<th colSpan={header.colSpan} class="px-5 pb-2.5 pt-5">
											{#if !header.isPlaceholder}
												<button
													class="flex select-none items-center gap-x-2"
													on:click={header.column.getToggleSortingHandler()}
												>
													<svelte:component
														this={flexRender(header.column.columnDef.header, header.getContext())}
													/>
													{#if header.column.getIsSorted().toString() === 'asc'}
														<svg
															xmlns="http://www.w3.org/2000/svg"
															viewBox="0 0 320 512"
															fill="currentColor"
															class="w-2"
															><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path
																d="M182.6 137.4c-12.5-12.5-32.8-12.5-45.3 0l-128 128c-9.2 9.2-11.9-22.9-6.9-34.9s16.6-19.8 29.6-19.8H288c12.9 0 24.6-7.8 29.6-19.8s2.2-25.7-6.9-34.9l-128-128z"
															/></svg
														>
													{:else if header.column.getIsSorted().toString() === 'desc'}
														<svg
															xmlns="http://www.w3.org/2000/svg"
															viewBox="0 0 320 512"
															fill="currentColor"
															class="w-2"
															><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path
																d="M137.4 374.6c12.5 12.5 32.8 12.5 45.3 0l128-128c9.2 9.2-11.9-22.9-6.9-34.9s-16.6-19.8-29.6-19.8L32 192c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l128 128z"
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
							{#each $table.getRowModel().rows as row, index (index)}
								<tr class={isEven(index) ? 'bg-primary/5 dark:bg-white/5' : ''}>
									{#each row.getVisibleCells() as cell, index (index)}
										<td class="px-5 py-2.5">
											<svelte:component
												this={flexRender(cell.column.columnDef.cell, cell.getContext())}
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
						on:change={(e) => {
							// @ts-expect-error
							$table?.setPageSize(Number(e.target?.value));
						}}
						class="cursor-pointer bg-transparent focus:outline-primary dark:focus:outline-white"
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
									class="text-xl font-bold {!$table?.getCanPreviousPage()
										? 'cursor-not-allowed opacity-50'
										: ''}"
									on:click={() => $table?.firstPage()}
									disabled={!$table?.getCanPreviousPage()}
								>
									&lt;&lt;
								</button>
								<button
									class="text-xl font-bold {!$table?.getCanPreviousPage()
										? 'cursor-not-allowed opacity-50'
										: ''}"
									on:click={() => $table?.previousPage()}
									disabled={!$table?.getCanPreviousPage()}
								>
									&lt;
								</button>
							</div>
							<div class="flex items-center gap-5">
								<button
									class="text-xl font-bold {!$table?.getCanNextPage()
										? 'cursor-not-allowed opacity-50'
										: ''}"
									on:click={() => $table?.nextPage()}
									disabled={!$table?.getCanNextPage()}
								>
									&gt;
								</button>
								<button
									class="text-xl font-bold {!$table?.getCanNextPage()
										? 'cursor-not-allowed opacity-50'
										: ''}"
									on:click={() => $table?.lastPage()}
									disabled={!$table?.getCanNextPage()}
								>
									&gt;&gt;
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

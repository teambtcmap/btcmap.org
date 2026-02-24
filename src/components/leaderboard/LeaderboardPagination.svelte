<script lang="ts">
import type { Table } from "@tanstack/svelte-table";

import { _ } from "$lib/i18n";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let table: Table<any>;
export let pageSizes: number[] = [10, 20, 30, 40, 50];
</script>

<!-- Pagination -->
<div
	class="flex w-full flex-col gap-5 px-5 pt-2.5 pb-5 text-primary md:flex-row md:items-center md:justify-between dark:text-white"
>
	<select
		value={table?.getState().pagination.pageSize}
		on:change={(e) => {
			// @ts-expect-error Select onChange event target type assertion for page size change
			table?.setPageSize(Number(e.target?.value));
		}}
		class="cursor-pointer bg-transparent focus:outline-primary dark:focus:outline-white"
		aria-label={$_('leaderboard.itemsPerPage')}
	>
		{#each pageSizes as pageSize (pageSize)}
			<option value={pageSize}>
				{$_('leaderboard.show', { values: { pageSize } })}
			</option>
		{/each}
	</select>

	<div class="flex flex-col gap-5 md:flex-row md:items-center">
		<div class="flex items-center justify-between gap-5 md:justify-start">
			<div class="flex items-center gap-5">
				<button
					type="button"
					class="text-xl font-bold {!table?.getCanPreviousPage()
						? 'cursor-not-allowed opacity-50'
						: ''}"
					on:click={() => table?.firstPage()}
					disabled={!table?.getCanPreviousPage()}
					aria-label={$_('leaderboard.firstPage')}
				>
					&lt;&lt;
				</button>
				<button
					type="button"
					class="text-xl font-bold {!table?.getCanPreviousPage()
						? 'cursor-not-allowed opacity-50'
						: ''}"
					on:click={() => table?.previousPage()}
					disabled={!table?.getCanPreviousPage()}
					aria-label={$_('leaderboard.previousPage')}
				>
					&lt;
				</button>
			</div>
			<div class="flex items-center gap-5">
				<button
					type="button"
					class="text-xl font-bold {!table?.getCanNextPage()
						? 'cursor-not-allowed opacity-50'
						: ''}"
					on:click={() => table?.nextPage()}
					disabled={!table?.getCanNextPage()}
					aria-label={$_('leaderboard.nextPage')}
				>
					&gt;
				</button>
				<button
					type="button"
					class="text-xl font-bold {!table?.getCanNextPage()
						? 'cursor-not-allowed opacity-50'
						: ''}"
					on:click={() => table?.lastPage()}
					disabled={!table?.getCanNextPage()}
					aria-label={$_('leaderboard.lastPage')}
				>
					&gt;&gt;
				</button>
			</div>
		</div>

		<span class="flex items-center justify-center gap-1 md:justify-start" aria-live="polite">
			<div>{$_('leaderboard.page')}</div>
			<strong>
				{table?.getState().pagination.pageIndex + 1} {$_('leaderboard.of')}
				{table?.getPageCount().toLocaleString()}
			</strong>
		</span>
	</div>
</div>

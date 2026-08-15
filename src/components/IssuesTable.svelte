<script lang="ts">
import type { ColumnDef } from "@tanstack/svelte-table";
import {
	createTable,
	FlexRender,
	renderComponent,
} from "@tanstack/svelte-table";
import { _ } from "svelte-i18n";

import Icon from "$components/Icon.svelte";
import IssueCell from "$components/IssueCell.svelte";
import LeaderboardPagination from "$components/leaderboard/LeaderboardPagination.svelte";
import LeaderboardSearch from "$components/leaderboard/LeaderboardSearch.svelte";
import SortableHeaderCell from "$components/leaderboard/SortableHeaderCell.svelte";
import type { BtcmapTableFeatures } from "$lib/tableFeatures";
import { btcmapTableFeatures, resolveAriaSort } from "$lib/tableFeatures";
import { theme } from "$lib/theme";
import type { PlaceIssue } from "$lib/types";
import { debounce, getIssueHelpLink, getIssueIcon, isEven } from "$lib/utils";

type Props = {
	title: string;
	issues: PlaceIssue[];
	loading: boolean;
	initialPageSize?: number;
};

let { title, issues, loading, initialPageSize = 10 }: Props = $props();

type IssueFormatted = {
	icon: string;
	name: string;
	type: string;
	viewLink: string;
	editLink: string;
	helpLink: string | undefined;
};

type IssueCellId =
	| "icon"
	| "name"
	| "type"
	| "viewLink"
	| "editLink"
	| "helpLink";

const pageSizes = [10, 20, 30, 40, 50];

let globalFilter = $state("");

// Rows re-derive when the issues prop or the locale changes — the table
// picks them up through its getter option. This replaces the old
// rebuild-the-entire-table hacks for area navigation and locale switches.
const rows: IssueFormatted[] = $derived(
	issues.map((issue) => {
		const icon = getIssueIcon(issue.issue_code);
		const name = issue.element_name;
		let type: string;
		if (issue.issue_code === "missing_icon") {
			type = $_(`maintain.issueMissingIcon`);
		} else if (issue.issue_code === "not_verified") {
			type = $_(`maintain.issueNotVerified`);
		} else if (issue.issue_code === "outdated") {
			type = $_(`maintain.issueOutdated`);
		} else if (issue.issue_code === "outdated_soon") {
			type = $_(`maintain.issueOutdatedSoon`);
		} else if (issue.issue_code.startsWith("invalid_tag_value")) {
			type = $_(`maintain.issueInvalidTagValue`, {
				values: { code: issue.issue_code },
			});
		} else if (issue.issue_code.startsWith("misspelled_tag_name")) {
			type = $_(`maintain.issueMisspelledTagName`, {
				values: { code: issue.issue_code },
			});
		} else {
			type = issue.issue_code;
		}
		const viewLink = `${issue.element_osm_type}/${issue.element_osm_id}`;
		const editLink = `${issue.element_osm_type}=${issue.element_osm_id}`;
		const helpLink = getIssueHelpLink(issue.issue_code);
		return { icon, name, type, viewLink, editLink, helpLink };
	}),
);

const issueCell = (id: IssueCellId, value: unknown) =>
	renderComponent(IssueCell, { id, value: String(value ?? "") });

// Static columns with function headers (same pattern as AreaLeaderboard):
// locale changes re-render the header text without changing column identity
const columns: ColumnDef<BtcmapTableFeatures, IssueFormatted>[] = [
	{
		accessorKey: "icon",
		header: "",
		cell: (info) => issueCell("icon", info.getValue()),
		enableSorting: false,
		enableGlobalFilter: false,
	},
	{
		accessorKey: "name",
		header: () => $_(`maintain.merchantName`),
		cell: (info) => issueCell("name", info.getValue()),
		filterFn: "fuzzy",
		enableGlobalFilter: true,
	},
	{
		accessorKey: "type",
		header: () => $_(`maintain.description`),
		cell: (info) => issueCell("type", info.getValue()),
		enableGlobalFilter: false,
	},
	{
		accessorKey: "viewLink",
		header: "",
		cell: (info) => issueCell("viewLink", info.getValue()),
		enableSorting: false,
		enableGlobalFilter: false,
	},
	{
		accessorKey: "editLink",
		header: "",
		cell: (info) => issueCell("editLink", info.getValue()),
		enableSorting: false,
		enableGlobalFilter: false,
	},
	{
		accessorKey: "helpLink",
		header: "",
		cell: (info) => issueCell("helpLink", info.getValue()),
		enableSorting: false,
		enableGlobalFilter: false,
	},
];

const table = createTable({
	features: btcmapTableFeatures,
	columns,
	get data() {
		return rows;
	},
	initialState: {
		// svelte-ignore state_referenced_locally -- initialState is initial by design
		pagination: { pageIndex: 0, pageSize: initialPageSize },
	},
	globalFilterFn: "fuzzy",
});

const handleKeyUp = (e: KeyboardEvent) => {
	table.setGlobalFilter(String((e.target as HTMLInputElement)?.value));
};

const searchDebounce = debounce((e) => handleKeyUp(e));
</script>

<section id="issues">
	<div class="w-full rounded-3xl border border-gray-300 dark:border-white/95 dark:bg-white/10">
		<h3
			class="border-b border-gray-300 p-5 text-center text-lg font-semibold text-primary md:text-left dark:border-white/95 dark:text-white"
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
					<Icon type="fa" icon="table" w="96" h="96" class="animate-pulse text-link/50" />
				</div>
			</div>
		{:else if !issues.length}
			<p class="w-full p-5 text-center text-primary dark:text-white">{$_(`maintain.noTaggingIssues`)}</p>
		{:else}
			<LeaderboardSearch {table} bind:globalFilter {searchDebounce} />
			{#if table.getFilteredRowModel().rows.length === 0}
				<p class="w-full p-5 text-center text-primary dark:text-white">{$_(`leaderboard.noResults`)}</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-left whitespace-nowrap text-primary dark:text-white">
						<thead>
							{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
								<tr>
									{#each headerGroup.headers as header (header.id)}
										<th
											colSpan={header.colSpan}
											class="px-5 pt-5 pb-2.5"
											aria-sort={resolveAriaSort(header)}
										>
											<SortableHeaderCell {header} />
										</th>
									{/each}
								</tr>
							{/each}
						</thead>
						<tbody>
							{#each table.getRowModel().rows as row, index (row.id)}
								<tr class={isEven(index) ? 'bg-primary/5 dark:bg-white/5' : ''}>
									{#each row.getAllCells() as cell (cell.id)}
										<td class="px-5 py-2.5">
											<FlexRender {cell} />
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<LeaderboardPagination {table} {pageSizes} />
			{/if}
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

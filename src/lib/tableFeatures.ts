import type { RankingInfo } from "@tanstack/match-sorter-utils";
import { rankItem } from "@tanstack/match-sorter-utils";
import type {
	FilterFn,
	Header,
	RowData,
	TableFeatures,
} from "@tanstack/svelte-table";
import {
	columnFilteringFeature,
	createFilteredRowModel,
	createPaginatedRowModel,
	createSortedRowModel,
	globalFilteringFeature,
	metaHelper,
	rowPaginationFeature,
	rowSortingFeature,
	sortFn_alphanumeric,
	sortFn_datetime,
	sortFn_text,
	tableFeatures,
} from "@tanstack/svelte-table";

type FuzzyFilterMeta = {
	itemRank?: RankingInfo;
};

type FuzzyFeatures = TableFeatures & { filterMeta: FuzzyFilterMeta };

// Ranks the cell value against the query via match-sorter — registered as
// the typed 'fuzzy' filterFn below so tables can reference it by string in
// columnDef.filterFn and globalFilterFn.
const fuzzyFilter: FilterFn<FuzzyFeatures, any> = (
	row,
	columnId,
	value,
	addMeta,
) => {
	const itemRank = rankItem(row.getValue(columnId), value);
	addMeta?.({ itemRank });
	return itemRank.passed;
};

// The one feature set every table in the app uses: sorting, pagination,
// column + global filtering. Row-model factories are pure per-table (their
// caches live on the table instance), so sharing this object across all
// table instances is safe.
export const btcmapTableFeatures = tableFeatures({
	columnFilteringFeature,
	globalFilteringFeature,
	rowPaginationFeature,
	rowSortingFeature,
	filteredRowModel: createFilteredRowModel(),
	paginatedRowModel: createPaginatedRowModel(),
	sortedRowModel: createSortedRowModel(),
	filterFns: { fuzzy: fuzzyFilter },
	// v9 resolves sortFn: 'auto' (the columnDef default) BY NAME through this
	// registry — without these, string columns silently degrade to a
	// case-sensitive charCode compare instead of the lowercased text sort.
	sortFns: {
		alphanumeric: sortFn_alphanumeric,
		datetime: sortFn_datetime,
		text: sortFn_text,
	},
	filterMeta: metaHelper<FuzzyFilterMeta>(),
});

export type BtcmapTableFeatures = typeof btcmapTableFeatures;

// Resolves a column's header definition to a plain-text label (for
// aria-labels): function headers are invoked with the header context,
// string headers pass through, anything else falls back to the column id.
export const resolveHeaderLabel = <TData extends RowData>(
	header: Header<BtcmapTableFeatures, TData, any>,
): string => {
	const def = header.column.columnDef.header;
	if (typeof def === "function") return String(def(header.getContext()));
	return typeof def === "string" ? def : header.column.id;
};

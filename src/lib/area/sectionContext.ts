import { getContext } from "svelte";
import type { Readable } from "svelte/store";

import type { Place, Tagger } from "$lib/types";

import type { AreaReport } from "$types/btcmap-api/AreaReport";

// Set once by AreaLayout at init; entries are stores because context
// values freeze at first render — contents mutate, entries never do.
export const AREA_SECTION_CONTEXT = Symbol("area-section");

export type AreaSectionContext = {
	// Containment-sweep result for the current area (merchants section).
	filteredPlaces: Readable<Place[]>;
	// True once the current area's sweep has published — the highlights'
	// skeleton gate (empty filteredPlaces before = still sweeping).
	sweepDone: Readable<boolean>;
	// The area's report history, newest-first ([] for sections that don't
	// fetch reports). Drives the stats branches AND the merchants AreaMap
	// grade stars.
	areaReports: Readable<AreaReport[]>;
	// True when the reports fetch failed for this section; the stats section
	// renders its inline error instead of the empty/report states.
	reportsError: Readable<boolean>;
	taggers: Readable<Tagger[]>;
	taggersLoaded: Readable<boolean>;
	taggersInFlight: Readable<boolean>;
	taggersLoadError: Readable<boolean>;
	// Starts a top-editors fetch iff not loaded/in-flight; stale
	// completions are discarded by the layout's generation token.
	ensureTaggers: () => void;
};

export const getAreaSectionContext = (): AreaSectionContext =>
	getContext(AREA_SECTION_CONTEXT);

import { getContext } from "svelte";
import type { Readable } from "svelte/store";

import type { Place, Report, Tagger } from "$lib/types";

// Set once by AreaLayout at init; entries are stores because context
// values freeze at first render — contents mutate, entries never do.
export const AREA_SECTION_CONTEXT = Symbol("area-section");

export type AreaSectionContext = {
	// Containment-sweep result for the current area (merchants section).
	filteredPlaces: Readable<Place[]>;
	// True once the current area's sweep has published — the highlights'
	// skeleton gate (empty filteredPlaces before = still sweeping).
	sweepDone: Readable<boolean>;
	// undefined = reports still loading; [] = feed loaded, none for this
	// area; array = data. The tri-state drives the stats branches AND the
	// merchants AreaMap grade stars — do not collapse it.
	areaReports: Readable<Report[] | undefined>;
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

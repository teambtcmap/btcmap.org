<script lang="ts">
import { _ } from "svelte-i18n";

import { goto } from "$app/navigation";
import { page } from "$app/state";

export let type: "country" | "community";

import type { GeoJSON } from "geojson";
import { onDestroy, onMount, setContext } from "svelte";
import { get, toStore, writable } from "svelte/store";

import AreaHeader from "$components/area/AreaHeader.svelte";
import Icon from "$components/Icon.svelte";
import { API_BASE } from "$lib/api-base";
import { placesInAreaChunked } from "$lib/area/placesInArea";
import type { AreaSectionContext } from "$lib/area/sectionContext";
import { AREA_SECTION_CONTEXT } from "$lib/area/sectionContext";
import api from "$lib/axios";
import { places, placesError, reportError, reports } from "$lib/store";
import { batchSync } from "$lib/sync/batchSync";
import { placesPublished } from "$lib/sync/placeCache";
import { reportsSync } from "$lib/sync/reports";
import type { AreaPageProps, Place, Report, Tagger } from "$lib/types.js";
import { errToast } from "$lib/utils";

onMount(() => {
	// reportsSync feeds the stats section and the AreaMap grade stars. The
	// world areas crawl (areasSync) is gone: the SSR bundle now carries this
	// area's full tags, polygon included (#1174).
	batchSync([reportsSync]);
});

// alert for element errors
$: $placesError && errToast($placesError);
// alert for report errors
$: $reportError && errToast($reportError);

// One source of truth: the section id IS the route slug IS the i18n key
// suffix — the previous enum + three parallel Records carried no information.
const SECTIONS = ["merchants", "stats", "activity", "maintain"] as const;
type Section = (typeof SECTIONS)[number];

let scrolled = false;

// The layout takes no load; merged page.data carries every section's
// loadAreaSection result and is reactive across child navigations only
// through this toStore bridge (a bare $: on page.data runs once).
const pageData = toStore(() => page.data as AreaPageProps);
$: data = $pageData;

// The section IS the route: literal child directories replaced the
// [section] param. Fallback covers the redirect moment only.
const routeId = toStore(() => page.route.id);
$: activeSection = (() => {
	const last = $routeId?.split("/").at(-1) ?? "";
	return (SECTIONS as readonly string[]).includes(last)
		? (last as Section)
		: ("merchants" as Section);
})();

const handleSectionChange = (section: Section) => {
	goto(`/${type}/${encodeURIComponent(data.id)}/${section}`);
};
// taggersInFlight prevents re-fire during the async fetch; taggersLoaded
// gates the UI so the skeleton stays up until the fetch completes. Per-
// request transient failures are handled by axiosRetry on the shared
// $lib/axios instance, so a single attempt is sufficient.
// taggersFetchGeneration is a monotonic request token: each fetch
// captures the current value and later compares it to discard its result
// if a newer fetch has since started (including same-area re-entry,
// which an area-id guard cannot distinguish).
const taggersInFlight = writable(false);
const taggersLoaded = writable(false);
const taggersLoadError = writable(false);
let taggersFetchGeneration = 0;

const fetchAreaTopEditors = async () => {
	if (get(taggersInFlight) || get(taggersLoaded) || !data?.id) return;

	// Capture a monotonic token at start. The lastAreaId reactive cannot
	// cancel an in-flight promise, and an area-id guard alone would miss
	// same-area re-entry (A→B→A leaves two A fetches pending with matching
	// ids). The token distinguishes them so stale completions return silently.
	const gen = ++taggersFetchGeneration;
	taggersInFlight.set(true);
	try {
		const url = `${API_BASE}/v4/areas/${encodeURIComponent(data.id)}/top-editors?limit=100`;
		const response = await api.get<Tagger[]>(url);
		if (gen !== taggersFetchGeneration) return;
		taggers.set(response.data);
	} catch (error) {
		if (gen !== taggersFetchGeneration) return;
		console.warn("Failed to fetch area top editors:", error);
		taggersLoadError.set(true);
	} finally {
		// Only flip flags if this is still the most recent fetch. Stale
		// completions return silently above; the newer fetch owns its own
		// state. Mark loaded after any completed attempt (success OR final
		// failure after axiosRetry exhausts its retries) so the UI falls
		// through to the empty state instead of hanging on the skeleton.
		if (gen === taggersFetchGeneration) {
			taggersLoaded.set(true);
			taggersInFlight.set(false);
		}
	}
};

// The containment sweep is decoupled from init: the header and AreaMap
// mount immediately off the SSR bundle, and the pins land when $places and
// the chunked sweep are done. Once per area (matching the old semantics —
// later $places republications don't resweep), generation-guarded so an
// area navigation abandons an in-flight sweep, publishing one fresh array
// per completed sweep — never a partial one.
let sweepGeneration = 0;
let sweptAreaId: string | undefined;
// True once the current area's sweep has published — the merchant
// highlights' skeleton gate (an empty filteredPlaces before this is
// "still sweeping", after it is a genuine empty area).
const sweepDone = writable(false);

// Leaving the page entirely must abandon an in-flight sweep at its next
// chunk boundary — without this it would burn through the remaining ~29k
// geoContains tests for a component that no longer exists.
onDestroy(() => {
	sweepGeneration++;
});

const runContainmentSweep = async (areaPlaces: Place[], geoJson: GeoJSON) => {
	const generation = ++sweepGeneration;
	const result = await placesInAreaChunked(areaPlaces, geoJson, {
		isStale: () => generation !== sweepGeneration,
	});
	if (result && generation === sweepGeneration) {
		filteredPlaces.set(result);
		sweepDone.set(true);
	}
};

// Header state is fully derived (inside AreaHeader) and `area` below derives
// too — the only state needing an explicit reset on client-side area
// navigation is the async machinery: the taggers fetch and the containment
// sweep. SvelteKit reuses this component instance across
// /country/X/* → /country/Y/* transitions.
let lastAreaId: string | undefined;
$: if (data?.id !== lastAreaId) {
	lastAreaId = data.id;
	taggersInFlight.set(false);
	taggersLoaded.set(false);
	taggersLoadError.set(false);
	// Invalidate any in-flight fetch so its completion can't stomp the new
	// area's state even if we cross sections and the fetch reactive doesn't
	// re-fire to bump the token on its own.
	taggersFetchGeneration++;
	taggers.set([]);
	filteredPlaces.set([]);
	// Abandon any in-flight containment sweep and let the new area resweep.
	sweepGeneration++;
	sweptAreaId = undefined;
	sweepDone.set(false);
}

// Source order matters (the #1177 lesson): this must sit BELOW the reset
// reactive so an area navigation resets sweep state before the guard is
// evaluated — otherwise it would fire once against the outgoing area's
// polygon.
// Gate on publication, not $places.length: length can't distinguish "still
// hydrating" from "legitimately empty", so an empty-but-complete dataset
// would strand the highlights skeleton. A published empty store sweeps to
// [] and completes like any other result.
$: if (area?.geo_json && $placesPublished && sweptAreaId !== data.id) {
	sweptAreaId = data.id;
	runContainmentSweep($places, area.geo_json);
}

// Returns undefined while loading, empty array if no reports for this area, or filtered reports
// A $:, not a derived(): a derived would capture data.id in its closure
// and go stale on X→Y navigation.
const areaReports = writable<Report[] | undefined>(undefined);
$: areaReports.set(
	data?.id && $reports.length > 0
		? $reports
				.filter((report) => report.area_id === data.id)
				.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
		: undefined,
);

// Derived, not initialized: a `const area = data.tags` would freeze the
// first area's tags for the lifetime of the reused component instance —
// stale after any client-side area navigation.
$: area = data.tags;
const filteredPlaces = writable<Place[]>([]);

const taggers = writable<Tagger[]>([]);

setContext(AREA_SECTION_CONTEXT, {
	filteredPlaces,
	sweepDone,
	areaReports,
	taggers,
	taggersLoaded,
	taggersInFlight,
	taggersLoadError,
	ensureTaggers: fetchAreaTopEditors,
} satisfies AreaSectionContext);
</script>

<main class="my-10 space-y-16 text-center md:my-20">
<AreaHeader {type} {data} />

	<div
		on:scroll={() => (scrolled = true)}
		class="hide-scroll relative grid w-full auto-cols-[minmax(150px,_1fr)] grid-flow-col overflow-x-auto"
	>
		{#each SECTIONS as section (section)}
			<button
				on:click={() => handleSectionChange(section)}
				class="border-b-4 pb-3 text-center text-lg text-link transition-colors hover:border-link {activeSection ===
				section
					? 'border-link font-bold'
					: 'border-link/25'}"
			>
				{$_(`area.sections.${section}`)}
			</button>
		{/each}

		{#if !scrolled}
			<div
				class="absolute top-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-[#cce3e6] sm:hidden"
			>
				<Icon type="fa" icon="chevron-right" w="16" h="16" class="text-link" />
			</div>
		{/if}
	</div>

	<slot />
</main>

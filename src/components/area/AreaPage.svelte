<script lang="ts">
import { _ } from "svelte-i18n";

import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { page } from "$app/stores";

export let type: "country" | "community";
export let data: AreaPageProps;

import type { GeoJSON } from "geojson";
import { onDestroy, onMount } from "svelte";

import AreaActivity from "$components/area/AreaActivity.svelte";
import AreaHeader from "$components/area/AreaHeader.svelte";
import AreaMap from "$components/area/AreaMap.svelte";
import AreaMerchantHighlights from "$components/area/AreaMerchantHighlights.svelte";
import AreaStats from "$components/area/AreaStats.svelte";
import AreaTickets from "$components/area/AreaTickets.svelte";
import VerifyCommunityForm from "$components/area/VerifyCommunityForm.svelte";
import Boost from "$components/Boost.svelte";
import Icon from "$components/Icon.svelte";
import IssuesTable from "$components/IssuesTable.svelte";
import { API_BASE } from "$lib/api-base";
import { placesInAreaChunked } from "$lib/area/placesInArea";
import api from "$lib/axios";
import { places, placesError, reportError, reports } from "$lib/store";
import { batchSync } from "$lib/sync/batchSync";
import { reportsSync } from "$lib/sync/reports";
import type { AreaPageProps, Place, PlaceIssue, Tagger } from "$lib/types.js";
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

$: activeSection = (SECTIONS as readonly string[]).includes(
	$page.params.section ?? "",
)
	? ($page.params.section as Section)
	: ("merchants" as Section);

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
let taggersInFlight = false;
let taggersLoaded = false;
let taggersLoadError = false;
let taggersFetchGeneration = 0;

const fetchAreaTopEditors = async () => {
	if (taggersInFlight || taggersLoaded || !data?.id) return;

	// Capture a monotonic token at start. The lastAreaId reactive cannot
	// cancel an in-flight promise, and an area-id guard alone would miss
	// same-area re-entry (A→B→A leaves two A fetches pending with matching
	// ids). The token distinguishes them so stale completions return silently.
	const gen = ++taggersFetchGeneration;
	taggersInFlight = true;
	try {
		const url = `${API_BASE}/v4/areas/${encodeURIComponent(data.id)}/top-editors?limit=100`;
		const response = await api.get<Tagger[]>(url);
		if (gen !== taggersFetchGeneration) return;
		taggers = response.data;
	} catch (error) {
		if (gen !== taggersFetchGeneration) return;
		console.warn("Failed to fetch area top editors:", error);
		taggersLoadError = true;
	} finally {
		// Only flip flags if this is still the most recent fetch. Stale
		// completions return silently above; the newer fetch owns its own
		// state. Mark loaded after any completed attempt (success OR final
		// failure after axiosRetry exhausts its retries) so the UI falls
		// through to the empty state instead of hanging on the skeleton.
		if (gen === taggersFetchGeneration) {
			taggersLoaded = true;
			taggersInFlight = false;
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
let sweepDone = false;

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
		filteredPlaces = result;
		sweepDone = true;
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
	taggersInFlight = false;
	taggersLoaded = false;
	taggersLoadError = false;
	// Invalidate any in-flight fetch so its completion can't stomp the new
	// area's state even if we cross sections and the fetch reactive doesn't
	// re-fire to bump the token on its own.
	taggersFetchGeneration++;
	taggers = [];
	filteredPlaces = [];
	// Abandon any in-flight containment sweep and let the new area resweep.
	sweepGeneration++;
	sweptAreaId = undefined;
	sweepDone = false;
}

// Source order matters (the #1177 lesson): this must sit BELOW the reset
// reactive so an area navigation resets sweep state before the guard is
// evaluated — otherwise it would fire once against the outgoing area's
// polygon.
$: if (area?.geo_json && $places.length && sweptAreaId !== data.id) {
	sweptAreaId = data.id;
	runContainmentSweep($places, area.geo_json);
}

// Fire the area top-editors fetch only when the user actually lands on /activity.
// One REST call replaces the previous per-place enrichment shim.
$: if (
	browser &&
	activeSection === "activity" &&
	!taggersInFlight &&
	!taggersLoaded
) {
	fetchAreaTopEditors();
}

// Returns undefined while loading, empty array if no reports for this area, or filtered reports
$: areaReports =
	data?.id && $reports.length > 0
		? $reports
				.filter((report) => report.area_id === data.id)
				.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
		: undefined;

// Derived, not initialized: the previous `const alias/name` froze the
// first area's values for the lifetime of the reused component instance —
// stale after any client-side area navigation.
$: area = data.tags;
$: alias = data.id;
let name: string;
$: name = data.name;
let filteredPlaces: Place[] = [];

let taggers: Tagger[] = [];

let issues: PlaceIssue[] = [];
// Reactive, not latched at init: issues arrive only with the maintain
// section's load (per-section pruning in areaSectionLoad), so a
// merchants -> maintain navigation must pick them up.
$: issues = data?.issues ?? [];
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

	{#if activeSection === 'merchants'}
		<AreaMap
			{name}
			geoJSON={area?.geo_json}
			{filteredPlaces}
			cameraBbox={data.cameraBbox}
			upToDatePercent={areaReports?.[0]?.tags.up_to_date_percent}
		/>
		<!-- Gate on sweep completion, not dataInitialized: init now finishes
		     before the sweep, and an empty filteredPlaces mid-sweep is "still
		     loading", not "no merchants here". -->
		<AreaMerchantHighlights dataInitialized={sweepDone} {filteredPlaces} />
		{#if browser}
			<Boost />
		{/if}
	{:else if activeSection === 'stats'}
		{#if $reportError}
			<div class="text-center text-primary dark:text-white">
				<p>{$_('area.errorLoadingData')}</p>
			</div>
		{:else if areaReports === undefined}
			<div class="text-center text-primary dark:text-white">
				<p>{$_('area.loadingData')}</p>
			</div>
		{:else if areaReports.length > 0}
			<AreaStats {name} {areaReports} areaTags={area} />
		{:else}
			<div class="text-center text-primary dark:text-white">
				<p class="text-xl">{$_('area.dataWithin24Hours')}</p>
			</div>
		{/if}
	{:else if activeSection === 'activity'}
		<!-- Area data is SSR-delivered now, so it is initialized by definition;
		     the prop survives until AreaFeed drops its gate. -->
		<AreaActivity
			{alias}
			{name}
			dataInitialized={true}
			{taggersLoaded}
			{taggers}
			{taggersLoadError}
		/>
	{:else if activeSection === 'maintain'}
		<IssuesTable
			title={$_('area.taggingIssues', { values: { name: name || $_('area.defaultName') } })}
			{issues}
			loading={false}
		/>
		<AreaTickets tickets={data.tickets} title={$_('area.openTickets', { values: { name: name || $_('area.defaultName') } })} />
		{#if type === 'community'}
			<div
				id="verify-form"
				class="mx-auto w-full max-w-[1000px] rounded-3xl border border-link/25 p-8 xl:w-[1000px]"
			>
				<VerifyCommunityForm communityName={name} communityAlias={alias} />
			</div>
		{/if}
	{/if}
</main>

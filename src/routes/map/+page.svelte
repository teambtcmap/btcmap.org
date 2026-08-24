<script lang="ts">
import "maplibre-gl/dist/maplibre-gl.css";

import Spiderfy from "@nazka/map-gl-js-spiderfy";
import type {
	FilterSpecification,
	LngLatBounds,
	MapGeoJSONFeature,
	MapLayerMouseEvent,
	Map as MapLibreMap,
	Marker,
} from "maplibre-gl";
import { onDestroy, onMount, tick } from "svelte";
import { get } from "svelte/store";
import { fade } from "svelte/transition";

import CommunityRail from "$components/CommunityRail.svelte";
import MapLoadingMain from "$components/MapLoadingMain.svelte";
import MapUnsupportedFallback from "$components/MapUnsupportedFallback.svelte";
import { trackEvent } from "$lib/analytics";
import {
	BREAKPOINTS,
	CLUSTERING_DISABLED_ZOOM,
	DEFAULT_MAP_LAT,
	DEFAULT_MAP_LNG,
	DEFAULT_MAP_ZOOM,
	LABEL_VISIBLE_ZOOM,
	MAP_DEBOUNCE_DELAY,
	MAP_PANEL_MARGIN,
	MERCHANT_LIST_FETCH_CEILING,
	MERCHANT_LIST_MIN_ZOOM,
	MERCHANT_LIST_WIDTH,
	NEARBY_RADIUS_MULTIPLIER,
	PANEL_DRAWER_GAP,
} from "$lib/constants";
import { SEARCH_SHEET_PEEK_HEIGHT } from "$lib/drawerConfig";
import { _, getDisplayLang, locale } from "$lib/i18n";
import {
	BASEMAPS,
	type BasemapId,
	defaultBasemap,
	getStoredBasemap,
	SUPPORT_ATTR,
	styleForBasemap,
} from "$lib/map/basemaps";
import { shouldClusterBoostedAtZoom } from "$lib/map/boostedClustering";
import type { BtcmapMapHandle } from "$lib/map/createMap";
import { createBtcmapMap } from "$lib/map/createMap";
import {
	type HashCoords,
	parseHashCoords,
	writeHashCoords,
} from "$lib/map/mapHash";
import {
	ensureSpritesForPlaces,
	PIN_FILLS,
	pinIconImageExpression,
	pinVariantFor,
} from "$lib/map/maplibreSprites";
import {
	parsePaymentMethodsParam,
	placeMatchesPaymentMethods,
} from "$lib/map/paymentMethodFilter";
import { createPlacePinSource } from "$lib/map/placePinSource";
import { parseLatLongQuery } from "$lib/map/queryViewport";
import type { VerifiedFilterYears } from "$lib/map/verifiedFilter";
import {
	calculateRadiusKmFromLngLatBounds,
	getZoomBehavior,
} from "$lib/map/viewport";
import { loadCachedView, saveCachedView } from "$lib/map/viewportCache";
import {
	computeVisibleSignature,
	placesRevision,
	selectVisiblePlaces,
} from "$lib/map/visiblePlaces";
import {
	MERCHANT_URL_CHANGE_EVENT,
	parseMerchantHash,
	withLiteralCommas,
} from "$lib/merchantDrawerHash";
import { merchantDrawer } from "$lib/merchantDrawerStore";
import { merchantList } from "$lib/merchantListStore";
import type { DerivedIssueCode } from "$lib/placeIssues";
import {
	countIssuesByCode,
	parseIssuesParam,
	placeMatchesIssueCodes,
	serializeIssuesParam,
} from "$lib/placeIssues";
import { savedPlaceIds } from "$lib/session";
import {
	paymentTagsLoaded,
	places,
	placesById,
	placesError,
	placesLoadingProgress,
	placesLoadingStatus,
	verifiedDatesLoaded,
} from "$lib/store";
import { ensurePaymentMethods, ensureVerifiedDates } from "$lib/sync/places";
import { theme } from "$lib/theme";
import type { Place } from "$lib/types";
import { userLocation } from "$lib/userLocationStore";
import { debounce, errToast, isBoosted } from "$lib/utils";
import { filterPlacesByRecency } from "$lib/verification";

import type { PageData } from "./$types";
import AddPlaceMode from "./components/AddPlaceMode.svelte";
import IssueFilterChips from "./components/IssueFilterChips.svelte";
import MapControls from "./components/MapControls.svelte";
import MapSearchBar from "./components/MapSearchBar.svelte";
import MerchantDrawerHash from "./components/MerchantDrawerHash.svelte";
import MerchantListPanel from "./components/MerchantListPanel.svelte";
import TileLoadingIndicator from "./components/TileLoadingIndicator.svelte";
import { browser } from "$app/environment";
import { replaceState } from "$app/navigation";

export let data: PageData;

// Layout decision locked at init (same pattern as MerchantDrawerHash): the
// mobile search sheet and the desktop floating bar derive from one value so
// a viewport resize can never leave zero or two search surfaces
const isMobileLayout = browser && window.innerWidth < BREAKPOINTS.md;

// Lets the floating search bar hand focus to the panel's input as it unmounts
let merchantListPanel: MerchantListPanel;

let placementActive = false;

// Placement mode owns the bottom sheet's z-[1002] slot; a merchant drawer
// opened before (or during, via a stray pin click below) placement starts
// would otherwise stack on top of it. close() also cleans up ?merchant/?view
// the same way the existing empty-map-click close path does. Guard on isOpen
// (matching that same close path) so ordinary placement entry doesn't push a
// duplicate, unchanged-URL history entry via close()'s unconditional
// updateMerchantHash(null) → pushState.
$: if (placementActive && $merchantDrawer.isOpen) merchantDrawer.close();

// "Boosted locations only" map filter (?boosts=true). The tools modal sets it
// via a full page reload, so it's constant for the session; it narrows both the
// map markers and the nearby list to currently-boosted places.
const boostsOnly =
	browser &&
	new URLSearchParams(window.location.search).get("boosts") === "true";

// "Outdated only" deep link (?outdated, any value — presence alone counts,
// matching the legacy Leaflet param): seed the verified-recency filter's
// inverse mode so the map becomes a re-verification worklist. Session-only
// (no persist): a shared link must not overwrite the visitor's stored
// preference.
const outdatedOnly =
	browser && new URLSearchParams(window.location.search).has("outdated");
if (outdatedOnly) {
	merchantList.setVerifiedFilter("outdated", { persist: false });
}

// "Issues only" deep link (?issues, presence alone counts, like ?outdated):
// narrow the map to places with at least one derived issue — the
// contributor worklist view (#921). Session-only and page-scoped like
// ?boosts: no persisted state, no store mode; the filter engages once the
// verified_at enrichment lands. A value narrows to specific categories
// (?issues=outdated,not_verified); bare ?issues means all of them. The
// chips bar reassigns selectedIssueCodes as the visitor toggles categories,
// while mode membership itself stays locked for the session.
const issuesOnly =
	browser && new URLSearchParams(window.location.search).has("issues");
let selectedIssueCodes: ReadonlySet<DerivedIssueCode> | null = issuesOnly
	? parseIssuesParam(new URLSearchParams(window.location.search).get("issues"))
	: null;

// Payment-method embed filter (#1269): bare ?onchain&lightning&nfc params
// (presence alone, legacy Leaflet contract) narrow everything to places that
// accept every selected method. Locked for the session like ?boosts/?issues;
// seeded into the store so lists and counts filter identically to pins.
const paymentMethods = browser
	? parsePaymentMethodsParam(new URLSearchParams(window.location.search))
	: null;
if (paymentMethods) {
	merchantList.setPaymentMethods(paymentMethods);
}

// Viewport issue tallies for the chips bar, computed in updateMerchantList's
// local-markers path (issues mode always forces that path). Null until the
// verified_at enrichment lands so the chips don't show all-zero counts.
let issueCounts: Record<DerivedIssueCode, number> | null = null;

// Chip toggle: reassign the set (the render block and updateMerchantList
// both read it), mirror the selection into ?issues= via a shallow
// replaceState so the worklist URL stays shareable — no navigation, the
// mode itself is locked for the session.
const toggleIssueCode = (code: DerivedIssueCode) => {
	const next = new Set(selectedIssueCodes ?? []);
	if (next.has(code)) {
		next.delete(code);
	} else {
		next.add(code);
	}
	selectedIssueCodes = next;
	const url = new URL(window.location.href);
	url.searchParams.set("issues", serializeIssuesParam(next));
	replaceState(withLiteralCommas(url.toString()), {});
	updateMerchantList({ force: true });
};

// Desktop chips-bar left edge: the left column is always occupied by the
// search facade or the list panel (same width), so the bar starts right of
// that slot in both states — a fixed row, nothing to chase. It still HIDES
// while the merchant drawer is open: the user is acting on one place then,
// and the drawer overlaps the top strip.
const CHIPS_DESKTOP_LEFT =
	MAP_PANEL_MARGIN + MERCHANT_LIST_WIDTH + PANEL_DRAWER_GAP;
$: chipsHiddenForDrawer = !isMobileLayout && $merchantDrawer.isOpen;

// Exit via full reload on purpose: mode membership (issuesOnly, list
// behavior, filter wiring) is locked at init, same as entering via URL.
const exitIssuesMode = () => {
	const url = new URL(window.location.href);
	url.searchParams.delete("issues");
	window.location.href = url.toString();
};

let mapContainer: HTMLDivElement;
let map: MapLibreMap | undefined;
let mapHandle: BtcmapMapHandle | undefined;
let destroyed = false;
let spiderfier: Spiderfy | undefined;
let styleLoaded = false;
let webglUnsupported = false;
let lastAppliedLabelTheme: "light" | "dark" | undefined;
// The one render signature gating syncPlacesToSource: the visibility
// signature (computeVisibleSignature — mode/category/recency/gate/boosts/
// $placesRevision/search ids) joined with the render-only inputs (saved-ids
// size, enriched-cache size, locale). Empty string forces a sync.
let lastRenderSig = "";

// The pin/cluster/badge/label/heatmap rendering facade (#1170). Owns the
// sources, layers, sprites, feature building, boosted routing, and heatmap
// visibility; this page keeps interactions, spiderfy, camera, and the label
// palette. The deps are read as snapshots on every render — saved state and
// enriched names arrive lazily.
// Snapshot for the pin-color dep below: the selected issue categories once
// the readiness gate has passed, null otherwise. Written by the render block
// so every render path (signature change, zoom resync, boosted re-route)
// reads the same gated value.
let pinIssueCodes: ReadonlySet<DerivedIssueCode> | null = null;

const pinSource = createPlacePinSource({
	getSavedIds: () => get(savedPlaceIds),
	getEnrichedCache: () => get(merchantList).placeDetailsCache,
	getDisplayLang: () => getDisplayLang(get(locale)),
	getIssueCodes: () => pinIssueCodes,
	onRendered: (count) => {
		if (count > 0) elementsLoaded = true;
		// E2E test hook: Playwright can't probe WebGL canvas pins like it
		// could probe Leaflet's DOM markers, so we expose the count for
		// `waitForMarkersToLoad` to gate on. No-op outside tests.
		if (typeof window !== "undefined") {
			(window as unknown as { __mapPlacesCount?: number }).__mapPlacesCount =
				count;
		}
	},
});

// Place-label colors. MapLibre paint expressions can't read CSS custom
// properties, so the values are inlined here.
const LABEL_PALETTE = {
	light: {
		regular: "#0e7490", // cyan-700
		boosted: "#f97316", // orange-500
		halo: "#ffffff",
	},
	dark: {
		regular: "#22d3ee", // cyan-400 — brighter for dark backgrounds
		boosted: "#fb923c", // orange-400
		halo: "rgba(0, 0, 0, 0.95)",
	},
};

const applyLabelPalette = (m: MapLibreMap, t: "light" | "dark" | undefined) => {
	if (!m.getLayer("place-label")) return;
	const palette = LABEL_PALETTE[t === "dark" ? "dark" : "light"];
	m.setPaintProperty("place-label", "text-color", [
		"case",
		["get", "boosted"],
		palette.boosted,
		palette.regular,
	]);
	m.setPaintProperty("place-label", "text-halo-color", palette.halo);
	// Mirror on the parallel boosted-source label layer (always boosted, so
	// no case expression needed). Guarded separately in case this is called
	// before that layer was added.
	if (m.getLayer("boosted-place-label")) {
		m.setPaintProperty("boosted-place-label", "text-color", palette.boosted);
		m.setPaintProperty("boosted-place-label", "text-halo-color", palette.halo);
	}
};
// Deep-link pan: if the user lands on a URL with `merchant=…` but no
// viewport coords, we wait for the place to appear in `$placesById`
// then pan to it. Track the subscription + safety timer so onDestroy
// can clean both up.
let deepLinkPanUnsub: (() => void) | null = null;
let deepLinkPanTimer: ReturnType<typeof setTimeout> | null = null;

// Zoom level that reveals a single selected merchant: just past
// CLUSTERING_DISABLED_ZOOM (17) so it declusters into its own pin (with the
// selection pulse on top) rather than being absorbed into a cluster. The
// DEFAULT_MAP_ZOOM (15) the deep-link pan used to land on still clusters.
const REVEAL_ZOOM = 17.5;

const panToPlace = (lat: number, lon: number) => {
	if (!map) return;
	map.easeTo({ center: [lon, lat], zoom: REVEAL_ZOOM, duration: 300 });
};

// Selected-merchant highlight (design "C — centered pulsing locator"): the GL
// pin scales up, and a single DOM overlay marker — a pulsing ring + a center
// dot in the pin's own hue — sits on the selected pin's geo point. The pulse
// is pure CSS (composited, honors prefers-reduced-motion), so the GL pin layer
// stays untouched and fast. `maplibre` is imported dynamically in onMount, so
// we stash the namespace here to construct the Marker reactively.
let maplibreNs: typeof import("maplibre-gl") | null = null;
let pulseMarker: Marker | null = null;
let pulsePinId: number | null = null; // merchant the pulse overlay is on

const buildPulseElement = (): HTMLDivElement => {
	const el = document.createElement("div");
	el.className = "bm-selected-pulse";
	el.style.pointerEvents = "none";
	el.innerHTML =
		'<span class="bm-pulse-ring"></span>' +
		'<span class="bm-pulse-ring bm-pulse-ring--delay"></span>' +
		'<span class="bm-pulse-dot"></span>';
	return el;
};

// Hide the pulse when the selected merchant has been rolled into a cluster at
// the current zoom (there's no individual pin to sit on, so the pulse would
// float orphaned); show it again once the pin renders individually. Regular
// places live in the clustered `places` source; boosted places do too, but
// only at/below BOOSTED_CLUSTERING_MAX_ZOOM — above it they ride the
// non-clustered boosted source and are always individually visible. We query
// the live source state rather than a zoom threshold — whether a point
// clusters depends on its neighbours, not just the zoom level.
const updatePulseVisibility = () => {
	if (!map || !pulseMarker || pulsePinId === null) return;
	const place = get(placesById).get(pulsePinId);
	let visible = true;
	const inClusteredSource =
		!!place && (!isBoosted(place) || shouldClusterBoostedAtZoom(map.getZoom()));
	if (inClusteredSource) {
		const filter: FilterSpecification = [
			"all",
			["!", ["has", "point_count"]],
			["==", ["get", "id"], pulsePinId],
		];
		visible = map.querySourceFeatures("places", { filter }).length > 0;
	}
	pulseMarker.getElement().style.display = visible ? "" : "none";
};

// Show / move / hide the locator pulse for the selected merchant. Needs the
// place's coordinates, so it no-ops until the place is in $placesById — a
// deep-linked merchant gets its pulse once places sync in (the reactive below
// re-runs on $places).
const syncSelectionPulse = (selectedId: number | null) => {
	if (!map || !maplibreNs) return;
	if (selectedId === null) {
		pulseMarker?.remove();
		pulsePinId = null;
		return;
	}
	const place = get(placesById).get(selectedId);
	if (!place) return; // not loaded yet
	const isNewSelection = pulsePinId !== selectedId;
	if (!pulseMarker) {
		pulseMarker = new maplibreNs.Marker({
			element: buildPulseElement(),
			anchor: "center",
		});
	}
	// Keep colour + position in sync with the place even when the selection is
	// unchanged: boosting from the drawer recolours the pin (teal → orange) and
	// fires the $places reactive, and the pulse must follow. setProperty,
	// setLngLat and addTo are idempotent on an already-added marker, so this
	// stays cheap on every $places tick. Colours come from the same variant
	// lookup as the GL pin sprite so the two can't desync — issue-colored
	// pins in ?issues mode get a matching pulse, not the boost/regular one.
	const color = PIN_FILLS[pinVariantFor(place, pinIssueCodes)];
	pulseMarker.getElement().style.setProperty("--bm-pulse-color", color);
	pulseMarker.setLngLat([place.lon, place.lat]).addTo(map);
	pulsePinId = selectedId;
	// Reconcile cluster-based visibility only on a real selection change;
	// moveend/idle handle it thereafter (avoids a querySourceFeatures per
	// $places tick).
	if (isNewSelection) updatePulseVisibility();
};

// Reactive zoom level for the panel — drives the "zoom in" prompt and the
// nearby-vs-low-zoom branching in updateMerchantList. Kept in sync via the
// moveend handler. Until the map's first moveend fires it stays at the
// default; that's fine because the panel itself is closed by default.
let currentZoom = DEFAULT_MAP_ZOOM;
// Reactive map center for community-rail visibility. Updated in the
// same `moveend` handler that maintains `currentZoom`.
let currentLat: number | null = null;
let currentLon: number | null = null;

// Tile-loading indicator state. Same debounce pattern as /map: show
// the spinner only if loading takes > 150ms, hide on `idle`, and a 5s
// safety fallback in case `idle` never fires. Init `true` so the
// indicator shows during the very first style/tile load; cleared on
// the first `idle` once the map settles.
let tilesLoading = true;
let tilesLoadingTimer: ReturnType<typeof setTimeout> | null = null;
let tilesLoadingFallback: ReturnType<typeof setTimeout> | null = null;

// Centered initial-load modal (MapLoadingMain). Mirrors /map's priority
// chain: places-sync progress → markers committing to the source →
// first tile render. Each milestone advances/resets `mapLoading`; when
// all three complete it returns to 0 and the modal fades out.
let elementsLoaded = false;
let mapTilesLoaded = false;
let mapLoading = 1;
let mapLoadingStatus = "";

$: {
	if ($placesLoadingProgress > 0 && $placesLoadingProgress < 100) {
		mapLoading = $placesLoadingProgress;
		mapLoadingStatus = $placesLoadingStatus;
	} else if ($placesLoadingProgress === 100 && !elementsLoaded) {
		mapLoading = 100;
		mapLoadingStatus = $placesLoadingStatus;
	} else if (elementsLoaded && !mapTilesLoaded) {
		mapLoading = 100;
		mapLoadingStatus = $_("status.preparing");
	} else if (elementsLoaded && mapTilesLoaded) {
		mapLoading = 0;
		mapLoadingStatus = "";
	}
}

// Surface places-sync failures (network outage, parse error) so the user
// doesn't stare at an empty map wondering what happened.
$: if ($placesError) errToast($placesError);

// Expand a MapLibre LngLatBounds by `bufferPercent` on each edge, mirroring
// /map's `getBufferedBounds(0.25)` for the local-markers nearby filter.
const getBufferedBoundsLngLat = (
	bounds: LngLatBounds,
	bufferPercent: number,
): { south: number; west: number; north: number; east: number } => {
	const south = bounds.getSouth();
	const north = bounds.getNorth();
	const west = bounds.getWest();
	const east = bounds.getEast();
	const latBuffer = (north - south) * bufferPercent;
	const lngBuffer = (east - west) * bufferPercent;
	return {
		south: south - latBuffer,
		west: west - lngBuffer,
		north: north + latBuffer,
		east: east + lngBuffer,
	};
};

// One reactive source for the list fetch behavior. Boosted-only /
// issues-only: the bulk $places feed already holds the full filtered set
// at every zoom, and the radius API (api-with-limit) can filter by
// neither boost nor issue state, so force the local path — the list,
// count, and panel status stay in sync with the filtered map.
// MUST stay in source order above every reactive block that calls
// updateMerchantList() synchronously (the search-exit watcher and the
// initial-count block): Svelte 4 can't see this dependency through the
// function body, so ordering falls back to source position.
$: listBehavior =
	boostsOnly || issuesOnly ? "local-markers" : getZoomBehavior(currentZoom);

// Refresh the panel's nearby list based on the current viewport. Mirrors
// /map's `updateMerchantList` minus the panel-offset bookkeeping (out of
// scope for this commit per the parity plan).
const updateMerchantList = (opts?: { force?: boolean }) => {
	if (!map) return;

	// Search mode is independent of the map viewport; skip refresh.
	if (get(merchantList).mode === "search") return;

	const bounds = map.getBounds();
	const center = map.getCenter();
	const listOpen = get(merchantList).isOpen;
	const allowHeavyFetch = opts?.force || listOpen;

	switch (listBehavior) {
		case "local-markers": {
			// Zoom 15+: filter the already-loaded $places by an expanded
			// viewport, then enrich with names when the panel is open or we're
			// above the label threshold.
			const buffered = getBufferedBoundsLngLat(bounds, 0.25);
			const visible = get(places).filter(
				(p) =>
					!p.deleted_at &&
					p.lat >= buffered.south &&
					p.lat <= buffered.north &&
					p.lon >= buffered.west &&
					p.lon <= buffered.east,
			);
			let listed = boostsOnly ? visible.filter(isBoosted) : visible;
			// The store's pipeline narrows the list itself (setMerchants
			// consumes state.paymentMethods), but the ?issues chip tallies
			// below are computed from THIS page-side snapshot — narrow it
			// here too so the chips can never count places the embed filter
			// hides. Same readiness gate as the pipeline: inert until the
			// payment-tag enrichment lands.
			if (paymentMethods && get(paymentTagsLoaded)) {
				listed = listed.filter((p) =>
					placeMatchesPaymentMethods(p, paymentMethods),
				);
			}
			// Same readiness gate as the marker pipeline: before the
			// verified_at enrichment lands, the list stays unfiltered
			// rather than flagging every bulk row as not_verified.
			const issueCodes = selectedIssueCodes;
			if (issueCodes && get(verifiedDatesLoaded)) {
				// Chip counts come from the PRE-narrowing viewport set so a
				// deselected chip still shows what selecting it would add — but
				// AFTER the recency window, matching the pin pipeline
				// (selectVisiblePlaces applies recency before the issue filter),
				// so a chip can never promise pins the window excludes.
				issueCounts = countIssuesByCode(
					filterPlacesByRecency(listed, get(merchantList).verifiedWithinYears),
				);
				listed = listed.filter((p) => placeMatchesIssueCodes(p, issueCodes));
			}
			merchantList.setMerchants(listed, center.lat, center.lng);
			// E2E test hook, same idea as __mapPlacesCount: the payment-filter
			// spec needs a DOM-independent way to pin that the list surface
			// narrows with the pins (the wiring the #398 rewrite silently
			// lost). Only set on this local path, so the spec also fails if a
			// rewrite stops routing filtered sessions through it. No-op
			// outside tests.
			if (typeof window !== "undefined") {
				(
					window as unknown as { __nearbyListCount?: number }
				).__nearbyListCount = listed.length;
			}
			if (listOpen || currentZoom >= LABEL_VISIBLE_ZOOM) {
				if (allowHeavyFetch || currentZoom >= LABEL_VISIBLE_ZOOM) {
					const radiusKm =
						calculateRadiusKmFromLngLatBounds(bounds) *
						NEARBY_RADIUS_MULTIPLIER;
					merchantList.fetchEnrichedDetails(
						{ lat: center.lat, lon: center.lng },
						radiusKm,
					);
				}
			}
			break;
		}
		case "api-with-limit": {
			// Zoom 10-14: API search; count-only when panel is closed.
			const radiusKm =
				calculateRadiusKmFromLngLatBounds(bounds) * NEARBY_RADIUS_MULTIPLIER;
			if (!listOpen || !allowHeavyFetch) {
				merchantList.fetchCountOnly(
					{ lat: center.lat, lon: center.lng },
					radiusKm,
				);
			} else {
				merchantList.fetchAndReplaceList(
					{ lat: center.lat, lon: center.lng },
					radiusKm,
					{ hideIfExceeds: MERCHANT_LIST_FETCH_CEILING },
				);
			}
			break;
		}
		default:
			merchantList.setMerchants([], 0, 0);
	}
};

const debouncedUpdateMerchantList = debounce(
	updateMerchantList,
	MAP_DEBOUNCE_DELAY,
);

// Re-sync markers + refresh the nearby list when the verified-recency filter
// changes. The marker reactive block re-runs because it reads
// $merchantList.verifiedWithinYears; the forced update re-filters the list
// (mirrors the category filter's onRefresh path).
const applyVerifiedFilter = async (years: VerifiedFilterYears) => {
	// Set + persist the choice immediately (setVerifiedFilter owns persistence),
	// so it survives even if the user navigates away during the fetch. Markers
	// and the list gate on verifiedDatesLoaded, so they show everything until
	// the dates land. Then load the dates on demand (no-op once loaded; the
	// control awaits this to show its spinner only during the one-time fetch)
	// and refresh the list.
	merchantList.setVerifiedFilter(years);
	// Leaving outdated mode invalidates an ?outdated deep link — strip the
	// param (same silent-URL-update idiom as mapHash) so a reload doesn't
	// resurrect the filter the user just switched away from.
	if (years !== "outdated") {
		const url = new URL(window.location.href);
		if (url.searchParams.has("outdated")) {
			url.searchParams.delete("outdated");
			history.replaceState(history.state, "", url);
		}
	}
	if (years != null) await ensureVerifiedDates();
	updateMerchantList({ force: true });
};

// MerchantListPanel callbacks — see /map/+page.svelte for the prod
// equivalents. Camera moves do NOT account for the panel width yet; for
// the first cut the merchant gets centered in the full viewport and may
// sit under the panel. Hover highlight is also deferred — MapLibre paints
// from feature properties, so we'd need feature-state plumbing that
// isn't wired here yet.

const panToNearbyMerchant = (place: Place) => {
	if (!map) return;
	// Below the clustering threshold the picked merchant may be absorbed into a
	// cluster, leaving the selection pulse floating with no pin under it. Zoom
	// past the threshold to reveal its individual pin (same intent as
	// zoomToSearchResult); once we're already zoomed in, just pan.
	if (map.getZoom() < CLUSTERING_DISABLED_ZOOM) {
		map.easeTo({
			center: [place.lon, place.lat],
			zoom: REVEAL_ZOOM,
			duration: 400,
		});
	} else {
		map.easeTo({ center: [place.lon, place.lat], duration: 300 });
	}
};

const zoomToSearchResult = (place: Place) => {
	if (!map) return;
	// Zoom past CLUSTERING_DISABLED_ZOOM (17) so the selected place renders
	// as an unclustered pin rather than being absorbed into a cluster — the
	// user picked it from the search results, they expect to see it.
	map.easeTo({
		center: [place.lon, place.lat],
		zoom: 19,
		duration: 300,
	});
};

const zoomToNearbyLevel = () => {
	if (!map) return;
	map.zoomTo(MERCHANT_LIST_MIN_ZOOM, { duration: 300 });
};

const isValidCoord = (lat: number, lon: number): boolean =>
	Number.isFinite(lat) &&
	Number.isFinite(lon) &&
	lat >= -90 &&
	lat <= 90 &&
	lon >= -180 &&
	lon <= 180;

// Fits the list the panel passes in (its filteredSearchResults) — never the
// store's raw searchResults, which may include category/recency-hidden rows.
const fitSearchResultBounds = (places: Place[]) => {
	if (!map) return;
	const results = places.filter((p) => isValidCoord(p.lat, p.lon));
	if (results.length === 0) return;
	if (results.length === 1) {
		// Match legacy: zoom past CLUSTERING_DISABLED_ZOOM (17) so the
		// single hit renders as an unclustered pin instead of being
		// absorbed into whatever cluster sits at zoom 15.
		map.easeTo({
			center: [results[0].lon, results[0].lat],
			zoom: 17,
			duration: 300,
		});
		return;
	}
	let minLng = results[0].lon;
	let maxLng = results[0].lon;
	let minLat = results[0].lat;
	let maxLat = results[0].lat;
	for (const p of results) {
		if (p.lon < minLng) minLng = p.lon;
		if (p.lon > maxLng) maxLng = p.lon;
		if (p.lat < minLat) minLat = p.lat;
		if (p.lat > maxLat) maxLat = p.lat;
	}
	map.fitBounds(
		[
			[minLng, minLat],
			[maxLng, maxLat],
		],
		{ padding: 60, duration: 300 },
	);
};

// The search lifecycle (debounce, abort, staleness/open guards) lives in
// merchantListStore's searchSession (#1173); the page only supplies the
// dispatch-time map centre. wrap() normalises longitude into [-180, 180]:
// panning across the antimeridian leaves getCenter().lng unbounded (e.g.
// 190), and the API would take that verbatim as the distance origin.
// Undefined until the map initialises — the search box is reachable
// before that.
const readSearchCenter = () => {
	if (!map) return undefined;
	const center = map.getCenter().wrap();
	return { lat: center.lat, lon: center.lng };
};

// The map moves while search mode is active — clicking a result flies to it. But
// updateMerchantList deliberately skips refreshing in search mode (setMerchants
// also rewrites categoryCounts/selectedCategory, which the search panel owns), and
// close() keeps the old merchant data so the count stays on the collapsed facade.
// So on returning to nearby, the list and its "N nearby" count still describe
// wherever the user was *before* searching: search Hamburg from Helsinki, click a
// result, close the panel, and it still reports Helsinki's count over a Hamburg
// map until the next pan. Refresh once on that transition. Covers every exit —
// clearing the input, closing the panel, exitSearchMode.
let lastListMode = get(merchantList).mode;
$: {
	const listMode = $merchantList.mode;
	const leftSearch = lastListMode === "search" && listMode === "nearby";
	lastListMode = listMode;
	if (leftSearch) updateMerchantList({ force: true });
}

// Browser back/forward / external hash mutation → re-sync the drawer.
// Highlight-state on markers isn't a concept here (MapLibre paints from
// feature properties, not marker references), so this is the only
// behavior the legacy /map's handler does that we need.
const handleHashChange = () => {
	if (typeof window === "undefined") return;
	merchantDrawer.syncFromHash();
	// Back/forward can restore a history entry whose ?issues snapshot differs
	// from the current chip selection (chip toggles replaceState; drawer
	// opens pushState). Re-parse and re-render only on an actual change.
	if (issuesOnly) {
		const restored = parseIssuesParam(
			new URLSearchParams(window.location.search).get("issues"),
		);
		if (
			selectedIssueCodes &&
			serializeIssuesParam(restored) !==
				serializeIssuesParam(selectedIssueCodes)
		) {
			selectedIssueCodes = restored;
			updateMerchantList({ force: true });
		}
	}
};

// Renders exactly the list it is given — all visibility policy (search,
// category, recency, boosts) lives upstream in selectVisiblePlaces; the
// facade must never receive an unfiltered list.
const syncPlacesToSource = (list: Place[]) => {
	if (!map || !styleLoaded) return;
	pinSource.render(map, list);
};

// Debounced enrichment trigger — fires on moveend when zoomed in enough
// to show labels. The store handles aborting any in-flight stale request.
// 500ms (vs MAP_DEBOUNCE_DELAY=300) matches /map's dedicated debounce for
// the enriched-details API: API calls deserve a longer settle than
// in-memory operations like marker reloads or cache writes.
const ENRICHMENT_DEBOUNCE_DELAY = 500;

const triggerEnrichmentIfNeeded = debounce(() => {
	if (!map) return;
	if (map.getZoom() < LABEL_VISIBLE_ZOOM) return;
	const center = map.getCenter();
	const radiusKm = calculateRadiusKmFromLngLatBounds(map.getBounds());
	merchantList.fetchEnrichedDetails(
		{ lat: center.lat, lon: center.lng },
		radiusKm,
	);
}, ENRICHMENT_DEBOUNCE_DELAY);

// The visible set comes from the shared pipeline (selectVisiblePlaces) so the
// pins can never disagree with the list, counts, or camera again — the
// #1158-#1162 bug class. The render signature gates the expensive
// syncPlacesToSource: visibility inputs via computeVisibleSignature (with
// $placesRevision covering bulk turnover AND in-place mutations from the
// boost/comment flows — this replaces the old lastUpdatedPlaceId handshake
// and its source-order contract), plus render-only inputs: $savedPlaceIds
// size (saved badges), enriched-cache size (name labels), and locale. Size
// tracking misses the swap case (save A + unsave B, no net change) —
// accepted tradeoff carried over from the memo it replaces.
$: if (map && styleLoaded && $places) {
	const inSearch =
		$merchantList.mode === "search" && $merchantList.searchResults.length > 0;
	const inputs = {
		mode: (inSearch ? "search" : "nearby") as "search" | "nearby",
		category: $merchantList.selectedCategory,
		recency: $merchantList.verifiedWithinYears,
		// Search rows carry verified_at natively (LIST_ITEM); the bulk feed
		// only after enrichment — the pipeline keeps the filter inert until
		// the dates land rather than hiding every pin. Trivially ready when
		// no window is selected (matching setMerchants in the list store), so
		// the dates landing can't change the signature while the filter is off.
		recencyReady:
			$merchantList.verifiedWithinYears == null ||
			inSearch ||
			$verifiedDatesLoaded,
		// Markers exempt search mode from the boosted-only narrowing: an
		// explicit query should surface all matches on the map.
		boostsOnly: boostsOnly && !inSearch,
		// Same search exemption for the issues worklist: a searched-for
		// place must appear even when it has no issues.
		issueCodes: inSearch ? null : selectedIssueCodes,
		// Trivially ready when the mode is off or exempted, so the dates
		// landing can't change the signature outside issues mode.
		issuesReady: !issuesOnly || inSearch || $verifiedDatesLoaded,
		// Payment embed filter applies in search mode TOO (an embedded map
		// keeps its promise everywhere); only the bulk feed needs the
		// enrichment gate — search rows carry the tags natively.
		paymentMethods,
		paymentsReady: paymentMethods == null || inSearch || $paymentTagsLoaded,
	};
	const renderSig = [
		computeVisibleSignature(
			inputs,
			$placesRevision,
			inSearch ? $merchantList.searchResults.map((p) => p.id).join(",") : "",
		),
		$savedPlaceIds.size,
		$merchantList.placeDetailsCache.size,
		$locale,
	].join("~");
	if (renderSig !== lastRenderSig) {
		lastRenderSig = renderSig;
		// Same gate as the selection filter: no issue colors until the dates
		// are enriched, and none for search results (mode exemption).
		pinIssueCodes = inputs.issuesReady ? inputs.issueCodes : null;
		const { selection } = selectVisiblePlaces({
			...inputs,
			places: inSearch ? $merchantList.searchResults : $places,
		});
		syncPlacesToSource(selection);
	}
}

// Position the locator pulse. Depends on $places too so a deep-linked merchant
// gets its pulse once the place data syncs in, and on pinIssueCodes so chip
// toggles recolor an already-selected marker; syncSelectionPulse no-ops when
// the target is not yet loaded.
$: if (map && styleLoaded) {
	void $places;
	void pinIssueCodes;
	syncSelectionPulse($merchantDrawer.merchantId);
}

// Populate the nearby list/count once on first load. The initial camera is
// set programmatically (no moveend fires), so without this the peek pill and
// nearby list stay empty until the user pans or opens the panel.
let didInitialNearbyCount = false;
$: if (
	browser &&
	map &&
	styleLoaded &&
	$places.length > 0 &&
	!didInitialNearbyCount
) {
	didInitialNearbyCount = true;
	updateMerchantList();
}

// A returning user with a persisted window (or an ?outdated deep link — both
// land in the store's verifiedWithinYears — or an ?issues deep link): load
// the dates once the bulk places are in (not during map setup, which can win
// the race and enrich an empty store), so the map + list arrive filtered
// without a manual toggle.
let didInitialVerifiedLoad = false;
$: if (
	browser &&
	map &&
	styleLoaded &&
	$places.length > 0 &&
	!didInitialVerifiedLoad &&
	($merchantList.verifiedWithinYears != null || issuesOnly)
) {
	didInitialVerifiedLoad = true;
	void ensureVerifiedDates().then(() => updateMerchantList({ force: true }));
}

// Same lazy-enrichment handshake for the payment embed filter (#1269): the
// bulk feed has no osm:payment:* tags until this lands, then one forced
// refresh re-runs pins + list through the (now active) pipeline.
let didInitialPaymentLoad = false;
$: if (
	browser &&
	map &&
	styleLoaded &&
	$places.length > 0 &&
	!didInitialPaymentLoad &&
	paymentMethods
) {
	didInitialPaymentLoad = true;
	void ensurePaymentMethods().then(() => {
		// ensurePaymentMethods never rejects — failure means the gate is
		// still false. Un-latch so the next $places publication retries (at
		// sync cadence): unlike the verified filter there is no UI control
		// to re-trigger this, and a transient failure would otherwise leave
		// the embed silently unfiltered for the whole session.
		if (!get(paymentTagsLoaded)) didInitialPaymentLoad = false;
		updateMerchantList({ force: true });
	});
}

// Globe projection is page state: a basemap swap resets the projection to
// the incoming style's default, and registerOverlays (re-run on every
// style.load, queued swaps included) is the one reliable re-apply point.
let globeOn = false;
const toggleGlobe = () => {
	if (!map) return;
	globeOn = !globeOn;
	map.setProjection({ type: globeOn ? "globe" : "mercator" });
	trackEvent("worldview_toggle", { enabled: globeOn });
};

// Heatmap on/off state and layer-visibility juggling live in the facade;
// this wrapper is the shape <MapControls> expects.
const setHeatmapEnabled = (enabled: boolean) => {
	if (!map) return;
	pinSource.setHeatmapEnabled(map, enabled);
};

// Switch the basemap without tearing down our pin/cluster/label layers.
// Swap the basemap. The facade's swap machine re-runs registerOverlays on
// the incoming style's style.load — sprites, the fifteen layers, label
// palette, spiderfy re-hook, heatmap state — and the ready toggle clears
// the render signature so the fresh sources repopulate. A momentary pin
// blink replaces the old transformStyle carryover and its hand-maintained
// CUSTOM_*_IDS lists.
const applyBasemap = (id: BasemapId) => {
	// Collapse any open spider before the restyle. This also detaches the
	// spiderfy library's map handlers; registerOverlays re-applies them.
	spiderfier?.unspiderfyAll();
	mapHandle?.setStyle(styleForBasemap(id));
};

onMount(async () => {
	// Bridge the JS peek-height const into CSS so the bottom-chrome lift (scale
	// bar, attribution, tile indicator) stays in sync with the anchored search
	// sheet's peek without duplicating the literal value.
	document.documentElement.style.setProperty(
		"--search-sheet-peek-height",
		`${SEARCH_SHEET_PEEK_HEIGHT}px`,
	);

	// ?issues mode stacks the mode bar above the peek on mobile; lift the
	// bottom map chrome over it too. 96px = the bar's fixed height (~88px,
	// one header line + one chip row) plus the 8px gap. Set unconditionally:
	// the var lives on documentElement, which survives client-side
	// navigation, so a mount outside issues mode must reset it to zero.
	document.documentElement.style.setProperty(
		"--issues-bar-lift",
		issuesOnly && isMobileLayout ? "96px" : "0px",
	);

	// Five basemaps (legacy parity): four vector styles + the OSM raster
	// style. A stored picker choice wins; otherwise the first-visit default
	// is theme-aware (Liberty in light, Carto Dark Matter in dark). Each
	// basemap is a FIXED style — the choice is sticky and a theme toggle does
	// not swap it. Explicit-style mode: this page owns style selection, so
	// swaps go through applyBasemap → handle.setStyle.
	const initialBasemap: BasemapId =
		getStoredBasemap() ?? defaultBasemap(get(theme));
	const style = styleForBasemap(initialBasemap);

	// Viewport resolution order: hash → ?lat&long query → cached last
	// view → IP-geo → defaults. Hash is what /map writes back on every
	// move; the query form is for legacy embeds; the localforage cache
	// puts returning users back where they left off; IP-geo (Netlify
	// `x-nf-geo` header from +page.server.ts) lands first-time visitors
	// near their own country instead of the global default.
	const hashCoords = parseHashCoords();
	const searchParams = new URLSearchParams(window.location.search);
	placementActive = !issuesOnly && searchParams.has("add");
	if (placementActive) trackEvent("add_place_enter", { method: "url" });
	const queryView = hashCoords ? null : parseLatLongQuery(searchParams);
	// Distinguish "no ?lat/long" from "malformed ?lat/long" so an embed
	// linking with bad coords gets a visible hint instead of silently
	// falling through to defaults. Match legacy: errors.mapView toast.
	if (
		!hashCoords &&
		!queryView &&
		(searchParams.has("lat") || searchParams.has("long"))
	) {
		errToast(get(_)("errors.mapView"));
	}
	const cachedView = hashCoords || queryView ? null : await loadCachedView();
	// User may have navigated away during the localforage round-trip.
	if (destroyed) return;
	const ipGeo =
		!hashCoords &&
		!queryView &&
		!cachedView &&
		typeof data.geo?.lat === "number" &&
		typeof data.geo?.lng === "number"
			? { lat: data.geo.lat, lng: data.geo.lng }
			: null;

	let initialCenter: [number, number] = [DEFAULT_MAP_LNG, DEFAULT_MAP_LAT];
	let initialZoom: number = DEFAULT_MAP_ZOOM;
	if (hashCoords) {
		initialCenter = [hashCoords.lng, hashCoords.lat];
		initialZoom = hashCoords.zoom;
	} else if (queryView?.kind === "point") {
		initialCenter = [queryView.lng, queryView.lat];
	} else if (queryView?.kind === "bounds") {
		// Seed at midpoint; fitBounds below sets the final zoom once the
		// container is measured.
		initialCenter = [
			(queryView.sw[0] + queryView.ne[0]) / 2,
			(queryView.sw[1] + queryView.ne[1]) / 2,
		];
	} else if (cachedView) {
		initialCenter = [cachedView.lng, cachedView.lat];
		initialZoom = cachedView.zoom;
	} else if (ipGeo) {
		initialCenter = [ipGeo.lng, ipGeo.lat];
	}

	const outcome = await createBtcmapMap({
		container: mapContainer,
		theme: get(theme),
		style,
		mapOptions: {
			// Show the "Support BTC Map" supporter link on every basemap (legacy
			// /map guaranteed it regardless of basemap). Data-source credit
			// (OSM / OpenFreeMap / Carto) comes from each style's own sources.
			// Mobile: compact (i) button so it doesn't cover the bottom edge
			// under the floating search. Desktop has room — show the full credit.
			attributionControl: {
				customAttribution: SUPPORT_ATTR,
				compact: isMobileLayout,
			},
			center: initialCenter,
			zoom: initialZoom,
			bearing: hashCoords?.bearing ?? 0,
			pitch: hashCoords?.pitch ?? 0,
			// Match legacy Leaflet `noWrap: true` — stop the map from
			// repeating horizontally when zoomed out, so the user can't pan
			// past the antimeridian into a duplicate copy of the world.
			renderWorldCopies: false,
		},
		isCancelled: () => destroyed,
		// Mirror legacy /map: sync location into the userLocation store so
		// the merchant list panel can compute distances without prompting.
		onGeolocate: (coords) => {
			userLocation.setLocation(coords.latitude, coords.longitude);
		},
		onStyleReadyChange: (ready) => {
			styleLoaded = ready;
			// Every style becoming ready (first load AND basemap swaps, whose
			// fresh styles arrive without our sources) invalidates the render
			// signature: the marker block recomputes the filtered selection
			// and syncs it into the just-installed sources. Never sync raw
			// $places — all filtering lives upstream in the pipeline.
			if (ready) lastRenderSig = "";
		},
		// Runs on the initial load and again after every basemap swap's
		// style.load — a swap's incoming style has none of our sprites,
		// sources, or layers. The saved-badge fetch goes to a third-party CDN
		// and must NOT block init; the facade-side loaders catch and degrade.
		registerOverlays: async (m) => {
			await pinSource.loadSprites(m);
			// Component may have been destroyed while sprites were loading
			// (user navigated away within ~1s of mount).
			if (destroyed) return;
			// Sources + fifteen layers (pins, clusters, badges, labels, heatmap).
			pinSource.install(m);
			// Style-dependent state the incoming style resets: label palette,
			// composite pin sprites, spiderfy's layer hook (no-op before the
			// spiderfier exists on first load), heatmap visibility.
			applyLabelPalette(m, get(theme));
			lastAppliedLabelTheme = get(theme);
			ensureSpritesForPlaces(m, get(places));
			spiderfier?.applyTo("clusters-hit");
			pinSource.refreshHeatmapAfterStyle(m);
			// The incoming style resets the projection to its default.
			if (globeOn) m.setProjection({ type: "globe" });
		},
		onFirstLoad: (m) => {
			// Adopt the instance immediately: the post-outcome assignment below
			// also sets it, but nothing should depend on winning that race.
			map = m;
			if (destroyed) return;

			// Spiderfy hooks the clusters-hit symbol layer. The library's
			// internal decision is: if expansionZoom > forceSpiderifyMinZoom OR
			// expansionZoom > map.maxZoom → spiderfy; else easeTo to expansionZoom.
			// The default forceSpiderifyMinZoom is null, which coerces to 0 and
			// causes EVERY click to spiderfy. Set it to our clustering threshold
			// so only genuinely un-zoomable clusters (coincident points whose
			// expansionZoom exceeds the threshold) spider out.
			spiderfier = new Spiderfy(map, {
				forceSpiderifyMinZoom: CLUSTERING_DISABLED_ZOOM,
				onLeafClick: (feature) => {
					if (placementActive) return;
					const placeId = feature.properties?.id;
					if (typeof placeId === "number") {
						merchantDrawer.open(placeId, "details");
					}
				},
				closeOnLeafClick: true,
				spiderLeavesLayout: {
					// Same builder as the point layers, so spiderfied leaves keep
					// their issue-category colors in ?issues mode.
					"icon-image": pinIconImageExpression("r"),
					"icon-size": 1,
					"icon-anchor": "bottom",
					"icon-allow-overlap": true,
					"icon-ignore-placement": true,
					"icon-rotation-alignment": "viewport",
					"icon-pitch-alignment": "viewport",
				},
				spiderLegsColor: "rgba(100, 100, 100, 0.6)",
			});
			spiderfier.applyTo("clusters-hit");

			const setPointerCursor = () => {
				if (map) map.getCanvas().style.cursor = "pointer";
			};
			const resetCursor = () => {
				if (map) map.getCanvas().style.cursor = "";
			};
			map.on("mouseenter", "clusters-outer", setPointerCursor);
			map.on("mouseleave", "clusters-outer", resetCursor);
			map.on("mouseenter", "unclustered-point", setPointerCursor);
			map.on("mouseleave", "unclustered-point", resetCursor);
			map.on("mouseenter", "boosted-point", setPointerCursor);
			map.on("mouseleave", "boosted-point", resetCursor);

			// Unclustered marker click → open the global merchant drawer. The
			// drawer component lives in the layout, so we only need to push state
			// into the store. Both layers share the same handler since boosted
			// pins live in their own source above the clustered one.
			const onPinClick = (e: MapLayerMouseEvent) => {
				if (placementActive) return;
				const feature = e.features?.[0] as MapGeoJSONFeature | undefined;
				const placeId = feature?.properties?.id;
				if (typeof placeId !== "number") return;
				merchantDrawer.open(placeId, "details");
			};
			map.on("click", "unclustered-point", onPinClick);
			map.on("click", "boosted-point", onPinClick);

			// Click on empty map (no marker or cluster hit) closes any open
			// drawer — matches /map's behavior. Layer-scoped click handlers
			// fire alongside this generic one, so clicking a marker still
			// reopens the drawer for the new feature net-net.
			// The spiderfy lib adds its own symbol layers at applyTo() time
			// with ids prefixed `spiderfy-leaf-…`. Without including them
			// here, tapping a spidered leaf would open the drawer (via
			// onLeafClick) and then immediately close it again because the
			// generic handler sees no hit on the allowlisted layers.
			map.on("click", (e: MapLayerMouseEvent) => {
				if (!map) return;
				if (!get(merchantDrawer).isOpen) return;
				const spiderLeafLayerIds = map
					.getStyle()
					.layers.filter((l) => l.id.startsWith("spiderfy-leaf"))
					.map((l) => l.id);
				const hit = map.queryRenderedFeatures(e.point, {
					layers: [
						"unclustered-point",
						"boosted-point",
						"clusters-hit",
						...spiderLeafLayerIds,
					],
				});
				if (hit.length > 0) return;
				merchantDrawer.close();
			});

			// Refresh enriched details (and thus labels) on viewport changes
			// once we're above LABEL_VISIBLE_ZOOM. Debounced so quick pans don't
			// spam the API; the store internally aborts any stale request.
			map.on("moveend", triggerEnrichmentIfNeeded);

			// Track current zoom + center + refresh the merchant list panel's
			// nearby items based on the new viewport. Debounced to keep cost
			// off the move path. Center drives the CommunityRail.
			map.on("moveend", () => {
				if (!map) return;
				currentZoom = map.getZoom();
				const c = map.getCenter();
				currentLat = c.lat;
				currentLon = c.lng;
				// Re-route boosted places when zoom crosses BOOSTED_CLUSTERING_MAX_ZOOM
				// — the MapLibre analogue of the legacy boostedLayer swap. The facade
				// only re-renders on an actual flip, so steady-state pans stay cheap.
				if (styleLoaded) {
					pinSource.resyncForZoom(map);
				}
				// When the heatmap is active, zooming past CLUSTERING_DISABLED_ZOOM
				// naturally removes the heatmap layer (its maxzoom), so re-show
				// all the point/cluster/badge layers that were concealed.
				pinSource.applyHeatmapVisibility(map);
				debouncedUpdateMerchantList();
			});

			// Tile-loading indicator — debounced to avoid flicker on quick pans.
			map.on("movestart", () => {
				if (tilesLoadingTimer) clearTimeout(tilesLoadingTimer);
				if (tilesLoadingFallback) clearTimeout(tilesLoadingFallback);
				tilesLoadingTimer = setTimeout(() => {
					tilesLoading = true;
				}, 150);
				tilesLoadingFallback = setTimeout(() => {
					tilesLoading = false;
				}, 5000);
			});
			map.on("idle", () => {
				if (tilesLoadingTimer) {
					clearTimeout(tilesLoadingTimer);
					tilesLoadingTimer = null;
				}
				if (tilesLoadingFallback) {
					clearTimeout(tilesLoadingFallback);
					tilesLoadingFallback = null;
				}
				tilesLoading = false;
				mapTilesLoaded = true;
				// Clustering is settled on idle — reconcile the pulse with whether the
				// selected pin is currently rendered individually or inside a cluster.
				updatePulseVisibility();
			});

			// Persist viewport in the URL hash. Preserves any merchant=… params
			// added by the drawer so shareable URLs round-trip.
			const persistViewportToHash = () => {
				if (!map) return;
				const center = map.getCenter();
				writeHashCoords({
					zoom: map.getZoom(),
					lat: center.lat,
					lng: center.lng,
					bearing: map.getBearing(),
					pitch: map.getPitch(),
				});
			};
			map.on("moveend", persistViewportToHash);

			// Persist viewport to localforage too, debounced so continuous
			// pan/zoom doesn't hammer IndexedDB. Returning users land back
			// where they left off when they revisit /map with no hash/query.
			const persistViewportToCache = debounce(() => {
				if (!map) return;
				const center = map.getCenter();
				saveCachedView({
					lat: center.lat,
					lng: center.lng,
					zoom: map.getZoom(),
				});
			}, 1000);
			map.on("moveend", persistViewportToCache);

			// If the URL also encoded a merchant=… param, open the drawer to it.
			merchantDrawer.syncFromHash();

			// Keep the drawer in sync with every channel the merchant URL state
			// can mutate through:
			//   • hashchange — direct hash edits or `location.hash = ...`
			//   • MERCHANT_URL_CHANGE_EVENT — updateMerchantHash() fires this
			//     because the SvelteKit pushState/replaceState path doesn't
			//     trigger native popstate/hashchange events.
			//   • popstate — browser back/forward across history entries that
			//     differ only in the ?merchant= query param.
			window.addEventListener("hashchange", handleHashChange);
			window.addEventListener(MERCHANT_URL_CHANGE_EVENT, handleHashChange);
			window.addEventListener("popstate", handleHashChange);

			// Deep link: the URL selected a merchant. Reveal it as an individual
			// pin — pan/zoom to it once it's in the places store — when the URL
			// carried no viewport, OR carried one whose zoom is below the clustering
			// threshold (where the pin would be absorbed into a cluster, leaving the
			// selection pulse floating with nothing under it). A hash zoom at/above
			// the threshold is honoured as-is. If places are still loading,
			// subscribe and wait — 10s safety unsubscribe so we never leak.
			if (!hashCoords || hashCoords.zoom < CLUSTERING_DISABLED_ZOOM) {
				const { merchantId, isOpen } = parseMerchantHash();
				if (isOpen && merchantId) {
					const place = get(placesById).get(merchantId);
					if (place) {
						panToPlace(place.lat, place.lon);
					} else {
						deepLinkPanUnsub = placesById.subscribe(($byId) => {
							const p = $byId.get(merchantId);
							if (!p) return;
							panToPlace(p.lat, p.lon);
							if (deepLinkPanTimer) clearTimeout(deepLinkPanTimer);
							deepLinkPanUnsub?.();
							deepLinkPanUnsub = null;
						});
						deepLinkPanTimer = setTimeout(() => {
							deepLinkPanUnsub?.();
							deepLinkPanUnsub = null;
							deepLinkPanTimer = null;
						}, 10_000);
					}
				}
			}

			// Kick once on load — if the user lands above the threshold, labels
			// should appear without requiring a move.
			triggerEnrichmentIfNeeded();
		},
	});

	if (outcome.status === "unsupported") {
		webglUnsupported = true;
		return;
	}
	if (outcome.status === "cancelled") return;
	if (destroyed) {
		outcome.handle.destroy();
		return;
	}
	mapHandle = outcome.handle;
	map = outcome.handle.map;
	// Stash the namespace so the selection-pulse helpers can build a Marker;
	// the local alias below is the same binding, for the wiring code's use.
	const maplibre = outcome.handle.maplibre;
	maplibreNs = maplibre;

	if (queryView?.kind === "bounds") {
		map.fitBounds([queryView.sw, queryView.ne], { animate: false });
	}

	// Seed reactive viewport state from the resolved initial values so the
	// merchant list panel and community rail read the right values before
	// the first moveend fires.
	currentZoom = initialZoom;
	currentLat = initialCenter[1];
	currentLon = initialCenter[0];

	// Bottom-left scale bar — present in legacy /map (Leaflet's
	// L.control.scale). Metric units only.
	map.addControl(new maplibre.ScaleControl({ unit: "metric" }), "bottom-left");

	// Mobile only: the compact AttributionControl renders expanded on first
	// load (maplibregl-compact-show). Collapse it to the (i) button so it
	// doesn't cover the bottom edge; the user can still tap (i) to expand.
	if (isMobileLayout) {
		mapContainer
			.querySelector(".maplibregl-ctrl-attrib")
			?.classList.remove("maplibregl-compact-show");
	}

	// Built-in MapLibre controls (geolocate) expose their actions through
	// native button clicks, not through event APIs we can subscribe to
	// from JS. Wire the analytics events legacy /map had by attaching a
	// DOM listener now that the button exists in the container.
	mapContainer
		.querySelector(".maplibregl-ctrl-geolocate")
		?.addEventListener("click", () => trackEvent("locate_click"));
});

// Theme toggle → re-color the place-label layer in place. setPaintProperty
// is cheap and avoids rebuilding the source. Guarded by styleLoaded so we
// don't fire before the layer exists. The basemap itself is NOT swapped on a
// theme change — each basemap is a fixed style and the choice is sticky (the
// first-visit default is theme-aware, but after that the user's pick stands).
$: if (map && styleLoaded && $theme && $theme !== lastAppliedLabelTheme) {
	lastAppliedLabelTheme = $theme;
	applyLabelPalette(map, $theme);
}

onDestroy(() => {
	destroyed = true;
	triggerEnrichmentIfNeeded.cancel();
	debouncedUpdateMerchantList.cancel();
	if (typeof window !== "undefined") {
		window.removeEventListener("hashchange", handleHashChange);
		window.removeEventListener(MERCHANT_URL_CHANGE_EVENT, handleHashChange);
		window.removeEventListener("popstate", handleHashChange);
	}
	if (deepLinkPanTimer) clearTimeout(deepLinkPanTimer);
	deepLinkPanUnsub?.();
	deepLinkPanUnsub = null;
	pulseMarker?.remove();
	pulseMarker = null;
	if (tilesLoadingTimer) clearTimeout(tilesLoadingTimer);
	if (tilesLoadingFallback) clearTimeout(tilesLoadingFallback);
	spiderfier?.unspiderfyAll();
	spiderfier = undefined;
	mapHandle?.destroy();
	mapHandle = undefined;
	map = undefined;
	// merchantList is a module-level singleton. Without this reset the
	// next visit to /map flashes the previous session's category filter /
	// searchResults / isOpen before the first moveend rebuilds the panel.
	merchantList.reset();
	// Same singleton issue for the layout sync indicator: a stale
	// percentage from a previous sync can flash before the next sync
	// tick advances or clears it.
	placesLoadingProgress.set(0);
	placesLoadingStatus.set("");
});
</script>

<svelte:head>
	<title>BTC Map</title>
	<meta property="og:image" content={data.merchantOgImage ?? "https://btcmap.org/images/og/map.png"} />
	<meta name="twitter:title" content="BTC Map" />
	<meta name="twitter:image" content={data.merchantOgImage ?? "https://btcmap.org/images/og/map.png"} />
</svelte:head>

<h1 class="sr-only">{$_('map.bitcoinMerchantMapTitle')}</h1>

<div bind:this={mapContainer} class="map-container"></div>

{#if webglUnsupported}
	<MapUnsupportedFallback />
{/if}

<MapLoadingMain progress={mapLoading} status={mapLoadingStatus} />

<!--
	Floating search facade — desktop only, top-left. On mobile the merchant
	list panel renders as a bottom sheet whose peek state carries the
	single search facade instead. The facade hides when the list panel
	is open (the panel renders the real search input in the same slot).
-->
{#if styleLoaded && issuesOnly && selectedIssueCodes && !chipsHiddenForDrawer}
	<!--
		Mobile: bottom-anchored directly above the search sheet's peek — the
		mode bar and the search card form one column with a shared inset (the
		lifted scale bar/attribution move up with it, see the issues-bar-lift
		rule below). Desktop: one row across the map area at the panel's top
		edge, from the left column to just short of the top-right controls;
		hidden while the merchant drawer is open (see chipsHiddenForDrawer).
	-->
	<div
		transition:fade={{ duration: 150 }}
		class="pointer-events-none absolute right-3 bottom-(--chips-bottom) left-3 z-[1000] flex md:top-3 md:right-[3.75rem] md:bottom-auto md:left-(--chips-left)"
		style="--chips-bottom: calc(env(safe-area-inset-bottom) + var(--search-sheet-peek-height, 88px) + 8px); --chips-left: {CHIPS_DESKTOP_LEFT}px"
	>
		<IssueFilterChips
			selected={selectedIssueCodes}
			counts={issueCounts}
			totalInView={issueCounts ? $merchantList.totalCount : null}
			onToggle={toggleIssueCode}
			onExit={exitIssuesMode}
		/>
	</div>
{/if}

{#if styleLoaded && !isMobileLayout && !placementActive}
	<div class="pointer-events-none absolute top-3 left-3 z-[1000]">
		<MapSearchBar
			onActivate={async () => {
				merchantList.open();
				updateMerchantList({ force: true });
				// Opening the panel unmounts the facade, so focus would fall to <body>
				// and the click would look like it did nothing. Wait for the panel's
				// input to mount, then hand focus over. Desktop only by construction:
				// MapSearchBar doesn't render on mobile, where activating the sheet's
				// facade must leave the on-screen keyboard down.
				await tick();
				merchantListPanel?.focusSearchInput();
			}}
			nearbyCount={$merchantList.totalCount}
		/>
	</div>
{/if}

{#if !placementActive}
	<MerchantListPanel
		bind:this={merchantListPanel}
		onPanToNearbyMerchant={panToNearbyMerchant}
		onZoomToSearchResult={zoomToSearchResult}
		onZoomToNearbyLevel={zoomToNearbyLevel}
		onFitSearchResultBounds={fitSearchResultBounds}
		onHoverStart={() => {
			// Hover highlight requires feature-state plumbing that isn't
			// wired here yet — deferred to a follow-up polish.
		}}
		onHoverEnd={() => {
			// See onHoverStart above.
		}}
		onSearch={(query) => merchantList.search(query, { getCenter: readSearchCenter })}
		onRefresh={() => updateMerchantList({ force: true })}
		behavior={listBehavior}
		mapReady={styleLoaded}
		isMobile={isMobileLayout}
		issuesMode={issuesOnly}
	/>
{/if}

{#if styleLoaded && !placementActive}
	<CommunityRail
		lat={currentLat}
		lon={currentLon}
		zoom={currentZoom}
		{map}
	/>
{/if}

<TileLoadingIndicator visible={tilesLoading && !webglUnsupported} />

<MerchantDrawerHash showIssues={issuesOnly} />

<MapControls
	{map}
	variant="main"
	basemaps={BASEMAPS}
	{applyBasemap}
	{applyVerifiedFilter}
	currentVerified={$merchantList.verifiedWithinYears}
	{setHeatmapEnabled}
	enableBoost
	enableGlobe
	{globeOn}
	onToggleGlobe={toggleGlobe}
/>

{#if styleLoaded && !issuesOnly}
	<AddPlaceMode {map} bind:active={placementActive} isMobile={isMobileLayout} />
{/if}

<style>
	.map-container {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	/* IControl-related rules moved to ./controls/controls.css so any page
	   that mounts these controls (currently /map and /communities/map)
	   gets the popup positioning + anchor button styles. */

	/* Mobile: the search sheet is anchored to the bottom edge, so lift the
	   bottom map chrome (scale bar + attribution) above its peek so the credit
	   stays visible above the sheet. --search-sheet-peek-height is set from the
	   SEARCH_SHEET_PEEK_HEIGHT const in onMount; the fallback matches it. */
	@media (max-width: 767px) {
		.map-container :global(.maplibregl-ctrl-bottom-left),
		.map-container :global(.maplibregl-ctrl-bottom-right) {
			/* --issues-bar-lift is non-zero only in ?issues mode, where the
			   bottom-anchored mode bar stacks above the peek and the chrome
			   must clear both. */
			bottom: calc(
				env(safe-area-inset-bottom) + var(--search-sheet-peek-height, 88px) +
					var(--issues-bar-lift, 0px)
			);
		}
	}
</style>

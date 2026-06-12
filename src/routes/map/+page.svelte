<script lang="ts">
import "maplibre-gl/dist/maplibre-gl.css";

import Spiderfy from "@nazka/map-gl-js-spiderfy";
import convex from "@turf/convex";
import { featureCollection, point } from "@turf/helpers";
import type { Feature, FeatureCollection, Point, Polygon } from "geojson";
import type {
	FilterSpecification,
	GeoJSONSource,
	LngLatBounds,
	MapGeoJSONFeature,
	MapLayerMouseEvent,
	Map as MapLibreMap,
	Marker,
} from "maplibre-gl";
import { onDestroy, onMount } from "svelte";
import { get } from "svelte/store";

import CommunityRail from "$components/CommunityRail.svelte";
import MapLoadingMain from "$components/MapLoadingMain.svelte";
import MapUnsupportedFallback from "$components/MapUnsupportedFallback.svelte";
import { trackEvent } from "$lib/analytics";
import { filterMerchantsByCategory } from "$lib/categoryMapping";
import {
	BREAKPOINTS,
	CLUSTERING_DISABLED_ZOOM,
	DEFAULT_MAP_LAT,
	DEFAULT_MAP_LNG,
	DEFAULT_MAP_ZOOM,
	LABEL_VISIBLE_ZOOM,
	MAP_DEBOUNCE_DELAY,
	MERCHANT_LIST_FETCH_CEILING,
	MERCHANT_LIST_MIN_ZOOM,
	NEARBY_RADIUS_MULTIPLIER,
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
import {
	routePlacesByBoostAndZoom,
	shouldClusterBoostedAtZoom,
} from "$lib/map/boostedClustering";
import {
	type HashCoords,
	parseHashCoords,
	writeHashCoords,
} from "$lib/map/mapHash";
import {
	ensureSpritesForPlaces,
	installPlaceholderHandler,
	loadSvgImage,
	PIN_FILL_BOOSTED,
	PIN_FILL_REGULAR,
} from "$lib/map/maplibreSprites";
import { parseLatLongQuery } from "$lib/map/queryViewport";
import {
	calculateRadiusKmFromLngLatBounds,
	getZoomBehavior,
} from "$lib/map/viewport";
import { loadCachedView, saveCachedView } from "$lib/map/viewportCache";
import { hasWebGL } from "$lib/map/webgl";
import {
	MERCHANT_URL_CHANGE_EVENT,
	parseMerchantHash,
} from "$lib/merchantDrawerHash";
import { merchantDrawer } from "$lib/merchantDrawerStore";
import type { MerchantListMode } from "$lib/merchantListStore";
import { merchantList } from "$lib/merchantListStore";
import { savedPlaceIds } from "$lib/session";
import {
	lastUpdatedPlaceId,
	places,
	placesById,
	placesError,
	placesLoadingProgress,
	placesLoadingStatus,
} from "$lib/store";
import { theme } from "$lib/theme";
import type { Place } from "$lib/types";
import { userLocation } from "$lib/userLocationStore";
import { debounce, errToast, isBoosted } from "$lib/utils";

import type { PageData } from "./$types";
import MapSearchBar from "./components/MapSearchBar.svelte";
import MerchantDrawerHash from "./components/MerchantDrawerHash.svelte";
import MerchantListPanel from "./components/MerchantListPanel.svelte";
import TileLoadingIndicator from "./components/TileLoadingIndicator.svelte";
import { BasemapsControl } from "./controls/BasemapsControl";
import { BoostToggleControl } from "./controls/BoostToggleControl";
import { DataRefreshControl } from "./controls/DataRefreshControl";
import { NavButtonsControl } from "./controls/NavButtonsControl";
import { browser } from "$app/environment";

export let data: PageData;

// Layout decision locked at init (same pattern as MerchantDrawerHash): the
// mobile search sheet and the desktop floating bar derive from one value so
// a viewport resize can never leave zero or two search surfaces
const isMobileLayout = browser && window.innerWidth < BREAKPOINTS.md;

type PlaceFeature = {
	type: "Feature";
	geometry: { type: "Point"; coordinates: [number, number] };
	properties: {
		id: number;
		boosted: boolean;
		icon: string;
		comments: number;
		saved: boolean;
		name: string;
	};
};

type PlaceFeatureCollection = {
	type: "FeatureCollection";
	features: PlaceFeature[];
};

let mapContainer: HTMLDivElement;
let map: MapLibreMap | undefined;
let destroyed = false;
let spiderfier: Spiderfy | undefined;
let styleLoaded = false;
let webglUnsupported = false;
let lastPlacesLength = -1;
let lastSavedIdsSize = -1;
let lastEnrichedCacheSize = -1;
let lastLocale: string | null | undefined;
let lastAppliedLabelTheme: "light" | "dark" | undefined;
// Signature of the search-mode visible set. Empty string forces an
// initial sync; "n" = nearby (all places); "s:<id>,<id>,…" = a specific
// search-result list. Distinct from lastPlacesLength because a fresh
// search may have the same result count as the previous one.
let lastSearchModeSig = "";

// Last place list fed to the sources, kept so the boosted-clustering boundary
// re-sync (on zoom crossing BOOSTED_CLUSTERING_MAX_ZOOM) can rebuild without a
// $places change. `boostedAreClustered` mirrors the routing decision of the
// most recent sync so the moveend handler only re-syncs when it actually flips.
let lastSyncedList: Place[] = [];
let boostedAreClustered = false;

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
// Latest-wins guard for the async getClusterLeaves callback. Mouseenter
// fires per-feature, so a quick sweep across multiple clusters can stack
// pending leaf fetches; we only commit the hull whose cluster id is still
// the one currently being hovered.
let latestHullClusterId: number | null = null;
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
	// stays cheap on every $places tick. Colours come from the same source of
	// truth as the GL pin sprite so the two can't desync.
	const color = isBoosted(place) ? PIN_FILL_BOOSTED : PIN_FILL_REGULAR;
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

// Latest in-flight search request; aborted when a new query supersedes
// it or the component unmounts.
let searchAbortController: AbortController | null = null;

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

// Refresh the panel's nearby list based on the current viewport. Mirrors
// /map's `updateMerchantList` minus the panel-offset bookkeeping (out of
// scope for this commit per the parity plan).
const updateMerchantList = (opts?: { force?: boolean }) => {
	if (!map) return;

	// Search mode is independent of the map viewport; skip refresh.
	if (get(merchantList).mode === "search") return;

	const bounds = map.getBounds();
	const center = map.getCenter();
	const behavior = getZoomBehavior(currentZoom);
	const listOpen = get(merchantList).isOpen;
	const allowHeavyFetch = opts?.force || listOpen;

	switch (behavior) {
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
			merchantList.setMerchants(visible, center.lat, center.lng);
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

const fitSearchResultBounds = () => {
	if (!map) return;
	const results = get(merchantList).searchResults.filter((p) =>
		isValidCoord(p.lat, p.lon),
	);
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

// Mirrors /map's `executeSearch` — abort any prior request, fetch via the
// SvelteKit endpoint, hand results to the store. Errors surface as toasts.
const executeSearch = async (query: string) => {
	searchAbortController?.abort();
	if (query.length < 3) return;

	trackEvent("search_query");
	searchAbortController = new AbortController();

	// Close any drawer so it doesn't sit on top of the result list.
	merchantDrawer.close();
	merchantList.openSearchMode(true);

	try {
		const response = await fetch(
			`/api/search/places?name=${encodeURIComponent(query)}`,
			{ signal: searchAbortController.signal },
		);
		if (!response.ok) throw new Error("Search API error");
		const results: Place[] = await response.json();
		merchantList.openWithSearchResults(query, results);
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") return;
		console.error("Search error:", error);
		errToast(get(_)("errors.searchUnavailable"));
		merchantList.exitSearchMode();
	}
};

const debouncedPanelSearch = debounce(
	(query: string) => executeSearch(query),
	300,
);

const handlePanelSearch = (query: string) => {
	debouncedPanelSearch(query);
};

const handleModeChange = (mode: MerchantListMode) => {
	if (mode === "nearby") {
		searchAbortController?.abort();
		updateMerchantList();
	}
};

// Browser back/forward / external hash mutation → re-sync the drawer.
// Highlight-state on markers isn't a concept here (MapLibre paints from
// feature properties, not marker references), so this is the only
// behavior the legacy /map's handler does that we need.
const handleHashChange = () => {
	if (typeof window === "undefined") return;
	merchantDrawer.syncFromHash();
};

const EMPTY_HULL_COLLECTION: FeatureCollection<Polygon> = {
	type: "FeatureCollection",
	features: [],
};

const EMPTY_COLLECTION: PlaceFeatureCollection = {
	type: "FeatureCollection",
	features: [],
};

// Boosted places ride a separate non-clustered source so they stay
// individually visible above cluster discs — but only above
// BOOSTED_CLUSTERING_MAX_ZOOM. At/below it they fold into the clustered
// `places` source (matching the legacy /map's dedicated boostedLayer +
// BOOSTED_CLUSTERING_MAX_ZOOM behavior) so the zoomed-out world view isn't
// littered with overlapping orange pins. Routing lives in
// $lib/map/boostedClustering; see syncPlacesToSource for the wiring.

const buildFeatureCollectionFor = (list: Place[]): PlaceFeatureCollection => {
	const saved = get(savedPlaceIds);
	// Snapshot the enriched cache once per build — names arrive lazily as
	// the viewport-bound /v4/places/search fetch resolves.
	const enrichedCache = get(merchantList).placeDetailsCache;
	const displayLang = getDisplayLang(get(locale));
	const resolveName = (p: Place): string => {
		const enriched = enrichedCache.get(p.id);
		// Priority: enriched localized name → enriched plain name →
		// $places localized name → $places plain name → OSM amenity fallback.
		return (
			enriched?.localized_name?.[displayLang] ??
			enriched?.name ??
			p.localized_name?.[displayLang] ??
			p.name ??
			p["osm:amenity"] ??
			""
		);
	};
	return {
		type: "FeatureCollection",
		features: list.map((p) => ({
			type: "Feature",
			geometry: { type: "Point", coordinates: [p.lon, p.lat] },
			properties: {
				id: p.id,
				// Per-place so a boosted marker folded into the clustered source at
				// low zoom still renders its orange pin when it sits unclustered.
				boosted: !!isBoosted(p),
				icon: p.icon ?? "question_mark",
				comments: p.comments ?? 0,
				saved: saved.has(p.id),
				name: resolveName(p),
			},
		})),
	};
};

// Tailwind `text-link` color (tailwind.config.js → colors.link).
const LINK_COLOR = "#0099AF";

// Composite saved-badge SVG. Outer SVG is rasterized at 2× its declared
// dimensions (viewBox stays the same) and registered with pixelRatio: 2
// so it draws crisp at the same logical 16×16 — same trick as
// PIN_RENDER_SCALE for the main pin sprite.
const SAVED_BADGE_SCALE = 2;
const buildSavedBadgeSvg = (bookmarkSvg: string): string => {
	const w = 16 * SAVED_BADGE_SCALE;
	const h = 16 * SAVED_BADGE_SCALE;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#fff" stroke="${LINK_COLOR}" stroke-width="1"/><g transform="translate(3, 3)">${bookmarkSvg}</g></svg>`;
};

// Near-invisible circular hit-target sprite used as the icon for the
// symbol cluster layer that spiderfy hooks into. We render the visible
// cluster discs as circle layers (not symbols), so this symbol layer
// exists purely so the spiderfy library can register click handlers
// targeting it. 1/255 alpha keeps pixels effectively invisible while
// ensuring queryRenderedFeatures registers hits on the icon footprint.
const loadClusterHitSprite = async (m: MapLibreMap): Promise<void> => {
	if (m.hasImage("cluster-hit")) return;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="rgba(0,0,0,0.004)"/></svg>`;
	const img = await loadSvgImage(svg);
	if (!m.hasImage("cluster-hit"))
		m.addImage("cluster-hit", img, { pixelRatio: 1 });
};

// 16×16 green disc to back the comment count text. Matches /map's
// Tailwind `bg-green-600 w-4 h-4 rounded-full` exactly. Drawn directly
// on a canvas — simpler than the SVG → data-URL → <img> roundtrip for
// a flat shape.
const loadCommentBadgeSprite = (m: MapLibreMap): void => {
	if (m.hasImage("comment-badge-bg")) return;
	// Draw at 2× the logical 16×16 (= 32×32 backing canvas) and register
	// with pixelRatio: 2 so MapLibre displays at the same logical size
	// but reads from a higher-density bitmap — keeps the green disc
	// crisp on retina/phone DPRs instead of upscaling 16×16 bitmap pixels.
	const SIZE = 16;
	const SCALE = 2;
	const canvas = document.createElement("canvas");
	canvas.width = SIZE * SCALE;
	canvas.height = SIZE * SCALE;
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	ctx.fillStyle = "#16A34A";
	ctx.beginPath();
	ctx.arc(
		(SIZE * SCALE) / 2,
		(SIZE * SCALE) / 2,
		(SIZE * SCALE) / 2,
		0,
		Math.PI * 2,
	);
	ctx.fill();
	m.addImage(
		"comment-badge-bg",
		ctx.getImageData(0, 0, SIZE * SCALE, SIZE * SCALE),
		{ pixelRatio: SCALE },
	);
};

const loadSavedBadgeSprite = async (m: MapLibreMap): Promise<void> => {
	if (m.hasImage("saved-badge")) return;
	const encodedColor = encodeURIComponent(LINK_COLOR);
	const url = `https://api.iconify.design/ic/baseline-bookmark-added.svg?color=${encodedColor}&width=10&height=10`;
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`saved-badge bookmark fetch failed: ${res.status} ${url}`);
	}
	const bookmarkSvg = await res.text();
	const composite = buildSavedBadgeSvg(bookmarkSvg);
	const img = await loadSvgImage(composite);
	if (!m.hasImage("saved-badge"))
		m.addImage("saved-badge", img, { pixelRatio: SAVED_BADGE_SCALE });
	m.triggerRepaint();
};

const syncPlacesToSource = (list: Place[]) => {
	if (!map || !styleLoaded) return;
	const source = map.getSource("places") as GeoJSONSource | undefined;
	const boostedSource = map.getSource("places-boosted") as
		| GeoJSONSource
		| undefined;
	if (!source || !boostedSource) return;
	lastSyncedList = list;
	boostedAreClustered = shouldClusterBoostedAtZoom(map.getZoom());
	const { clustered, standalone } = routePlacesByBoostAndZoom(
		list,
		map.getZoom(),
	);
	source.setData(buildFeatureCollectionFor(clustered));
	boostedSource.setData(buildFeatureCollectionFor(standalone));
	ensureSpritesForPlaces(map, list);
	if (list.length > 0) elementsLoaded = true;
	// E2E test hook: Playwright can't probe WebGL canvas pins like it
	// could probe Leaflet's DOM markers, so we expose the count for
	// `waitForMarkersToLoad` to gate on. No-op outside tests.
	if (typeof window !== "undefined") {
		(window as unknown as { __mapPlacesCount?: number }).__mapPlacesCount =
			list.length;
	}
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

// Rebuild only when the count changes meaningfully (and always on first load),
// to avoid jank on incremental store updates with ~50k places worldwide.
// Also rebuild when $savedPlaceIds size changes so the saved badge appears/
// disappears as the user toggles saves, and when the enriched details cache
// grows so place-name labels appear as their data arrives. Tracking size
// catches add/remove but misses the swap case (e.g. save A + unsave B with
// no net size change) — accepted tradeoff for now.
$: if (map && styleLoaded && $places) {
	const inSearch =
		$merchantList.mode === "search" && $merchantList.searchResults.length > 0;
	const category = $merchantList.selectedCategory;
	let effective: Place[];
	if (inSearch) {
		effective = $merchantList.searchResults;
	} else if (category !== "all") {
		effective = filterMerchantsByCategory($places, category);
	} else {
		effective = $places;
	}
	const placesLen = effective.length;
	const savedSize = $savedPlaceIds.size;
	const cacheSize = $merchantList.placeDetailsCache.size;
	const currentLocale = $locale;
	const searchSig = inSearch
		? `s:${$merchantList.searchResults.map((p) => p.id).join(",")}`
		: category !== "all"
			? `c:${category}`
			: "n";
	if (
		placesLen !== lastPlacesLength ||
		savedSize !== lastSavedIdsSize ||
		cacheSize !== lastEnrichedCacheSize ||
		currentLocale !== lastLocale ||
		searchSig !== lastSearchModeSig
	) {
		lastPlacesLength = placesLen;
		lastSavedIdsSize = savedSize;
		lastEnrichedCacheSize = cacheSize;
		lastLocale = currentLocale;
		lastSearchModeSig = searchSig;
		syncPlacesToSource(effective);
	}
}

// In-place mutations to a place (boost confirmation, new comment count)
// don't change array length or any of the size counters above, so the
// guard wouldn't repaint the pin. lastUpdatedPlaceId is set by
// updateSinglePlace() in $lib/sync/places.ts — re-sync the source when
// it fires, then clear so we don't re-sync next time anything else
// triggers this reactive block.
$: if (map && styleLoaded && $lastUpdatedPlaceId) {
	syncPlacesToSource($places);
	lastUpdatedPlaceId.set(undefined);
}

// Position the locator pulse. Depends on $places too so a deep-linked merchant
// gets its pulse once the place data syncs in; syncSelectionPulse no-ops when
// the target is unchanged or not yet loaded.
$: if (map && styleLoaded) {
	void $places;
	syncSelectionPulse($merchantDrawer.merchantId);
}

// The custom sources + layers we add on top of whatever basemap is
// active. applyBasemap() carries these across a setStyle() so the pins,
// clusters, and labels survive a basemap/theme swap untouched (MapLibre's
// style differ leaves byte-identical layers in place — only the basemap
// layers below them get swapped).
const CUSTOM_SOURCE_IDS = ["places", "places-boosted", "cluster-hull"];
const CUSTOM_LAYER_IDS = [
	"cluster-hull-fill",
	"cluster-hull-outline",
	"clusters-outer",
	"clusters-inner",
	"cluster-count",
	"unclustered-point",
	"boosted-point",
	"comment-badge",
	"comment-badge-count",
	"saved-badge",
	"place-label",
	"boosted-comment-badge",
	"boosted-comment-badge-count",
	"boosted-saved-badge",
	"boosted-place-label",
	"clusters-hit",
];

// Switch the basemap without tearing down our pin/cluster/label layers.
// setStyle's transformStyle hook re-attaches the custom sources + layers
// onto the incoming base style; because they're identical to what's already
// mounted, the differ keeps the layers (and the carried GeoJSON data) live —
// only the basemap layers below them swap.
//
// Two things do NOT survive setStyle on their own and are re-established in
// the style.load handler below:
//   • the spiderfier's click/zoom handlers — unspiderfyAll() detaches them
//     (map.off) and only applyTo() re-binds them, so we must applyTo again;
//   • the addImage sprites (cluster-hit, badges) IF MapLibre ever falls back
//     from the diff to a full rebuild (fresh imageManager). The loaders are
//     hasImage-guarded, so re-running them is a cheap no-op on the normal path.
// The handler is registered BEFORE setStyle on purpose: for the inline raster
// (object) style, setStyle fires style.load SYNCHRONOUSLY during the call, so
// a handler added afterwards would miss it.
const applyBasemap = (id: BasemapId) => {
	if (!map) return;
	// Collapse any open spider before the restyle. This also detaches the
	// spiderfy library's map handlers (which is why we re-applyTo below).
	spiderfier?.unspiderfyAll();
	map.once("style.load", () => {
		if (!map) return;
		applyLabelPalette(map, get(theme));
		loadClusterHitSprite(map).catch(() => {});
		loadCommentBadgeSprite(map);
		loadSavedBadgeSprite(map).catch(() => {});
		ensureSpritesForPlaces(map, get(places));
		spiderfier?.applyTo("clusters-hit");
	});
	map.setStyle(styleForBasemap(id), {
		transformStyle: (previous, next) => {
			if (!previous) return next;
			const sources = { ...next.sources };
			for (const sid of CUSTOM_SOURCE_IDS) {
				if (previous.sources[sid]) sources[sid] = previous.sources[sid];
			}
			const carried = previous.layers.filter((l) =>
				CUSTOM_LAYER_IDS.includes(l.id),
			);
			return { ...next, sources, layers: [...next.layers, ...carried] };
		},
	});
};

onMount(async () => {
	// WebGL absence (older Android WebViews, hardened browsers, disabled
	// GPU) would leave the map blank if we tried to instantiate MapLibre.
	// Surface a static fallback instead.
	if (!hasWebGL()) {
		webglUnsupported = true;
		return;
	}
	const maplibre = await import("maplibre-gl");
	// User may have navigated away while the dynamic import was in
	// flight; bail before instantiating against an unmounted container.
	if (destroyed) return;
	// Stash the namespace so the selection-pulse helpers can build a Marker.
	maplibreNs = maplibre;

	// Five basemaps (legacy parity): four vector styles + the OSM raster
	// style. A stored picker choice wins; otherwise the first-visit default
	// is theme-aware (Liberty in light, Carto Dark Matter in dark). Each
	// basemap is a FIXED style — the choice is sticky and a theme toggle does
	// not swap it. Switching goes through applyBasemap() → setStyle({
	// transformStyle }) so the custom pin/cluster/label layers ride along.
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

	map = new maplibre.Map({
		container: mapContainer,
		// Resolved basemap style — a vector style URL, or the inline OSM raster
		// style. Defaults to the theme-aware basemap unless the user picked one.
		style,
		// Show the "Support BTC Map" supporter link on every basemap (legacy
		// /map guaranteed it regardless of basemap). Data-source credit
		// (OSM / OpenFreeMap / Carto) comes from each style's own sources.
		attributionControl: { customAttribution: SUPPORT_ATTR },
		center: initialCenter,
		zoom: initialZoom,
		bearing: hashCoords?.bearing ?? 0,
		pitch: hashCoords?.pitch ?? 0,
		maxZoom: 21,
		// Match legacy Leaflet `noWrap: true` — stop the map from
		// repeating horizontally when zoomed out, so the user can't pan
		// past the antimeridian into a duplicate copy of the world.
		renderWorldCopies: false,
		// Rotation + pitch enabled — the whole point of the migration
		dragRotate: true,
		touchZoomRotate: true,
		pitchWithRotate: false,
	});

	if (queryView?.kind === "bounds") {
		map.fitBounds([queryView.sw, queryView.ne], { animate: false });
	}

	// Seed reactive viewport state from the resolved initial values so the
	// merchant list panel and community rail read the right values before
	// the first moveend fires.
	currentZoom = initialZoom;
	currentLat = initialCenter[1];
	currentLon = initialCenter[0];

	map.addControl(
		new maplibre.NavigationControl({
			showCompass: true,
			showZoom: true,
			visualizePitch: false,
		}),
		"top-right",
	);
	map.addControl(new maplibre.GlobeControl(), "top-right");

	// Bottom-left scale bar — present in legacy /map (Leaflet's
	// L.control.scale). Metric units only; imperial is added by the
	// browser locale via MapLibre's bilingual variant if needed later.
	map.addControl(new maplibre.ScaleControl({ unit: "metric" }), "bottom-left");

	// Geolocate control: pulse dot, accuracy circle, and heading arrow are
	// built in. Heading uses the device's compass when available, falling
	// back to GPS movement. fitBoundsOptions.linear routes the camera move
	// through easeTo instead of flyTo — skips the parabolic zoom-out/zoom-in
	// arc that read as a long detour for short hops.
	const geolocate = new maplibre.GeolocateControl({
		positionOptions: { enableHighAccuracy: true },
		trackUserLocation: true,
		showUserLocation: true,
		showAccuracyCircle: true,
		fitBoundsOptions: { maxZoom: 15, linear: true },
	});
	map.addControl(geolocate, "top-right");

	// Built-in MapLibre controls (geolocate) expose their actions through
	// native button clicks, not through event APIs we can subscribe to
	// from JS. Wire the analytics events legacy /map had by attaching a
	// DOM listener now that the button exists in the container.
	mapContainer
		.querySelector(".maplibregl-ctrl-geolocate")
		?.addEventListener("click", () => trackEvent("locate_click"));

	// Right-side action buttons — mirror /map's stack order:
	// nav links (home / add / community / account) → boost toggle →
	// data-refresh (hidden until fresh sync arrives).
	map.addControl(new NavButtonsControl(), "top-right");
	map.addControl(new BoostToggleControl(), "top-right");
	map.addControl(new DataRefreshControl(), "top-right");

	// Basemap picker — layers-icon button that expands on hover/click,
	// matching the L.control.layers shape prod uses. Owns its own
	// localStorage persistence; the actual swap is delegated to
	// applyBasemap so the custom pin/cluster/label layers survive it.
	map.addControl(
		new BasemapsControl({
			basemaps: BASEMAPS,
			initial: initialBasemap,
			onSelect: applyBasemap,
		}),
		"top-right",
	);

	// Mirror /map's behavior: sync location into the userLocation store so
	// the merchant list panel can compute distances without prompting again.
	geolocate.on("geolocate", (e: GeolocationPosition) => {
		userLocation.setLocation(e.coords.latitude, e.coords.longitude);
	});

	// Composite pin sprites resolve async. Until each `pin-r-{icon}` /
	// `pin-b-{icon}` lands, MapLibre logs `Image "…" could not be loaded`
	// for every tile that wants to draw it — on a fresh load with dozens
	// of unique icon names that's a flood of warnings. The placeholder
	// handler registers a 1×1 transparent stub for any missing id; the
	// real sprite replaces it on resolution (see maplibreSprites.ts).
	installPlaceholderHandler(map);

	map.on("load", async () => {
		if (!map || destroyed) return;

		// Critical sprites must succeed; the saved-badge fetch goes to a
		// third-party CDN and should NOT block the rest of map init if
		// it fails. Wrap it with a catch so a transient Iconify outage
		// just degrades the saved-state badge.
		// The pin and pin-boosted plain sprites are NOT loaded here —
		// every pin layer references the composite `pin-r-{icon}` /
		// `pin-b-{icon}` names produced lazily by ensureSpritesForPlaces.
		await Promise.all([
			loadSavedBadgeSprite(map).catch((err) => {
				console.warn("Saved-badge sprite failed to load:", err);
			}),
			loadCommentBadgeSprite(map),
			loadClusterHitSprite(map),
		]);

		// Component may have been destroyed while sprites were loading
		// (user navigated away within ~1s of mount). Without this check
		// every subsequent addSource/addLayer/new Spiderfy/addEventListener
		// would run against a removed map and leak handlers. onDestroy's
		// `map?.remove()` runs but leaves the variable bound to the
		// destroyed instance, so a plain `!map` check doesn't catch this.
		if (destroyed) return;

		map.addSource("places", {
			type: "geojson",
			data: EMPTY_COLLECTION,
			cluster: true,
			clusterRadius: 80,
			// CLUSTERING_DISABLED_ZOOM is 17; clusterMaxZoom=16 means at z17+ all points unclustered.
			clusterMaxZoom: CLUSTERING_DISABLED_ZOOM - 1,
		});

		// Separate non-clustered source for boosted places. Above
		// BOOSTED_CLUSTERING_MAX_ZOOM, syncPlacesToSource routes boosted
		// features here so they stay visually prominent above cluster discs and
		// never get absorbed into a cluster icon. At/below that zoom they're
		// routed into the clustered `places` source instead (see
		// $lib/map/boostedClustering) — the MapLibre analogue of the legacy
		// /map's dedicated boostedLayer + BOOSTED_CLUSTERING_MAX_ZOOM swap.
		map.addSource("places-boosted", {
			type: "geojson",
			data: EMPTY_COLLECTION,
		});

		// Hover hull: convex polygon enclosing all leaves of the cluster the
		// cursor is over. Added before the visible cluster discs so the
		// translucent fill sits under, not on top of, the cluster discs.
		map.addSource("cluster-hull", {
			type: "geojson",
			data: EMPTY_HULL_COLLECTION,
		});

		map.addLayer({
			id: "cluster-hull-fill",
			type: "fill",
			source: "cluster-hull",
			paint: {
				"fill-color": "rgba(110, 204, 57, 0.15)",
			},
		});

		map.addLayer({
			id: "cluster-hull-outline",
			type: "line",
			source: "cluster-hull",
			paint: {
				"line-color": "rgba(110, 204, 57, 0.6)",
				"line-width": 1.5,
			},
		});

		// Translucent outer ring — green/yellow/orange tiers by point_count
		// at 0.6 alpha.
		map.addLayer({
			id: "clusters-outer",
			type: "circle",
			source: "places",
			filter: ["has", "point_count"],
			paint: {
				"circle-color": [
					"step",
					["get", "point_count"],
					"rgba(181, 226, 140, 0.6)",
					10,
					"rgba(241, 211, 87, 0.6)",
					100,
					"rgba(253, 156, 115, 0.6)",
				],
				"circle-radius": 20,
			},
		});

		map.addLayer({
			id: "clusters-inner",
			type: "circle",
			source: "places",
			filter: ["has", "point_count"],
			paint: {
				"circle-color": [
					"step",
					["get", "point_count"],
					"rgba(110, 204, 57, 0.6)",
					10,
					"rgba(240, 194, 12, 0.6)",
					100,
					"rgba(241, 128, 23, 0.6)",
				],
				"circle-radius": 15,
			},
		});

		map.addLayer({
			id: "cluster-count",
			type: "symbol",
			source: "places",
			filter: ["has", "point_count"],
			layout: {
				"text-field": ["get", "point_count_abbreviated"],
				"text-font": ["Noto Sans Bold"],
				"text-size": 12,
				"text-allow-overlap": true,
				"text-ignore-placement": true,
				// Keep count upright when the map rotates.
				"text-rotation-alignment": "viewport",
				"text-pitch-alignment": "viewport",
			},
			paint: {
				"text-color": "#000",
			},
		});

		// Symbol layer for unclustered points; boosted places use the orange pin.
		// Drawn last so pins sit on top of cluster discs at boundaries.
		map.addLayer({
			id: "unclustered-point",
			type: "symbol",
			source: "places",
			filter: ["!", ["has", "point_count"]],
			layout: {
				// Look up composite sprite (pin shape + baked category icon). Until
				// the icon's sprite finishes loading, MapLibre logs a warning and
				// skips the symbol; pins appear as their composite sprites resolve.
				"icon-image": [
					"concat",
					"pin-",
					["case", ["coalesce", ["get", "boosted"], false], "b", "r"],
					"-",
					["coalesce", ["get", "icon"], "question_mark"],
				],
				"icon-size": 1,
				"icon-anchor": "bottom",
				"icon-allow-overlap": true,
				"icon-ignore-placement": true,
				// Keep pins upright as the map rotates/pitches.
				"icon-rotation-alignment": "viewport",
				"icon-pitch-alignment": "viewport",
			},
		});

		// Boosted pins — drawn from the separate non-clustered source on top
		// of cluster discs so a paid boost is always visually prominent.
		map.addLayer({
			id: "boosted-point",
			type: "symbol",
			source: "places-boosted",
			layout: {
				"icon-image": [
					"concat",
					"pin-b-",
					["coalesce", ["get", "icon"], "question_mark"],
				],
				"icon-size": 1,
				"icon-anchor": "bottom",
				"icon-allow-overlap": true,
				"icon-ignore-placement": true,
				"icon-rotation-alignment": "viewport",
				"icon-pitch-alignment": "viewport",
			},
		});

		// Comment count badge — green disc on the pin's top-right corner.
		// Comment count badge — fixed 16×16 green disc rendered as a
		// dedicated icon symbol layer. Two layers (disc + text) instead of
		// one composite symbol so positioning stays simple — both share the
		// same offset from the pin anchor.
		// Pin is 32×43, icon-anchor: bottom. Top-right of the pin head is
		// ~(+10, -36) px from the geographic anchor.
		map.addLayer({
			id: "comment-badge",
			type: "symbol",
			source: "places",
			filter: [
				"all",
				["!", ["has", "point_count"]],
				[">", ["get", "comments"], 0],
			],
			layout: {
				"icon-image": "comment-badge-bg",
				"icon-size": 1,
				"icon-allow-overlap": true,
				"icon-ignore-placement": true,
				"icon-rotation-alignment": "viewport",
				"icon-pitch-alignment": "viewport",
				"icon-offset": [10, -36],
			},
		});

		map.addLayer({
			id: "comment-badge-count",
			type: "symbol",
			source: "places",
			filter: [
				"all",
				["!", ["has", "point_count"]],
				[">", ["get", "comments"], 0],
			],
			layout: {
				"text-field": ["to-string", ["get", "comments"]],
				"text-font": ["Noto Sans Bold"],
				"text-size": 11,
				"text-allow-overlap": true,
				"text-ignore-placement": true,
				"text-rotation-alignment": "viewport",
				"text-pitch-alignment": "viewport",
				// text-offset is in ems; mirror the disc's pixel offset above.
				"text-offset": [10 / 11, -36 / 11],
			},
			paint: {
				"text-color": "#fff",
			},
		});

		// Saved badge — white disc with bookmark glyph on the pin's
		// top-left corner. Filter only fires when the feature's `saved`
		// flag is true (recomputed when $savedPlaceIds size changes).
		map.addLayer({
			id: "saved-badge",
			type: "symbol",
			source: "places",
			filter: [
				"all",
				["!", ["has", "point_count"]],
				["==", ["get", "saved"], true],
			],
			layout: {
				"icon-image": "saved-badge",
				"icon-size": 1,
				"icon-anchor": "center",
				// Top-left of the pin head, relative to the bottom-anchored pin.
				"icon-offset": [-12, -38],
				"icon-allow-overlap": true,
				"icon-ignore-placement": true,
				"icon-rotation-alignment": "viewport",
				"icon-pitch-alignment": "viewport",
			},
		});

		// Place name labels — visible at high zoom once the enriched-details
		// fetch has populated each place's name. Drawn before clusters-hit so
		// the spiderfy hit-target stays on top for click routing.
		map.addLayer({
			id: "place-label",
			type: "symbol",
			source: "places",
			minzoom: LABEL_VISIBLE_ZOOM,
			filter: [
				"all",
				["!", ["has", "point_count"]],
				["!=", ["get", "name"], ""],
			],
			layout: {
				"text-field": ["get", "name"],
				"text-font": ["Noto Sans Bold"],
				"text-size": 14,
				"text-anchor": "left",
				// text-offset is in ems. Pin's right edge sits at ~+16 px from
				// the geographic anchor (icon-anchor: bottom). Start the label
				// 6 px past that, vertically centered on the pin head (~ -25 px).
				"text-offset": [22 / 14, -25 / 14],
				"text-max-width": 12,
				"text-rotation-alignment": "viewport",
				"text-pitch-alignment": "viewport",
			},
			paint: {
				"text-color": [
					"case",
					["get", "boosted"],
					"#f97316", // orange-500 (boosted)
					"#0e7490", // cyan-700 (regular)
				],
				"text-halo-color": "#fff",
				"text-halo-width": 1.2,
				"text-halo-blur": 0,
			},
		});

		// Mirrors of comment-badge / comment-badge-count / saved-badge /
		// place-label for the parallel `places-boosted` source. Without
		// these a boosted merchant with comments / saved state / a
		// resolved label rendered as a bare orange pin.
		map.addLayer({
			id: "boosted-comment-badge",
			type: "symbol",
			source: "places-boosted",
			filter: [">", ["get", "comments"], 0],
			layout: {
				"icon-image": "comment-badge-bg",
				"icon-size": 1,
				"icon-allow-overlap": true,
				"icon-ignore-placement": true,
				"icon-rotation-alignment": "viewport",
				"icon-pitch-alignment": "viewport",
				"icon-offset": [10, -36],
			},
		});

		map.addLayer({
			id: "boosted-comment-badge-count",
			type: "symbol",
			source: "places-boosted",
			filter: [">", ["get", "comments"], 0],
			layout: {
				"text-field": ["to-string", ["get", "comments"]],
				"text-font": ["Noto Sans Bold"],
				"text-size": 11,
				"text-allow-overlap": true,
				"text-ignore-placement": true,
				"text-rotation-alignment": "viewport",
				"text-pitch-alignment": "viewport",
				"text-offset": [10 / 11, -36 / 11],
			},
			paint: {
				"text-color": "#fff",
			},
		});

		map.addLayer({
			id: "boosted-saved-badge",
			type: "symbol",
			source: "places-boosted",
			filter: ["==", ["get", "saved"], true],
			layout: {
				"icon-image": "saved-badge",
				"icon-size": 1,
				"icon-anchor": "center",
				"icon-offset": [-12, -38],
				"icon-allow-overlap": true,
				"icon-ignore-placement": true,
				"icon-rotation-alignment": "viewport",
				"icon-pitch-alignment": "viewport",
			},
		});

		map.addLayer({
			id: "boosted-place-label",
			type: "symbol",
			source: "places-boosted",
			minzoom: LABEL_VISIBLE_ZOOM,
			filter: ["!=", ["get", "name"], ""],
			layout: {
				"text-field": ["get", "name"],
				"text-font": ["Noto Sans Bold"],
				"text-size": 14,
				"text-anchor": "left",
				"text-offset": [22 / 14, -25 / 14],
				"text-max-width": 12,
				"text-rotation-alignment": "viewport",
				"text-pitch-alignment": "viewport",
			},
			paint: {
				"text-color": "#f97316", // orange-500 (always boosted on this source)
				"text-halo-color": "#fff",
				"text-halo-width": 1.2,
				"text-halo-blur": 0,
			},
		});

		// Symbol cluster layer used by spiderfy. Hit-testing on this layer's
		// near-invisible icon picks up the cluster_id property and routes
		// through the library, which auto-decides between zoom-on-click and
		// spiderfying based on getClusterExpansionZoom vs maxZoom.
		map.addLayer({
			id: "clusters-hit",
			type: "symbol",
			source: "places",
			filter: ["has", "point_count"],
			layout: {
				"icon-image": "cluster-hit",
				"icon-size": 1,
				"icon-allow-overlap": true,
				"icon-ignore-placement": true,
			},
		});

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
				const placeId = feature.properties?.id;
				if (typeof placeId === "number") {
					merchantDrawer.open(placeId, "details");
				}
			},
			closeOnLeafClick: true,
			spiderLeavesLayout: {
				"icon-image": [
					"concat",
					"pin-",
					["case", ["coalesce", ["get", "boosted"], false], "b", "r"],
					"-",
					["coalesce", ["get", "icon"], "question_mark"],
				],
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

		// Cluster hover → draw a convex hull around its leaves. Capped at 500
		// leaves to keep convex computation cheap on dense clusters.
		map.on("mouseenter", "clusters-outer", (e: MapLayerMouseEvent) => {
			if (!map) return;
			const feature = e.features?.[0] as MapGeoJSONFeature | undefined;
			if (!feature) return;
			const clusterId = feature.properties?.cluster_id as number | undefined;
			const pointCount = feature.properties?.point_count as number | undefined;
			if (clusterId === undefined) return;
			latestHullClusterId = clusterId;
			const source = map.getSource("places") as GeoJSONSource | undefined;
			const hullSource = map.getSource("cluster-hull") as
				| GeoJSONSource
				| undefined;
			if (!source || !hullSource) return;
			const limit = Math.min(pointCount ?? 500, 500);
			source
				.getClusterLeaves(clusterId, limit, 0)
				.then((leaves) => {
					// Stale callback guard — bail if hover has moved to another
					// cluster (or cleared entirely) by the time leaves resolve.
					if (latestHullClusterId !== clusterId) return;
					const points: Feature<Point>[] = [];
					for (const leaf of leaves) {
						if (leaf.geometry?.type !== "Point") continue;
						const coords = leaf.geometry.coordinates as [number, number];
						points.push(point(coords));
					}
					const hull = convex(featureCollection(points));
					if (!hull) {
						// Degenerate cluster (≤ 2 unique points / collinear) — clear
						// any stale hull from a previous hover instead of leaving it on.
						hullSource.setData(EMPTY_HULL_COLLECTION);
						return;
					}
					hullSource.setData({
						type: "FeatureCollection",
						features: [hull],
					});
				})
				.catch((err) => {
					// Cluster id can become invalid mid-flight when syncPlacesToSource
					// replaces the source data and the cluster index regenerates.
					// Swallow that — the hover will redraw on the next mouseenter.
					if (latestHullClusterId === clusterId) {
						latestHullClusterId = null;
					}
					console.debug("hover-hull getClusterLeaves rejected", err);
				});
		});

		map.on("mouseleave", "clusters-outer", () => {
			if (!map) return;
			latestHullClusterId = null;
			const hullSource = map.getSource("cluster-hull") as
				| GeoJSONSource
				| undefined;
			hullSource?.setData(EMPTY_HULL_COLLECTION);
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
			// — the MapLibre analogue of the legacy boostedLayer swap. Only re-syncs
			// on an actual flip, so steady-state pans stay cheap.
			if (shouldClusterBoostedAtZoom(currentZoom) !== boostedAreClustered) {
				syncPlacesToSource(lastSyncedList);
			}
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

		styleLoaded = true;
		lastPlacesLength = -1;
		lastSavedIdsSize = -1;
		lastEnrichedCacheSize = -1;
		lastSearchModeSig = "";
		// Apply theme-dependent label palette now that the layer exists.
		applyLabelPalette(map, get(theme));
		lastAppliedLabelTheme = get(theme);
		syncPlacesToSource($places);
		// Kick once on load — if the user lands above the threshold, labels
		// should appear without requiring a move.
		triggerEnrichmentIfNeeded();
	});
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
	debouncedPanelSearch.cancel();
	searchAbortController?.abort();
	searchAbortController = null;
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
	map?.remove();
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

<div
	bind:this={mapContainer}
	class="map-container"
	style="--search-sheet-peek: {SEARCH_SHEET_PEEK_HEIGHT}px"
></div>

{#if webglUnsupported}
	<MapUnsupportedFallback />
{/if}

<MapLoadingMain progress={mapLoading} status={mapLoadingStatus} />

<!--
	Floating search bar — desktop only, top-left. On mobile the merchant
	list panel renders as a bottom sheet whose peek state carries the
	single search input instead. The bar itself hides when the list panel
	is open (the panel renders its own search input in the same slot).
-->
{#if styleLoaded && !isMobileLayout}
	<div class="pointer-events-none absolute top-3 left-3 z-[1000]">
		<MapSearchBar
			onSearch={handlePanelSearch}
			onFocus={() => {
				merchantList.open();
				updateMerchantList({ force: true });
			}}
			nearbyCount={$merchantList.totalCount}
		/>
	</div>
{/if}

<MerchantListPanel
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
	onSearch={handlePanelSearch}
	onModeChange={handleModeChange}
	onRefresh={() => updateMerchantList({ force: true })}
	{currentZoom}
	mapReady={styleLoaded}
	isMobile={isMobileLayout}
/>

{#if styleLoaded}
	<CommunityRail
		lat={currentLat}
		lon={currentLon}
		zoom={currentZoom}
		{map}
	/>
{/if}

<TileLoadingIndicator visible={tilesLoading && !webglUnsupported} />

<MerchantDrawerHash />

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

	/* Mobile: lift the scale bar and OSM attribution above the search
	   peek sheet so the license credit stays visible. The height comes
	   from SEARCH_SHEET_PEEK_HEIGHT via the --search-sheet-peek custom
	   property on .map-container. Scoped to this page — /communities/map
	   has no sheet. */
	@media (max-width: 767px) {
		.map-container :global(.maplibregl-ctrl-bottom-left),
		.map-container :global(.maplibregl-ctrl-bottom-right) {
			/* the sheet renders at peek + safe-area inset, mirror that */
			bottom: calc(var(--search-sheet-peek) + env(safe-area-inset-bottom));
		}
	}
</style>

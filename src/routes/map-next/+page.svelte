<script lang="ts">
import "maplibre-gl/dist/maplibre-gl.css";

import Spiderfy from "@nazka/map-gl-js-spiderfy";
import convex from "@turf/convex";
import { featureCollection, point } from "@turf/helpers";
import type { Feature, FeatureCollection, Point, Polygon } from "geojson";
import type {
	GeoJSONSource,
	MapGeoJSONFeature,
	MapLayerMouseEvent,
	Map as MapLibreMap,
	StyleSpecification,
} from "maplibre-gl";
import { onDestroy, onMount } from "svelte";
import { get } from "svelte/store";

import {
	CLUSTERING_DISABLED_ZOOM,
	DEFAULT_MAP_LAT,
	DEFAULT_MAP_LNG,
	DEFAULT_MAP_ZOOM,
	LABEL_VISIBLE_ZOOM,
} from "$lib/constants";
import { getDisplayLang, locale } from "$lib/i18n";
import {
	BASEMAP_STORAGE_KEY,
	BASEMAPS,
	type BasemapId,
	getStoredBasemap,
} from "$lib/map/basemaps";
import {
	type HashCoords,
	parseHashCoords,
	writeHashCoords,
} from "$lib/map/mapHash";
import { ensureSpritesForPlaces, loadSvgImage } from "$lib/map/maplibreSprites";
import { calculateRadiusKmFromLngLatBounds } from "$lib/map/viewport";
import { parseMerchantHash } from "$lib/merchantDrawerHash";
import { merchantDrawer } from "$lib/merchantDrawerStore";
import { merchantList } from "$lib/merchantListStore";
import { savedPlaceIds } from "$lib/session";
import { places, placesById } from "$lib/store";
import { theme } from "$lib/theme";
import type { Place } from "$lib/types";
import { userLocation } from "$lib/userLocationStore";
import { debounce, isBoosted } from "$lib/utils";

import MerchantDrawerHash from "../map/components/MerchantDrawerHash.svelte";

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
let selectedBasemap: BasemapId = "osm"; // overridden in onMount once theme + storage are read

const handleBasemapChange = () => {
	if (!map) return;
	for (const b of BASEMAPS) {
		map.setLayoutProperty(
			b.id,
			"visibility",
			b.id === selectedBasemap ? "visible" : "none",
		);
	}
	try {
		localStorage.setItem(BASEMAP_STORAGE_KEY, selectedBasemap);
	} catch {
		// localStorage unavailable; skip persistence
	}
};
let spiderfier: Spiderfy | undefined;
let styleLoaded = false;
let lastPlacesLength = -1;
let lastSavedIdsSize = -1;
let lastEnrichedCacheSize = -1;
let lastLocale: string | null | undefined;
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

const panToPlace = (lat: number, lon: number) => {
	if (!map) return;
	map.easeTo({ center: [lon, lat], zoom: DEFAULT_MAP_ZOOM, duration: 300 });
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

const buildFeatureCollection = (list: Place[]): PlaceFeatureCollection => {
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
		features: list
			.filter((p) => !p.deleted_at)
			.map((p) => ({
				type: "Feature",
				geometry: { type: "Point", coordinates: [p.lon, p.lat] },
				properties: {
					id: p.id,
					boosted: Boolean(isBoosted(p)),
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

const buildSavedBadgeSvg = (bookmarkSvg: string): string =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#fff" stroke="${LINK_COLOR}" stroke-width="1"/><g transform="translate(3, 3)">${bookmarkSvg}</g></svg>`;

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
	const canvas = document.createElement("canvas");
	canvas.width = 16;
	canvas.height = 16;
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	ctx.fillStyle = "#16A34A";
	ctx.beginPath();
	ctx.arc(8, 8, 8, 0, Math.PI * 2);
	ctx.fill();
	m.addImage("comment-badge-bg", ctx.getImageData(0, 0, 16, 16), {
		pixelRatio: 1,
	});
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
		m.addImage("saved-badge", img, { pixelRatio: 1 });
	m.triggerRepaint();
};

const syncPlacesToSource = (list: Place[]) => {
	if (!map || !styleLoaded) return;
	const source = map.getSource("places") as GeoJSONSource | undefined;
	if (!source) return;
	source.setData(buildFeatureCollection(list));
	ensureSpritesForPlaces(map, list);
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
	const placesLen = $places.length;
	const savedSize = $savedPlaceIds.size;
	const cacheSize = $merchantList.placeDetailsCache.size;
	const currentLocale = $locale;
	if (
		placesLen !== lastPlacesLength ||
		savedSize !== lastSavedIdsSize ||
		cacheSize !== lastEnrichedCacheSize ||
		currentLocale !== lastLocale
	) {
		lastPlacesLength = placesLen;
		lastSavedIdsSize = savedSize;
		lastEnrichedCacheSize = cacheSize;
		lastLocale = currentLocale;
		syncPlacesToSource($places);
	}
}

onMount(async () => {
	const maplibre = await import("maplibre-gl");
	// User may have navigated away while the dynamic import was in flight;
	// bail out before instantiating against an unmounted container.
	if (destroyed) return;

	// All available basemaps are raster tile sources, declared upfront so
	// the basemap switcher only has to toggle layer visibility — no
	// setStyle calls, which avoid the tile-compile cascade that broke the
	// first attempt at this in Phase 4.
	const initialBasemap: BasemapId =
		getStoredBasemap() ?? (get(theme) === "dark" ? "carto-dark" : "osm");
	selectedBasemap = initialBasemap;

	const style: StyleSpecification = {
		version: 8,
		// OpenFreeMap's public glyph endpoint (Cloudflare R2, no key, production-OK).
		// MapLibre's demotiles.maplibre.org is explicitly a demo server with no SLA —
		// see https://github.com/maplibre/demotiles (README: "web, helloworld and CI tests").
		glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
		sources: {
			osm: {
				type: "raster",
				tiles: [
					"https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
					"https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
					"https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
				],
				tileSize: 256,
				attribution:
					'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
				maxzoom: 19,
			},
			"carto-light": {
				type: "raster",
				tiles: [
					"https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
					"https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
					"https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
					"https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
				],
				tileSize: 256,
				attribution:
					'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
				maxzoom: 19,
			},
			"carto-dark": {
				type: "raster",
				tiles: [
					"https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
					"https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
					"https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
					"https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
				],
				tileSize: 256,
				attribution:
					'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
				maxzoom: 19,
			},
		},
		layers: [
			{
				id: "osm",
				type: "raster",
				source: "osm",
				layout: { visibility: initialBasemap === "osm" ? "visible" : "none" },
			},
			{
				id: "carto-light",
				type: "raster",
				source: "carto-light",
				layout: {
					visibility: initialBasemap === "carto-light" ? "visible" : "none",
				},
			},
			{
				id: "carto-dark",
				type: "raster",
				source: "carto-dark",
				layout: {
					visibility: initialBasemap === "carto-dark" ? "visible" : "none",
				},
			},
		],
	};

	// If the URL hash already encodes a viewport, restore it; otherwise
	// fall back to the project defaults.
	const hashCoords = parseHashCoords();

	map = new maplibre.Map({
		container: mapContainer,
		// Minimal inline raster style — OSM tiles. Vector basemaps come in Phase 4.
		style,
		center: hashCoords
			? [hashCoords.lng, hashCoords.lat]
			: [DEFAULT_MAP_LNG, DEFAULT_MAP_LAT],
		zoom: hashCoords?.zoom ?? DEFAULT_MAP_ZOOM,
		bearing: hashCoords?.bearing ?? 0,
		pitch: hashCoords?.pitch ?? 0,
		maxZoom: 19,
		// Rotation + pitch enabled — the whole point of the migration
		dragRotate: true,
		touchZoomRotate: true,
		pitchWithRotate: false,
	});

	map.addControl(
		new maplibre.NavigationControl({
			showCompass: true,
			showZoom: true,
			visualizePitch: false,
		}),
		"top-right",
	);
	map.addControl(new maplibre.GlobeControl(), "top-right");

	// Geolocate control — replaces leaflet.locatecontrol. The pulse dot,
	// accuracy circle, and heading arrow are built in. Heading uses the
	// device's compass when available, falling back to GPS movement.
	const geolocate = new maplibre.GeolocateControl({
		positionOptions: { enableHighAccuracy: true },
		trackUserLocation: true,
		showUserLocation: true,
		showAccuracyCircle: true,
	});
	map.addControl(geolocate, "top-right");

	// Mirror /map's behavior: sync location into the userLocation store so
	// the merchant list panel can compute distances without prompting again.
	geolocate.on("geolocate", (e: GeolocationPosition) => {
		userLocation.setLocation(e.coords.latitude, e.coords.longitude);
	});

	map.on("load", async () => {
		if (!map) return;

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

		map.addSource("places", {
			type: "geojson",
			data: EMPTY_COLLECTION,
			cluster: true,
			clusterRadius: 80,
			// CLUSTERING_DISABLED_ZOOM is 17; clusterMaxZoom=16 means at z17+ all points unclustered.
			clusterMaxZoom: CLUSTERING_DISABLED_ZOOM - 1,
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

		// Translucent outer ring — colors tiered by point_count to match
		// stock leaflet.markercluster defaults (green/yellow/orange, 0.6 alpha).
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
		// Mirrors prod's `.marker-label` / `.marker-label-boosted` styling
		// (src/app.css:264-310). Dark-mode color swap is Phase 6 polish.
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

		// Unclustered marker click → open the global merchant drawer. The
		// drawer component lives in the layout, so we only need to push state
		// into the store.
		map.on("click", "unclustered-point", (e: MapLayerMouseEvent) => {
			const feature = e.features?.[0] as MapGeoJSONFeature | undefined;
			const placeId = feature?.properties?.id;
			if (typeof placeId !== "number") return;
			merchantDrawer.open(placeId, "details");
		});

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
				layers: ["unclustered-point", "clusters-hit", ...spiderLeafLayerIds],
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
			source.getClusterLeaves(clusterId, limit, 0).then((leaves) => {
				// Stale callback guard — bail if hover has moved to another cluster
				// (or cleared entirely) by the time leaves resolve.
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

		// If the URL also encoded a merchant=… param, open the drawer to it.
		merchantDrawer.syncFromHash();

		// Browser back/forward (and any external code mutating the hash) must
		// keep the drawer in sync. /map also wires this.
		window.addEventListener("hashchange", handleHashChange);

		// Deep link: URL had a merchant= param but the hash carried no
		// viewport coords. Pan the camera to the merchant once it's in the
		// places store. If places are still loading, subscribe and wait —
		// 10s safety unsubscribe so we never leak.
		if (!hashCoords) {
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
		syncPlacesToSource($places);
		// Kick once on load — if the user lands above the threshold, labels
		// should appear without requiring a move.
		triggerEnrichmentIfNeeded();
	});
});

onDestroy(() => {
	destroyed = true;
	triggerEnrichmentIfNeeded.cancel();
	if (typeof window !== "undefined") {
		window.removeEventListener("hashchange", handleHashChange);
	}
	if (deepLinkPanTimer) clearTimeout(deepLinkPanTimer);
	deepLinkPanUnsub?.();
	deepLinkPanUnsub = null;
	spiderfier?.unspiderfyAll();
	spiderfier = undefined;
	map?.remove();
});
</script>

<svelte:head>
	<title>Map (next) — BTC Map</title>
</svelte:head>

<div bind:this={mapContainer} class="map-container"></div>

<div class="basemap-switcher">
	<select
		bind:value={selectedBasemap}
		on:change={handleBasemapChange}
		aria-label="Basemap"
	>
		{#each BASEMAPS as bm (bm.id)}
			<option value={bm.id}>{bm.label}</option>
		{/each}
	</select>
</div>

<MerchantDrawerHash />

<style>
	.map-container {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.basemap-switcher {
		position: absolute;
		/* Sits below the top-right control stack (zoom + compass + globe +
		   geolocate, ~175px tall under maplibre-gl v5). 187px clears it
		   with a small gap. Adjust if the stack changes. */
		top: 187px;
		right: 10px;
		z-index: 1;
		background: white;
		color: #111827; /* gray-900 */
		border-radius: 4px;
		padding: 2px 4px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
	}
	/* Dark-mode follows the same `.dark` root class as the rest of the
	   site (see src/app.css). Colors match the Leaflet dark-control
	   palette so this switcher reads consistently with the rest of the
	   chrome once we land on a dark basemap. */
	:global(.dark) .basemap-switcher {
		background: #1f2937; /* gray-800 — matches --leaflet-bg */
		color: #f3f4f6; /* gray-100 */
	}
	.basemap-switcher select {
		background: transparent;
		border: none;
		font-size: 12px;
		cursor: pointer;
		color: inherit;
	}
</style>

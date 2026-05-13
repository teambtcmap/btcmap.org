<script lang="ts">
import "maplibre-gl/dist/maplibre-gl.css";

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
} from "$lib/constants";
import { savedPlaceIds } from "$lib/session";
import { places } from "$lib/store";
import type { Place } from "$lib/types";
import { isBoosted } from "$lib/utils";

type PlaceFeature = {
	type: "Feature";
	geometry: { type: "Point"; coordinates: [number, number] };
	properties: {
		id: number;
		boosted: boolean;
		icon: string;
		comments: number;
		saved: boolean;
	};
};

type PlaceFeatureCollection = {
	type: "FeatureCollection";
	features: PlaceFeature[];
};

let mapContainer: HTMLDivElement;
let map: MapLibreMap | undefined;
let styleLoaded = false;
let lastPlacesLength = -1;
let lastSavedIdsSize = -1;

const EMPTY_COLLECTION: PlaceFeatureCollection = {
	type: "FeatureCollection",
	features: [],
};

const buildFeatureCollection = (list: Place[]): PlaceFeatureCollection => {
	const saved = get(savedPlaceIds);
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
				},
			})),
	};
};

// Load an SVG/PNG into the map's image registry. MapLibre needs raster bitmaps
// for sprites, so we route SVG through an <img> element first.
const loadIconImage = (
	m: MapLibreMap,
	name: string,
	url: string,
): Promise<void> =>
	new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => {
			if (!m.hasImage(name)) m.addImage(name, img);
			resolve();
		};
		img.onerror = (err) => reject(err);
		img.src = url;
	});

// Mirrors Icon.svelte's material-symbol resolution. Keep in sync.
const materialExceptions: Record<string, string> = {
	camping: "material-symbols:camping-rounded",
	gate: "material-symbols:gate",
	cooking: "material-symbols:cooking",
	dentistry: "material-symbols:dentistry",
	sauna: "material-symbols:sauna",
	info_outline: "material-symbols:info-outline",
	skull: "material-symbols:skull",
	currency_bitcoin: "material-symbols:currency-bitcoin",
};

const resolveIconifyName = (icon: string): string => {
	const key = icon === "question_mark" ? "currency_bitcoin" : icon;
	return materialExceptions[key] ?? `ic:outline-${key.replace(/_/g, "-")}`;
};

const PIN_PATH =
	"M0 16.0333C0 6.08 8.05161 0.131836 15.8361 0.131836C23.6205 0.131836 31.6721 6.08 31.6721 16.0333C31.6721 26.461 16.9494 41.3035 16.3229 41.9301C16.1941 42.0595 16.0185 42.1318 15.8361 42.1318C15.6536 42.1318 15.478 42.0595 15.3493 41.9301C14.7227 41.3035 0 26.461 0 16.0333Z";

const PIN_FILL_REGULAR = "#0E95AF";
const PIN_FILL_BOOSTED = "#F7931A";

// Tailwind `text-link` color (tailwind.config.js → colors.link).
const LINK_COLOR = "#0099AF";

const buildSavedBadgeSvg = (bookmarkSvg: string): string =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#fff" stroke="${LINK_COLOR}" stroke-width="1"/><g transform="translate(3, 3)">${bookmarkSvg}</g></svg>`;

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

const spriteName = (icon: string, boosted: boolean): string =>
	`pin-${boosted ? "b" : "r"}-${icon}`;

// Module-scoped to dedupe in-flight + completed sprite generation across
// $places updates within the page session.
const spritePromises = new Map<string, Promise<void>>();

const fetchIconInnerSvg = async (icon: string): Promise<string> => {
	const iconifyName = resolveIconifyName(icon);
	const path = iconifyName.replace(":", "/");
	const url = `https://api.iconify.design/${path}.svg?color=white&width=20&height=20`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Iconify fetch failed: ${res.status} ${url}`);
	return await res.text();
};

const buildCompositeSvg = (innerSvg: string, boosted: boolean): string => {
	const fill = boosted ? PIN_FILL_BOOSTED : PIN_FILL_REGULAR;
	// innerSvg is a complete <svg>...</svg> document; nesting an SVG inside an
	// outer SVG is valid and rasterizes correctly through <img>.
	return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="43" viewBox="0 0 32 43"><path d="${PIN_PATH}" fill="${fill}"/><g transform="translate(6, 5.75)">${innerSvg}</g></svg>`;
};

const loadSvgImage = (svg: string): Promise<HTMLImageElement> =>
	new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => resolve(img);
		img.onerror = (err) => reject(err);
		img.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
	});

const ensureSprite = (
	m: MapLibreMap,
	icon: string,
	boosted: boolean,
): Promise<void> => {
	const name = spriteName(icon, boosted);
	if (m.hasImage(name)) return Promise.resolve();
	const existing = spritePromises.get(name);
	if (existing) return existing;
	const promise = (async () => {
		const inner = await fetchIconInnerSvg(icon);
		const composite = buildCompositeSvg(inner, boosted);
		const img = await loadSvgImage(composite);
		if (!m.hasImage(name)) m.addImage(name, img, { pixelRatio: 1 });
		m.triggerRepaint();
	})();
	spritePromises.set(name, promise);
	// Don't keep a rejected promise cached — allow retry on next $places tick.
	promise.catch(() => spritePromises.delete(name));
	return promise;
};

const ensureSpritesForPlaces = (m: MapLibreMap, list: Place[]): void => {
	const seen = new Set<string>();
	for (const p of list) {
		if (p.deleted_at) continue;
		const icon = p.icon ?? "question_mark";
		const boosted = Boolean(isBoosted(p));
		const key = spriteName(icon, boosted);
		if (seen.has(key)) continue;
		seen.add(key);
		ensureSprite(m, icon, boosted);
	}
};

const syncPlacesToSource = (list: Place[]) => {
	if (!map || !styleLoaded) return;
	const source = map.getSource("places") as GeoJSONSource | undefined;
	if (!source) return;
	source.setData(buildFeatureCollection(list));
	ensureSpritesForPlaces(map, list);
};

// Rebuild only when the count changes meaningfully (and always on first load),
// to avoid jank on incremental store updates with ~50k places worldwide.
// Also rebuild when $savedPlaceIds size changes so the saved badge appears/
// disappears as the user toggles saves. Tracking size catches add/remove
// but misses the swap case (save A + unsave B with no net size change) —
// accepted tradeoff for now.
$: if (map && styleLoaded && $places) {
	const len = $places.length;
	const savedSize = $savedPlaceIds.size;
	if (len !== lastPlacesLength || savedSize !== lastSavedIdsSize) {
		lastPlacesLength = len;
		lastSavedIdsSize = savedSize;
		syncPlacesToSource($places);
	}
}

onMount(async () => {
	const maplibre = await import("maplibre-gl");

	const style: StyleSpecification = {
		version: 8,
		// Glyph server is required for symbol layers (cluster count text).
		// Phase 4 swaps to vector basemaps that include their own glyphs.
		glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
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
		},
		layers: [
			{
				id: "osm",
				type: "raster",
				source: "osm",
			},
		],
	};

	map = new maplibre.Map({
		container: mapContainer,
		// Minimal inline raster style — OSM tiles. Vector basemaps come in Phase 4.
		style,
		center: [DEFAULT_MAP_LNG, DEFAULT_MAP_LAT],
		zoom: DEFAULT_MAP_ZOOM,
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

	map.on("load", async () => {
		if (!map) return;

		await Promise.all([
			loadIconImage(map, "pin", "/icons/div-icon-pin.svg"),
			loadIconImage(map, "pin-boosted", "/icons/boosted-icon-pin.svg"),
			loadSavedBadgeSprite(map),
		]);

		map.addSource("places", {
			type: "geojson",
			data: EMPTY_COLLECTION,
			cluster: true,
			clusterRadius: 80,
			// CLUSTERING_DISABLED_ZOOM is 17; clusterMaxZoom=16 means at z17+ all points unclustered.
			clusterMaxZoom: CLUSTERING_DISABLED_ZOOM - 1,
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
				"text-font": ["Open Sans Semibold"],
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
					["case", ["get", "boosted"], "b", "r"],
					"-",
					["get", "icon"],
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
		// We use text-halo as the disc background: no extra sprite needed,
		// and the halo grows proportionally with digit count (1 → 99 stays
		// legible). Layered above the pin so it's never occluded.
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
				"text-field": ["to-string", ["get", "comments"]],
				"text-font": ["Open Sans Semibold"],
				"text-size": 9,
				"text-allow-overlap": true,
				"text-ignore-placement": true,
				"text-rotation-alignment": "viewport",
				"text-pitch-alignment": "viewport",
				// Pin is 32×43 with icon-anchor: bottom. Top-right of the pin
				// head is roughly (+10, -36) px from the anchor. text-offset
				// is in ems, so divide by text-size (9).
				"text-offset": ["literal", [10 / 9, -36 / 9]],
			},
			paint: {
				"text-color": "#fff",
				// bg-green-600
				"text-halo-color": "#16A34A",
				"text-halo-width": 6,
				"text-halo-blur": 0,
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

		// Cluster click: zoom to the expansion zoom returned by the supercluster
		// index. If the cluster won't break apart further (e.g. many places
		// share the same lat/lon), spiderfy will pick it up in a later phase.
		map.on("click", "clusters-outer", (e: MapLayerMouseEvent) => {
			if (!map) return;
			const feature = e.features?.[0] as MapGeoJSONFeature | undefined;
			if (!feature) return;
			const clusterId = feature.properties?.cluster_id as number | undefined;
			if (clusterId === undefined) return;
			const source = map.getSource("places") as GeoJSONSource | undefined;
			if (!source) return;
			source.getClusterExpansionZoom(clusterId).then((zoom) => {
				if (!map) return;
				const geometry = feature.geometry;
				if (geometry.type !== "Point") return;
				map.easeTo({
					center: geometry.coordinates as [number, number],
					zoom,
					duration: 500,
				});
			});
		});

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

		styleLoaded = true;
		lastPlacesLength = -1;
		lastSavedIdsSize = -1;
		syncPlacesToSource($places);
	});
});

onDestroy(() => {
	map?.remove();
});
</script>

<svelte:head>
	<title>Map (next) — BTC Map</title>
</svelte:head>

<div bind:this={mapContainer} class="map-container"></div>

<style>
	.map-container {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
</style>

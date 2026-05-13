<script lang="ts">
import "maplibre-gl/dist/maplibre-gl.css";

import type {
	GeoJSONSource,
	MapLayerMouseEvent,
	Map as MapLibreMap,
} from "maplibre-gl";
import { onDestroy, onMount } from "svelte";

import AreaMerchantDrawer from "$components/area/AreaMerchantDrawer.svelte";
import MapLoadingEmbed from "$components/MapLoadingEmbed.svelte";
import { theme } from "$lib/theme";
import type { SavedPlace } from "$lib/types";

import { browser } from "$app/environment";

export let places: SavedPlace[];

type PlaceFeature = {
	type: "Feature";
	geometry: { type: "Point"; coordinates: [number, number] };
	properties: {
		id: number;
		icon: string;
	};
};

type PlaceFeatureCollection = {
	type: "FeatureCollection";
	features: PlaceFeature[];
};

const EMPTY_COLLECTION: PlaceFeatureCollection = {
	type: "FeatureCollection",
	features: [],
};

const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/liberty";
const STYLE_DARK = "https://static.btcmap.org/map-styles/dark.json";

let selectedMerchantId: number | null = null;

const openDrawer = (id: number) => {
	selectedMerchantId = id;
};

const closeDrawer = () => {
	selectedMerchantId = null;
};

let mapContainer: HTMLDivElement;
let map: MapLibreMap | undefined;
let mapLoaded = false;
let styleLoaded = false;
let lastAppliedTheme: "light" | "dark" | undefined;

// Mirrors Icon.svelte's material-symbol resolution. Keep in sync with /map-next.
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

// Saved places are always rendered with the bitcoin icon — mirrors the legacy
// Leaflet MultiPlaceMap which hardcodes generateIcon(..., "currency_bitcoin").
const SAVED_PLACE_ICON = "currency_bitcoin";

const spriteName = (icon: string): string => `pin-r-${icon}`;

// Per-instance cache so a setStyle() re-init can clear and regenerate cleanly.
let spritePromises = new Map<string, Promise<void>>();

const fetchIconInnerSvg = async (icon: string): Promise<string> => {
	const iconifyName = resolveIconifyName(icon);
	const path = iconifyName.replace(":", "/");
	const url = `https://api.iconify.design/${path}.svg?color=white&width=20&height=20`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Iconify fetch failed: ${res.status} ${url}`);
	return await res.text();
};

const buildCompositeSvg = (innerSvg: string): string => {
	// innerSvg is a complete <svg>...</svg> document; nesting an SVG inside an
	// outer SVG is valid and rasterizes correctly through <img>.
	return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="43" viewBox="0 0 32 43"><path d="${PIN_PATH}" fill="${PIN_FILL_REGULAR}"/><g transform="translate(6, 5.75)">${innerSvg}</g></svg>`;
};

const loadSvgImage = (svg: string): Promise<HTMLImageElement> =>
	new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => resolve(img);
		img.onerror = (err) => reject(err);
		img.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
	});

const ensureSprite = (m: MapLibreMap, icon: string): Promise<void> => {
	const key = spriteName(icon);
	if (m.hasImage(key)) return Promise.resolve();
	const existing = spritePromises.get(key);
	if (existing) return existing;
	const promise = (async () => {
		const inner = await fetchIconInnerSvg(icon);
		const composite = buildCompositeSvg(inner);
		const img = await loadSvgImage(composite);
		if (!m.hasImage(key)) m.addImage(key, img, { pixelRatio: 1 });
		m.triggerRepaint();
	})();
	spritePromises.set(key, promise);
	promise.catch(() => spritePromises.delete(key));
	return promise;
};

// 1×1 transparent placeholder so styleimagemissing doesn't spam warnings before
// composite sprites resolve. Once the real sprite is added via addImage(), it
// replaces this stub.
const transparentPixel = (): ImageData => {
	const canvas = document.createElement("canvas");
	canvas.width = 1;
	canvas.height = 1;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		return new ImageData(new Uint8ClampedArray([0, 0, 0, 0]), 1, 1);
	}
	return ctx.getImageData(0, 0, 1, 1);
};

const buildFeatureCollection = (
	list: SavedPlace[],
): PlaceFeatureCollection => ({
	type: "FeatureCollection",
	features: list.map((p) => ({
		type: "Feature",
		geometry: { type: "Point", coordinates: [p.lon, p.lat] },
		properties: {
			id: p.id,
			icon: SAVED_PLACE_ICON,
		},
	})),
});

const computeBboxFromPlaces = (
	list: SavedPlace[],
): [number, number, number, number] | null => {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	let found = false;
	for (const p of list) {
		if (typeof p.lat !== "number" || typeof p.lon !== "number") continue;
		if (p.lon < minX) minX = p.lon;
		if (p.lat < minY) minY = p.lat;
		if (p.lon > maxX) maxX = p.lon;
		if (p.lat > maxY) maxY = p.lat;
		found = true;
	}
	if (!found) return null;
	return [minX, minY, maxX, maxY];
};

const addPlacesLayers = (m: MapLibreMap) => {
	if (!m.getSource("places")) {
		m.addSource("places", {
			type: "geojson",
			data: EMPTY_COLLECTION,
		});
	}

	if (!m.getLayer("unclustered-point")) {
		m.addLayer({
			id: "unclustered-point",
			type: "symbol",
			source: "places",
			layout: {
				"icon-image": [
					"concat",
					"pin-r-",
					["coalesce", ["get", "icon"], "currency_bitcoin"],
				],
				"icon-size": 1,
				"icon-anchor": "bottom",
				"icon-allow-overlap": true,
				"icon-ignore-placement": true,
				"icon-rotation-alignment": "viewport",
				"icon-pitch-alignment": "viewport",
			},
		});
	}
};

const syncPlacesSource = (m: MapLibreMap, list: SavedPlace[]) => {
	const source = m.getSource("places") as GeoJSONSource | undefined;
	if (!source) return;
	source.setData(buildFeatureCollection(list));
	ensureSprite(m, SAVED_PLACE_ICON);
};

// Register sprites + sources + layers once per style. Called from both the
// initial `load` event and from subsequent `style.load` events fired after
// `setStyle()` on theme change.
const initializeMapContents = (m: MapLibreMap) => {
	addPlacesLayers(m);
	syncPlacesSource(m, places);

	const bbox = computeBboxFromPlaces(places);
	if (bbox) {
		m.fitBounds(
			[
				[bbox[0], bbox[1]],
				[bbox[2], bbox[3]],
			],
			{ padding: 40, maxZoom: 14, animate: false },
		);
	} else {
		m.jumpTo({ center: [0, 20], zoom: 1 });
	}
};

const handleMarkerClick = (e: MapLayerMouseEvent) => {
	const feature = e.features?.[0];
	const placeId = feature?.properties?.id;
	if (typeof placeId !== "number") return;
	openDrawer(placeId);
	e.originalEvent?.stopPropagation?.();
};

const setPointerCursor = () => {
	if (map) map.getCanvas().style.cursor = "pointer";
};
const resetCursor = () => {
	if (map) map.getCanvas().style.cursor = "";
};

const attachInteractions = (m: MapLibreMap) => {
	m.on("click", "unclustered-point", handleMarkerClick);
	m.on("mouseenter", "unclustered-point", setPointerCursor);
	m.on("mouseleave", "unclustered-point", resetCursor);

	// Bare map click → close any open drawer (mirrors legacy Leaflet behavior).
	m.on("click", (e: MapLayerMouseEvent) => {
		if (!map) return;
		const hits = map.queryRenderedFeatures(e.point, {
			layers: ["unclustered-point"],
		});
		if (hits.length > 0) return;
		if (selectedMerchantId !== null) closeDrawer();
	});
};

const styleUrlForTheme = (t: "light" | "dark" | undefined): string =>
	t === "dark" ? STYLE_DARK : STYLE_LIGHT;

let initialRenderComplete = false;
let dataInitialized = false;

onMount(() => {
	if (browser) {
		initialRenderComplete = true;
	}
});

onDestroy(() => {
	map?.remove();
	map = undefined;
});

const initializeMap = async () => {
	if (dataInitialized) return;
	dataInitialized = true;

	const maplibre = await import("maplibre-gl");

	lastAppliedTheme = $theme;

	map = new maplibre.Map({
		container: mapContainer,
		style: styleUrlForTheme($theme),
		maxZoom: 19,
		dragRotate: true,
		touchZoomRotate: true,
		pitchWithRotate: false,
		attributionControl: { compact: true },
	});

	map.addControl(
		new maplibre.NavigationControl({
			showCompass: true,
			showZoom: true,
			visualizePitch: false,
		}),
		"top-right",
	);

	const geolocate = new maplibre.GeolocateControl({
		positionOptions: { enableHighAccuracy: true },
		trackUserLocation: true,
		showUserLocation: true,
		showAccuracyCircle: true,
	});
	map.addControl(geolocate, "top-right");

	map.on("styleimagemissing", (event) => {
		if (!map) return;
		const id = event.id;
		if (!id || map.hasImage(id)) return;
		map.addImage(id, transparentPixel(), { pixelRatio: 1 });
	});

	map.on("load", () => {
		if (!map) return;
		initializeMapContents(map);
		attachInteractions(map);
		styleLoaded = true;
		mapLoaded = true;
	});
};

// Theme reactivity — swap the basemap, then re-register places overlay on the
// resulting style.load event. Sprite cache is cleared so the icon is
// regenerated lazily on first render against the new style.
const applyTheme = (next: "light" | "dark" | undefined) => {
	if (!map) return;
	if (!styleLoaded) return;
	if (next === lastAppliedTheme) return;
	lastAppliedTheme = next;
	styleLoaded = false;
	spritePromises = new Map();
	const onStyleLoad = () => {
		if (!map) return;
		initializeMapContents(map);
		styleLoaded = true;
	};
	map.once("style.load", onStyleLoad);
	map.setStyle(styleUrlForTheme(next));
};

$: if (initialRenderComplete && places && !dataInitialized) {
	initializeMap();
} else if (places && dataInitialized && map && styleLoaded) {
	syncPlacesSource(map, places);
	// If the currently-open drawer's place was removed, close the drawer.
	if (
		selectedMerchantId !== null &&
		!places.some((p) => p.id === selectedMerchantId)
	) {
		closeDrawer();
	}
}

$: if (map && styleLoaded) {
	applyTheme($theme);
}
</script>

<section>
	<div class="relative">
		<div class="overflow-hidden rounded-3xl">
			<!-- prettier-ignore -->
			<div
				bind:this={mapContainer}
				class="z-10 h-[300px] rounded-3xl border border-gray-300 !bg-teal text-left md:h-[500px] dark:border-white/95 dark:!bg-[#202f33]"
			/>
			{#if !mapLoaded}
				<MapLoadingEmbed
					style="h-[300px] md:h-[500px] rounded-3xl border border-gray-300 dark:border-white/95"
				/>
			{/if}
		</div>
		<AreaMerchantDrawer merchantId={selectedMerchantId} onClose={closeDrawer} />
	</div>
</section>

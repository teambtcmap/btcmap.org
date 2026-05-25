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
import {
	ensureSprite,
	installPlaceholderHandler,
} from "$lib/map/maplibreSprites";
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

// Saved places are always rendered with the bitcoin icon — mirrors the legacy
// Leaflet MultiPlaceMap which hardcodes generateIcon(..., "currency_bitcoin").
const SAVED_PLACE_ICON = "currency_bitcoin";

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
	ensureSprite(m, SAVED_PLACE_ICON, false);
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
let destroyed = false;

onMount(() => {
	if (browser) {
		initialRenderComplete = true;
	}
});

onDestroy(() => {
	destroyed = true;
	map?.remove();
	map = undefined;
});

const initializeMap = async () => {
	if (dataInitialized) return;
	dataInitialized = true;

	const maplibre = await import("maplibre-gl");
	// Component may have been destroyed while the dynamic import was in
	// flight (fast navigation away). Bail before binding to a stale
	// container — otherwise we leak a Map instance that onDestroy can't
	// clean up because it already ran with `map` undefined.
	if (destroyed) return;

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
		fitBoundsOptions: { maxZoom: 15, linear: true },
	});
	map.addControl(geolocate, "top-right");

	installPlaceholderHandler(map);

	map.on("load", () => {
		if (!map) return;
		initializeMapContents(map);
		attachInteractions(map);
		styleLoaded = true;
		mapLoaded = true;
	});
};

// Theme reactivity — swap the basemap, then re-register places overlay on the
// resulting style.load event. The shared sprite cache evicts resolved promises
// on completion, so any sprites that didn't survive the style swap regenerate
// lazily on first render against the new style.
const applyTheme = (next: "light" | "dark" | undefined) => {
	if (!map) return;
	if (!styleLoaded) return;
	if (next === lastAppliedTheme) return;
	lastAppliedTheme = next;
	styleLoaded = false;
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

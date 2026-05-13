<script lang="ts">
import "maplibre-gl/dist/maplibre-gl.css";

import type {
	GeoJSONSource,
	Map as MapLibreMap,
	StyleSpecification,
} from "maplibre-gl";
import { onDestroy, onMount } from "svelte";

import {
	CLUSTERING_DISABLED_ZOOM,
	DEFAULT_MAP_LAT,
	DEFAULT_MAP_LNG,
	DEFAULT_MAP_ZOOM,
} from "$lib/constants";
import { places } from "$lib/store";
import type { Place } from "$lib/types";
import { isBoosted } from "$lib/utils";

type PlaceFeature = {
	type: "Feature";
	geometry: { type: "Point"; coordinates: [number, number] };
	properties: { id: number; boosted: boolean };
};

type PlaceFeatureCollection = {
	type: "FeatureCollection";
	features: PlaceFeature[];
};

let mapContainer: HTMLDivElement;
let map: MapLibreMap | undefined;
let styleLoaded = false;
let lastPlacesLength = -1;

const EMPTY_COLLECTION: PlaceFeatureCollection = {
	type: "FeatureCollection",
	features: [],
};

const buildFeatureCollection = (list: Place[]): PlaceFeatureCollection => ({
	type: "FeatureCollection",
	features: list
		.filter((p) => !p.deleted_at)
		.map((p) => ({
			type: "Feature",
			geometry: { type: "Point", coordinates: [p.lon, p.lat] },
			properties: { id: p.id, boosted: Boolean(isBoosted(p)) },
		})),
});

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

const syncPlacesToSource = (list: Place[]) => {
	if (!map || !styleLoaded) return;
	const source = map.getSource("places") as GeoJSONSource | undefined;
	if (!source) return;
	source.setData(buildFeatureCollection(list));
};

// Rebuild only when the count changes meaningfully (and always on first load),
// to avoid jank on incremental store updates with ~50k places worldwide.
$: if (map && styleLoaded && $places) {
	const len = $places.length;
	if (len !== lastPlacesLength) {
		lastPlacesLength = len;
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
				"icon-image": ["case", ["get", "boosted"], "pin-boosted", "pin"],
				"icon-size": 1,
				"icon-anchor": "bottom",
				"icon-allow-overlap": true,
				"icon-ignore-placement": true,
				// Keep pins upright as the map rotates/pitches.
				"icon-rotation-alignment": "viewport",
				"icon-pitch-alignment": "viewport",
			},
		});

		styleLoaded = true;
		lastPlacesLength = -1;
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

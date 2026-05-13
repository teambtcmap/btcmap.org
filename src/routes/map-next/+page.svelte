<script lang="ts">
import "maplibre-gl/dist/maplibre-gl.css";

import type { Map as MapLibreMap } from "maplibre-gl";
import { onDestroy, onMount } from "svelte";

import {
	DEFAULT_MAP_LAT,
	DEFAULT_MAP_LNG,
	DEFAULT_MAP_ZOOM,
} from "$lib/constants";

let mapContainer: HTMLDivElement;
let map: MapLibreMap | undefined;

onMount(async () => {
	const maplibre = await import("maplibre-gl");

	map = new maplibre.Map({
		container: mapContainer,
		// Minimal inline raster style — OSM tiles. Vector basemaps come in Phase 4.
		style: {
			version: 8,
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
		},
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

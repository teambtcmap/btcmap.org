<script lang="ts">
import "maplibre-gl/dist/maplibre-gl.css";

import type { Map as MapLibreMap } from "maplibre-gl";
import { onDestroy, onMount } from "svelte";

import { hasWebGL } from "$lib/map/webgl";
import { theme } from "$lib/theme";

import { browser } from "$app/environment";

// Lightweight, NON-interactive map preview used as the merchant hero
// backdrop. Deliberately has no controls, no sprites and no merchant
// layers — it exists purely to give a sense of place behind the identity
// overlay.
export let lat: number;
export let long: number;
let className = "";

export { className as class };

// Carto Positron / Dark Matter — clean, low-contrast basemaps that keep
// the merchant identity overlay legible behind the hero.
const STYLE_LIGHT =
	"https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const STYLE_DARK =
	"https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const styleUrlForTheme = (t: "light" | "dark"): string =>
	t === "dark" ? STYLE_DARK : STYLE_LIGHT;

let mapElement: HTMLDivElement;
let map: MapLibreMap | undefined;
let destroyed = false;
let unsupported = false;
let styleLoaded = false;
let lastTheme: "light" | "dark" | undefined;

const init = async () => {
	if (!hasWebGL()) {
		unsupported = true;
		return;
	}
	const maplibre = await import("maplibre-gl");
	if (destroyed) return;

	lastTheme = $theme;
	map = new maplibre.Map({
		container: mapElement,
		style: styleUrlForTheme($theme),
		center: [long, lat],
		zoom: 15,
		interactive: false,
		attributionControl: { compact: true },
	});
	map.on("style.load", () => {
		styleLoaded = true;
		collapseAttribution();
	});
};

// MapLibre's compact attribution still renders expanded on first paint.
// Collapse it so the hero defaults to just the "ⓘ" toggle, which keeps
// the map preview clean while leaving attribution one tap away.
const collapseAttribution = () => {
	mapElement
		?.querySelector(".maplibregl-ctrl-attrib.maplibregl-compact-show")
		?.classList.remove("maplibregl-compact-show");
};

onMount(() => {
	if (browser && typeof lat === "number" && typeof long === "number") {
		init();
	}
});

// Swap the basemap when the site theme changes, mirroring the full map.
$: if (map && styleLoaded && $theme !== lastTheme) {
	lastTheme = $theme;
	styleLoaded = false;
	map.once("style.load", () => {
		styleLoaded = true;
		collapseAttribution();
	});
	map.setStyle(styleUrlForTheme($theme));
}

// Follow the merchant when the coords change (e.g. param-only navigation),
// since the component instance is reused across /merchant/[id] params.
$: if (map && typeof lat === "number" && typeof long === "number") {
	map.setCenter([long, lat]);
}

onDestroy(() => {
	destroyed = true;
	map?.remove();
	map = undefined;
});
</script>

{#if unsupported}
	<div class="h-full w-full bg-teal dark:bg-[#202f33] {className}" />
{:else}
	<div bind:this={mapElement} class="h-full w-full {className}" aria-hidden="true" />
{/if}

<script lang="ts">
import "maplibre-gl/dist/maplibre-gl.css";

import type { Map as MapLibreMap } from "maplibre-gl";
import { onDestroy, onMount } from "svelte";

import { previewStyleForTheme } from "$lib/map/basemaps";
import type { BtcmapMapHandle } from "$lib/map/createMap";
import { createBtcmapMap } from "$lib/map/createMap";
import { theme } from "$lib/theme";

import { browser } from "$app/environment";

// Lightweight, NON-interactive map preview: the merchant hero backdrop and
// the add-location pin preview. Deliberately has no controls, no sprites
// and no merchant layers — it exists purely to give a sense of place under
// whatever the caller overlays (identity card, pin glyph).
export let lat: number;
export let long: number;
export let zoom = 15;
let className = "";

export { className as class };

let mapElement: HTMLDivElement;
let map: MapLibreMap | undefined;
let mapHandle: BtcmapMapHandle | undefined;
let destroyed = false;
let unsupported = false;
let styleLoaded = false;

const init = async () => {
	// Bring-up via the shared facade: Carto Positron / Dark Matter preview
	// pair as the theme styles, no controls, non-interactive — this map is
	// purely a hero backdrop.
	const outcome = await createBtcmapMap({
		container: mapElement,
		theme: $theme,
		styles: previewStyleForTheme,
		controls: false,
		mapOptions: {
			center: [long, lat],
			zoom,
			interactive: false,
		},
		isCancelled: () => destroyed,
		// Runs on every style (re)load — the swap machine re-collapses the
		// attribution the incoming style re-opens.
		registerOverlays: () => collapseAttribution(),
		onStyleReadyChange: (ready) => {
			styleLoaded = ready;
		},
		onFirstLoad: (m) => {
			// MapLibre re-opens the attribution <details> whenever it rebuilds
			// the credit text: _updateAttributions() (fired on every
			// sourcedata/styledata as tiles stream in) and resize both call
			// _updateCompact(), which sets the `open` attr again. Re-collapse
			// after each — our handlers are registered after MapLibre's
			// internal ones, so they win — with `idle` as a final guarantee
			// once loading settles.
			m.on("sourcedata", collapseAttribution);
			m.on("styledata", collapseAttribution);
			m.on("resize", collapseAttribution);
			m.on("idle", collapseAttribution);
		},
	});

	if (outcome.status === "unsupported") {
		unsupported = true;
		return;
	}
	if (outcome.status === "cancelled") return;
	if (destroyed) {
		outcome.handle.destroy();
		return;
	}
	mapHandle = outcome.handle;
	map = outcome.handle.map;
};

// MapLibre 5 renders attribution as a <details> and opens it by default
// (sets the `open` attribute + `maplibregl-compact-show`); it only
// minimizes on `drag`, which a non-interactive hero never fires. Force it
// closed so the hero shows just the "ⓘ" toggle, attribution one tap away.
const collapseAttribution = () => {
	const el = mapElement?.querySelector(".maplibregl-ctrl-attrib");
	if (!el) return;
	el.classList.remove("maplibregl-compact-show");
	el.removeAttribute("open");
};

onMount(() => {
	if (browser && typeof lat === "number" && typeof long === "number") {
		init();
	}
});

// Swap the basemap when the site theme changes — the facade handles
// change detection and re-runs the attribution collapse on style.load.
$: if (map && styleLoaded) {
	mapHandle?.setTheme($theme);
}

// Follow the coords when they change (e.g. param-only navigation), since
// the component instance is reused across /merchant/[id] params.
$: if (map && typeof lat === "number" && typeof long === "number") {
	map.setCenter([long, lat]);
}

onDestroy(() => {
	destroyed = true;
	mapHandle?.destroy();
	mapHandle = undefined;
	map = undefined;
});
</script>

{#if unsupported}
	<div class="h-full w-full bg-teal dark:bg-[#202f33] {className}"></div>
{:else}
	<div bind:this={mapElement} class="h-full w-full {className}" aria-hidden="true"></div>
{/if}

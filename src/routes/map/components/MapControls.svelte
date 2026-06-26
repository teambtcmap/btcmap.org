<script lang="ts">
import type { Map as MapLibreMap } from "maplibre-gl";
import { onDestroy, onMount } from "svelte";
import { get, writable } from "svelte/store";

import { trackEvent } from "$lib/analytics";
import {
	BASEMAP_STORAGE_KEY,
	type BasemapId,
	defaultBasemap,
	getStoredBasemap,
} from "$lib/map/basemaps";
import { HEATMAP_STORAGE_KEY } from "$lib/map/heatmap";
import type { VerifiedFilterYears } from "$lib/map/verifiedFilter";
import { getStoredVerifiedFilter } from "$lib/map/verifiedFilter";
import { theme } from "$lib/theme";

import MapMenuModal from "./MapMenuModal.svelte";
import MapToolsModal from "./MapToolsModal.svelte";
import {
	MapButtonControl,
	MENU_ICON_SVG,
	TUNE_ICON_SVG,
} from "../controls/MapButtonControl";

type BasemapEntry = { id: BasemapId; label: string };

// The map's top-right control surface: two MapLibre IControl triggers
// (☰ menu, ⇄ layers & filters) plus the two Svelte modals they open. Owns
// the modal state, persistence and analytics; the page passes the raw effect
// callbacks (which mutate the map / merchant store). Optional capabilities —
// /map wires them all; /communities/map mounts basemap-only.
export let map: MapLibreMap | undefined;
export let variant: "main" | "communities" = "main";
export let basemaps: BasemapEntry[];
export let applyBasemap: (id: BasemapId) => void;
export let applyVerifiedFilter:
	| ((years: VerifiedFilterYears) => void | Promise<void>)
	| null = null;
export let setHeatmapEnabled: ((enabled: boolean) => void) | null = null;
export let enableBoost = false;
export let enableGlobe = false;

let toolsModalOpen = false;
let menuModalOpen = false;
let selectedBasemap: BasemapId | undefined;
let selectedVerified: VerifiedFilterYears = null;
let heatmapOn = false;
let boostActive = false;
let globeOn = false;

// Lights the tools trigger's accent dot when a data-affecting toggle is on
// (verified filter / boost / heatmap), so a returning user sees the map is
// filtered without opening the panel. Globe is cosmetic, so it's excluded.
const toolsActive = writable(false);
$: toolsActive.set(selectedVerified != null || heatmapOn || boostActive);

let menuControl: MapButtonControl | undefined;
let toolsControl: MapButtonControl | undefined;
let registered = false;

const openToolsModal = () => {
	toolsModalOpen = true;
	trackEvent("layers_panel_open");
};
const openMenuModal = () => {
	menuModalOpen = true;
	trackEvent("nav_menu_open", { variant });
};
const onPickBasemap = (id: BasemapId) => {
	selectedBasemap = id;
	try {
		localStorage.setItem(BASEMAP_STORAGE_KEY, id);
	} catch {
		// localStorage unavailable (private mode); skip persistence.
	}
	// applyBasemap swaps the style via setStyle, which resets the projection
	// to the style default (mercator). Re-apply globe after the swap so it
	// survives a basemap change. Register before applyBasemap — raster styles
	// can fire style.load synchronously inside setStyle, so a later listener
	// would miss it.
	if (globeOn && map) {
		map.once("style.load", () => map?.setProjection({ type: "globe" }));
	}
	applyBasemap(id);
	trackEvent("layer_change", { layer: id });
};
const onPickVerified = async (years: VerifiedFilterYears) => {
	if (!applyVerifiedFilter) return;
	selectedVerified = years;
	trackEvent("verified_filter_change", {
		years: years == null ? "any" : String(years),
	});
	await applyVerifiedFilter(years);
};
const onToggleHeatmap = (enabled: boolean) => {
	if (!setHeatmapEnabled) return;
	heatmapOn = enabled;
	try {
		localStorage.setItem(HEATMAP_STORAGE_KEY, String(enabled));
	} catch {
		// localStorage unavailable (private mode); session-only toggle.
	}
	trackEvent("heatmap_layer_toggle", { enabled });
	setHeatmapEnabled(enabled);
};
const onToggleBoost = () => {
	trackEvent("boost_layer_toggle");
	const url = new URL(window.location.href);
	if (url.searchParams.has("boosts")) url.searchParams.delete("boosts");
	else url.searchParams.set("boosts", "true");
	window.location.search = url.search;
};
const onToggleGlobe = () => {
	if (!map) return;
	globeOn = !globeOn;
	map.setProjection({ type: globeOn ? "globe" : "mercator" });
	trackEvent("worldview_toggle", { enabled: globeOn });
};

onMount(() => {
	selectedBasemap = getStoredBasemap() ?? defaultBasemap(get(theme));
	if (applyVerifiedFilter) selectedVerified = getStoredVerifiedFilter();
	if (setHeatmapEnabled) {
		try {
			heatmapOn = localStorage.getItem(HEATMAP_STORAGE_KEY) === "true";
		} catch {
			// localStorage unavailable (private mode)
		}
	}
	boostActive =
		typeof window !== "undefined" &&
		new URLSearchParams(window.location.search).has("boosts");
});

// The triggers are MapLibre IControls, so register them once the map exists
// (the page assigns `map` after it instantiates MapLibre).
$: if (map && !registered) {
	registered = true;
	menuControl = new MapButtonControl({
		iconSvg: MENU_ICON_SVG,
		labelKey: "mapControls.menu",
		onClick: openMenuModal,
	});
	toolsControl = new MapButtonControl({
		iconSvg: TUNE_ICON_SVG,
		labelKey: "mapControls.layersAndFilters",
		onClick: openToolsModal,
		active: toolsActive,
	});
	map.addControl(menuControl, "top-right");
	map.addControl(toolsControl, "top-right");
}

onDestroy(() => {
	try {
		if (map && menuControl) map.removeControl(menuControl);
		if (map && toolsControl) map.removeControl(toolsControl);
	} catch {
		// map already torn down by the page
	}
});
</script>

<MapToolsModal
	bind:open={toolsModalOpen}
	{basemaps}
	currentBasemap={selectedBasemap}
	onSelectBasemap={onPickBasemap}
	currentVerified={selectedVerified}
	onSelectVerified={applyVerifiedFilter ? onPickVerified : null}
	{heatmapOn}
	onToggleHeatmap={setHeatmapEnabled ? onToggleHeatmap : null}
	{boostActive}
	onToggleBoost={enableBoost ? onToggleBoost : null}
	{globeOn}
	onToggleGlobe={enableGlobe ? onToggleGlobe : null}
/>

<MapMenuModal bind:open={menuModalOpen} {variant} />

import type { Map as MapLibreMap } from "maplibre-gl";

import { styleForBasemap } from "$lib/map/basemaps";
import { installPlaceholderHandler } from "$lib/map/maplibreSprites";
import { ensureRtlTextPlugin } from "$lib/map/rtl";
import { hasWebGL } from "$lib/map/webgl";

export type MapThemeName = "light" | "dark" | undefined;

// The embedded maps pin their two basemaps to the same styles the /map
// picker exposes — basemaps.ts stays the single source of truth for the URLs.
export const styleUrlForTheme = (t: MapThemeName) =>
	styleForBasemap(t === "dark" ? "ofm-dark" : "liberty");

export type BtcmapMapHandle = {
	map: MapLibreMap;
	// Swap the basemap for a theme change. No-ops while a previous swap's
	// style is still loading — the component's readiness reactive re-invokes
	// once it settles — and when the theme didn't actually change.
	setTheme: (next: MapThemeName) => void;
	destroy: () => void;
};

export type CreateBtcmapMapOutcome =
	| { status: "ready"; handle: BtcmapMapHandle }
	| { status: "unsupported" }
	| { status: "cancelled" };

// The shared bring-up for embedded maps (AreaMap, MultiPlaceMap): WebGL
// support check, dynamic maplibre import, RTL plugin, Map construction,
// navigation + geolocate controls, sprite placeholder handler, and the
// theme-swap state machine. Overlay content stays with the caller:
// registerOverlays re-runs after every style (re)load because setStyle()
// strips custom sprites, sources, and layers.
export const createBtcmapMap = async (opts: {
	container: HTMLElement;
	theme: MapThemeName;
	// Sprites + sources + layers + data. Runs on the initial load and again
	// after every theme swap's style.load.
	registerOverlays: (map: MapLibreMap) => void;
	// Runs once, after the first registerOverlays: camera + interactions.
	onFirstLoad?: (map: MapLibreMap) => void;
	// Style readiness — false while a swap's style is loading. Components
	// gate reactive source writes on this.
	onStyleReadyChange?: (ready: boolean) => void;
	// The dynamic import may outlive the component (fast navigation away);
	// return true to abandon initialization before a Map binds to the
	// container — otherwise we'd leak an instance the component's onDestroy
	// can't clean up because it already ran.
	isCancelled?: () => boolean;
}): Promise<CreateBtcmapMapOutcome> => {
	if (!hasWebGL()) return { status: "unsupported" };

	const maplibre = await import("maplibre-gl");
	ensureRtlTextPlugin(maplibre);
	if (opts.isCancelled?.()) return { status: "cancelled" };

	let appliedTheme = opts.theme;
	let ready = false;
	let disposed = false;

	const setReady = (value: boolean) => {
		ready = value;
		opts.onStyleReadyChange?.(value);
	};

	const map = new maplibre.Map({
		container: opts.container,
		style: styleUrlForTheme(opts.theme),
		maxZoom: 21,
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

	map.addControl(
		new maplibre.GeolocateControl({
			positionOptions: { enableHighAccuracy: true },
			trackUserLocation: true,
			showUserLocation: true,
			showAccuracyCircle: true,
			fitBoundsOptions: { maxZoom: 15, linear: true },
		}),
		"top-right",
	);

	// MapLibre logs an "image missing" warning whenever a symbol references
	// an icon id that hasn't been registered yet. Composite pin sprites
	// resolve async; registering a transparent stub for any missing id keeps
	// the console quiet and prevents flicker until the real sprite lands.
	installPlaceholderHandler(map);

	map.on("load", () => {
		if (disposed) return;
		opts.registerOverlays(map);
		opts.onFirstLoad?.(map);
		setReady(true);
	});

	const setTheme = (next: MapThemeName) => {
		if (disposed) return;
		if (!ready) return;
		if (next === appliedTheme) return;
		appliedTheme = next;
		setReady(false);
		map.once("style.load", () => {
			if (disposed) return;
			opts.registerOverlays(map);
			setReady(true);
		});
		map.setStyle(styleUrlForTheme(next));
	};

	const destroy = () => {
		if (disposed) return;
		disposed = true;
		map.remove();
	};

	return { status: "ready", handle: { map, setTheme, destroy } };
};

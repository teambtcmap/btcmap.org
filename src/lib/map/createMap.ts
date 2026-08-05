import type {
	Map as MapLibreMap,
	MapOptions,
	StyleSpecification,
} from "maplibre-gl";

import { styleForBasemap } from "$lib/map/basemaps";
import { installPlaceholderHandler } from "$lib/map/maplibreSprites";
import { ensureRtlTextPlugin } from "$lib/map/rtl";
import { hasWebGL } from "$lib/map/webgl";
import { ensureMapLibreWorkerUrl } from "$lib/map/worker";

export type MapThemeName = "light" | "dark" | undefined;

export type MapStyleInput = string | StyleSpecification;

// The embedded maps pin their two basemaps to the same styles the /map
// picker exposes — basemaps.ts stays the single source of truth for the URLs.
export const styleUrlForTheme = (t: MapThemeName) =>
	styleForBasemap(t === "dark" ? "ofm-dark" : "liberty");

export type BtcmapMapHandle = {
	map: MapLibreMap;
	// The imported maplibre namespace, for callers that construct Markers,
	// Popups, or controls of their own.
	maplibre: typeof import("maplibre-gl");
	// Swap to an arbitrary style: sets the style, waits for style.load, and
	// re-runs registerOverlays — one machine for theme swaps AND basemap
	// picks. The custom layers blink for the moment the swap takes (a
	// deliberate trade: the old transformStyle carryover kept them alive but
	// coupled every page to hand-maintained carry-lists). No-ops while a
	// previous swap's style is still loading.
	setStyle: (style: MapStyleInput) => void;
	// Theme sugar over setStyle: resolves the theme through the configured
	// style pair and no-ops when the theme didn't actually change. Inert in
	// explicit-style mode (the caller owns style selection there).
	setTheme: (next: MapThemeName) => void;
	destroy: () => void;
};

export type CreateBtcmapMapOutcome =
	| { status: "ready"; handle: BtcmapMapHandle }
	| { status: "unsupported" }
	| { status: "cancelled" };

// The shared bring-up for every map in the app: WebGL support check, dynamic
// maplibre import, worker URL + RTL plugin, Map construction, controls,
// sprite placeholder handler, and the style-swap state machine. Overlay
// content stays with the caller: registerOverlays re-runs after every style
// (re)load because setStyle strips custom sprites, sources, and layers.
//
// Style selection is one of two modes:
//   theme mode (default) — the facade picks the style from the theme (via
//     `styles`, defaulting to the liberty/ofm-dark pair) and setTheme swaps;
//   explicit-style mode (`style` passed) — the caller owns style selection
//     (the /map and /communities/map basemap pickers) and swaps via
//     handle.setStyle; setTheme is inert.
export const createBtcmapMap = async (opts: {
	container: HTMLElement;
	theme: MapThemeName;
	// Explicit initial style — enables explicit-style mode.
	style?: MapStyleInput;
	// Theme-mode style pair override (e.g. the merchant hero's preview
	// styles). Ignored in explicit-style mode.
	styles?: (theme: MapThemeName) => MapStyleInput;
	// Extra Map constructor options merged OVER the shared defaults
	// (center/zoom/bearing/pitch, interactive, attribution, …).
	mapOptions?: Partial<MapOptions>;
	// false skips the navigation + geolocate controls (static previews).
	controls?: boolean;
	// Fired when the built-in geolocate control resolves a position — the
	// control instance itself stays internal to the facade.
	onGeolocate?: (coords: { latitude: number; longitude: number }) => void;
	// Sprites + sources + layers + data. Runs on the initial load and again
	// after every style swap's style.load. May be async — first-load wiring
	// and the ready signal wait for it (sprite-before-layer ordering).
	registerOverlays: (map: MapLibreMap) => void | Promise<void>;
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
	ensureMapLibreWorkerUrl(maplibre);
	ensureRtlTextPlugin(maplibre);
	if (opts.isCancelled?.()) return { status: "cancelled" };

	// Normalize so undefined ≡ "light" (they resolve to the same style):
	// otherwise a caller that initializes with an unresolved theme and later
	// passes "light" would trigger a full setStyle round-trip for nothing.
	const normalizeTheme = (t: MapThemeName): "light" | "dark" =>
		t === "dark" ? "dark" : "light";

	const explicitStyle = opts.style !== undefined;
	const themedStyle = (t: MapThemeName): MapStyleInput =>
		opts.styles ? opts.styles(normalizeTheme(t)) : styleUrlForTheme(t);

	let appliedTheme = normalizeTheme(opts.theme);
	let ready = false;
	let disposed = false;

	const setReady = (value: boolean) => {
		ready = value;
		opts.onStyleReadyChange?.(value);
	};

	const map = new maplibre.Map({
		style: explicitStyle
			? (opts.style as MapStyleInput)
			: themedStyle(opts.theme),
		maxZoom: 21,
		dragRotate: true,
		touchZoomRotate: true,
		pitchWithRotate: false,
		attributionControl: { compact: true },
		...opts.mapOptions,
		container: opts.container,
	});

	if (opts.controls !== false) {
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
		if (opts.onGeolocate) {
			// v6's GeolocatePositionEvent exposes coords directly but is not
			// assignable to GeolocationPosition (no toJSON) — pass coords only.
			geolocate.on("geolocate", (e) => {
				opts.onGeolocate?.(e.coords);
			});
		}
	}

	// MapLibre logs an "image missing" warning whenever a symbol references
	// an icon id that hasn't been registered yet. Composite pin sprites
	// resolve async; registering a transparent stub for any missing id keeps
	// the console quiet and prevents flicker until the real sprite lands.
	installPlaceholderHandler(map);

	map.on("load", async () => {
		if (disposed) return;
		await opts.registerOverlays(map);
		if (disposed) return;
		opts.onFirstLoad?.(map);
		setReady(true);
	});

	const setStyle = (style: MapStyleInput) => {
		if (disposed) return;
		if (!ready) return;
		setReady(false);
		// Registered BEFORE setStyle on purpose: for inline (object) styles
		// like the OSM raster basemap, setStyle fires style.load SYNCHRONOUSLY
		// during the call, so a handler added afterwards would miss it.
		map.once("style.load", async () => {
			if (disposed) return;
			await opts.registerOverlays(map);
			if (disposed) return;
			setReady(true);
		});
		map.setStyle(style);
	};

	const setTheme = (next: MapThemeName) => {
		if (disposed || explicitStyle) return;
		if (!ready) return;
		const normalized = normalizeTheme(next);
		if (normalized === appliedTheme) return;
		appliedTheme = normalized;
		setStyle(themedStyle(normalized));
	};

	const destroy = () => {
		if (disposed) return;
		disposed = true;
		map.remove();
	};

	return {
		status: "ready",
		handle: { map, maplibre, setStyle, setTheme, destroy },
	};
};

<script lang="ts">
import "maplibre-gl/dist/maplibre-gl.css";

import type {
	Feature,
	FeatureCollection,
	GeoJSON,
	Geometry,
	Position,
} from "geojson";
import type {
	GeoJSONSource,
	MapLayerMouseEvent,
	Map as MapLibreMap,
} from "maplibre-gl";
import { onDestroy, onMount } from "svelte";
import tippy from "tippy.js";

import AreaMerchantDrawer from "$components/area/AreaMerchantDrawer.svelte";
import Icon from "$components/Icon.svelte";
import MapLoadingEmbed from "$components/MapLoadingEmbed.svelte";
import ShowTags from "$components/ShowTags.svelte";
import TaggingIssues from "$components/TaggingIssues.svelte";
import { GradeTable } from "$lib/constants";
import { theme } from "$lib/theme";
import type { Grade, Place } from "$lib/types";
import { getGrade, isBoosted } from "$lib/utils";

import { browser } from "$app/environment";

export let name: string;
export let geoJSON: GeoJSON;
export let filteredPlaces: Place[];

type PlaceFeature = {
	type: "Feature";
	geometry: { type: "Point"; coordinates: [number, number] };
	properties: {
		id: number;
		boosted: boolean;
		icon: string;
		comments: number;
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

const AREA_OUTLINE_COLOR = "#0E95AF";

// Local drawer state — mirrors the legacy Leaflet AreaMap component.
let selectedMerchantId: number | null = null;

const openDrawer = (id: number) => {
	selectedMerchantId = id;
};

const closeDrawer = () => {
	selectedMerchantId = null;
};

let total: number | undefined;
let upToDate: number | undefined;
let upToDatePercent: string | undefined;

let grade: Grade;

let gradeTooltip: HTMLButtonElement;

$: gradeTooltip &&
	tippy([gradeTooltip], {
		content: GradeTable,
		allowHTML: true,
	});

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
const PIN_FILL_BOOSTED = "#F7931A";

const spriteName = (icon: string, boosted: boolean): string =>
	`pin-${boosted ? "b" : "r"}-${icon}`;

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
	const key = spriteName(icon, boosted);
	if (m.hasImage(key)) return Promise.resolve();
	const existing = spritePromises.get(key);
	if (existing) return existing;
	const promise = (async () => {
		const inner = await fetchIconInnerSvg(icon);
		const composite = buildCompositeSvg(inner, boosted);
		const img = await loadSvgImage(composite);
		if (!m.hasImage(key)) m.addImage(key, img, { pixelRatio: 1 });
		m.triggerRepaint();
	})();
	spritePromises.set(key, promise);
	promise.catch(() => spritePromises.delete(key));
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

const loadCommentBadgeSprite = (m: MapLibreMap): void => {
	if (m.hasImage("comment-badge-bg")) return;
	const canvas = document.createElement("canvas");
	canvas.width = 16;
	canvas.height = 16;
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	ctx.fillStyle = "#16A34A";
	ctx.beginPath();
	ctx.arc(8, 8, 8, 0, Math.PI * 2);
	ctx.fill();
	m.addImage("comment-badge-bg", ctx.getImageData(0, 0, 16, 16), {
		pixelRatio: 1,
	});
};

// 1×1 transparent placeholder so styleimagemissing doesn't spam warnings before
// composite sprites resolve. Each missing icon name registers the same blank
// bitmap; once the real sprite is added via addImage(), it replaces this stub.
const transparentPixel = (): ImageData => {
	const canvas = document.createElement("canvas");
	canvas.width = 1;
	canvas.height = 1;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		// Fallback: synthesize empty ImageData manually if 2d context is unavailable.
		return new ImageData(new Uint8ClampedArray([0, 0, 0, 0]), 1, 1);
	}
	return ctx.getImageData(0, 0, 1, 1);
};

const buildFeatureCollection = (list: Place[]): PlaceFeatureCollection => ({
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
			},
		})),
});

// Walk every coordinate in any GeoJSON object and reduce to [minX, minY, maxX, maxY].
// Inlined instead of pulling in @turf/bbox — the project doesn't ship it.
const computeBbox = (g: GeoJSON): [number, number, number, number] | null => {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	let found = false;
	const visitPosition = (pos: Position) => {
		const [x, y] = pos;
		if (typeof x !== "number" || typeof y !== "number") return;
		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
		found = true;
	};
	const visitCoords = (coords: unknown) => {
		if (!Array.isArray(coords)) return;
		if (coords.length > 0 && typeof coords[0] === "number") {
			visitPosition(coords as Position);
			return;
		}
		for (const c of coords) visitCoords(c);
	};
	const visitGeometry = (geom: Geometry) => {
		if (geom.type === "GeometryCollection") {
			for (const sub of geom.geometries) visitGeometry(sub);
		} else {
			visitCoords((geom as { coordinates: unknown }).coordinates);
		}
	};
	const visit = (input: GeoJSON) => {
		if (input.type === "FeatureCollection") {
			for (const f of (input as FeatureCollection).features) {
				if (f.geometry) visitGeometry(f.geometry);
			}
		} else if (input.type === "Feature") {
			const f = input as Feature;
			if (f.geometry) visitGeometry(f.geometry);
		} else {
			visitGeometry(input as Geometry);
		}
	};
	visit(g);
	if (!found) return null;
	return [minX, minY, maxX, maxY];
};

// Register the area polygon source + outline layer. Re-runs on every style
// reload so a theme swap doesn't strip the overlay.
const addAreaLayer = (m: MapLibreMap) => {
	if (!m.getSource("area")) {
		m.addSource("area", {
			type: "geojson",
			data: geoJSON,
		});
	}
	if (!m.getLayer("area-outline")) {
		m.addLayer({
			id: "area-outline",
			type: "line",
			source: "area",
			paint: {
				"line-color": AREA_OUTLINE_COLOR,
				"line-width": 2,
			},
		});
	}
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
				// Defensive coalesce — guards against any null icon value
				// surfacing as the "Expected number, found null" tile-compile
				// error we hit in /map-next when clustering met null props.
				"icon-image": [
					"concat",
					"pin-",
					["case", ["coalesce", ["get", "boosted"], false], "b", "r"],
					"-",
					["coalesce", ["get", "icon"], "question_mark"],
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

	if (!m.getLayer("comment-badge")) {
		m.addLayer({
			id: "comment-badge",
			type: "symbol",
			source: "places",
			filter: [">", ["coalesce", ["get", "comments"], 0], 0],
			layout: {
				"icon-image": "comment-badge-bg",
				"icon-size": 1,
				"icon-allow-overlap": true,
				"icon-ignore-placement": true,
				"icon-rotation-alignment": "viewport",
				"icon-pitch-alignment": "viewport",
				"icon-offset": [10, -36],
			},
		});
	}

	if (!m.getLayer("comment-badge-count")) {
		m.addLayer({
			id: "comment-badge-count",
			type: "symbol",
			source: "places",
			filter: [">", ["coalesce", ["get", "comments"], 0], 0],
			layout: {
				"text-field": ["to-string", ["coalesce", ["get", "comments"], 0]],
				"text-font": ["Noto Sans Bold"],
				"text-size": 11,
				"text-allow-overlap": true,
				"text-ignore-placement": true,
				"text-rotation-alignment": "viewport",
				"text-pitch-alignment": "viewport",
				"text-offset": [10 / 11, -36 / 11],
			},
			paint: {
				"text-color": "#fff",
			},
		});
	}
};

const syncPlacesSource = (m: MapLibreMap, list: Place[]) => {
	const source = m.getSource("places") as GeoJSONSource | undefined;
	if (!source) return;
	source.setData(buildFeatureCollection(list));
	ensureSpritesForPlaces(m, list);
};

// Register sprites + sources + layers + interaction handlers once per style.
// Called from both the initial `load` event and from subsequent `style.load`
// events fired after `setStyle()` on theme change.
const initializeMapContents = (m: MapLibreMap) => {
	loadCommentBadgeSprite(m);
	addAreaLayer(m);
	addPlacesLayers(m);
	syncPlacesSource(m, filteredPlaces);

	const bbox = computeBbox(geoJSON);
	if (bbox) {
		m.fitBounds(
			[
				[bbox[0], bbox[1]],
				[bbox[2], bbox[3]],
			],
			{ padding: 40, animate: false },
		);
	}
};

const handleMarkerClick = (e: MapLayerMouseEvent) => {
	const feature = e.features?.[0];
	const placeId = feature?.properties?.id;
	if (typeof placeId !== "number") return;
	openDrawer(placeId);
	// Stop the click from bubbling to the map-level handler that closes the drawer.
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
	});
	map.addControl(geolocate, "top-right");

	// MapLibre logs a "image missing" warning whenever a symbol references an
	// icon id that hasn't been registered yet. Composite pin sprites resolve
	// async; registering a transparent stub for any missing id keeps the
	// console quiet and prevents flicker until the real sprite lands.
	map.on("styleimagemissing", (event) => {
		if (!map) return;
		const id = event.id;
		if (!id || map.hasImage(id)) return;
		map.addImage(id, transparentPixel(), { pixelRatio: 1 });
	});

	// First load — register everything and mark mapLoaded once stable.
	map.on("load", () => {
		if (!map) return;
		initializeMapContents(map);
		attachInteractions(map);
		styleLoaded = true;
		mapLoaded = true;

		// Compute area grade from the rendered place set. The legacy component
		// treated every place in `filteredPlaces` as up-to-date (the parent
		// AreaPage already filters by verification), so mirror that here.
		total = filteredPlaces.length;
		upToDate = filteredPlaces.length;
		upToDatePercent = upToDate ? (upToDate / (total / 100)).toFixed(0) : "0";
		grade = getGrade(Number(upToDatePercent));
	});
};

// Theme reactivity — swap the basemap, then re-register area + places overlays
// on the resulting style.load event. Sprite cache is cleared so every icon is
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

$: if (initialRenderComplete && geoJSON && filteredPlaces && !dataInitialized) {
	initializeMap();
}

$: if (map && styleLoaded) {
	applyTheme($theme);
}
</script>

<section id="map-section">
	<!-- prettier-ignore -->
	<h3
		class="rounded-t-3xl border border-b-0 border-gray-300 p-5 text-center text-lg font-semibold text-primary md:text-left dark:border-white/95 dark:bg-white/10 dark:text-white"
	>
		{name || 'BTC Map Area'} Map
		<div class="flex items-center space-x-1 text-link">
			{#if dataInitialized && mapLoaded}
				<div class="flex items-center space-x-1">
					{#each Array(grade) as _, index (index)}
						<Icon type="fa" icon="star" w="16" h="16" />
					{/each}
				</div>

				<div class="flex items-center space-x-1">
					{#each Array(5 - grade) as _, index (index)}
						<Icon type="fa" icon="star" w="16" h="16" class="opacity-25" />
					{/each}
				</div>
			{:else}
				<div class="flex items-center space-x-1">
					{#each Array(5) as _, index (index)}
						<Icon type="fa" icon="star" w="16" h="16" class="animate-pulse text-link/50" />
					{/each}
				</div>
			{/if}

			<button bind:this={gradeTooltip}>
				<Icon type="fa" icon="circle-info" w="14" h="14" class="text-sm" />
			</button>
		</div>
	</h3>

	<div class="relative">
		<div class="overflow-hidden rounded-b-3xl">
			<!-- prettier-ignore -->
			<div
				bind:this={mapContainer}
				class="z-10 h-[300px] rounded-b-3xl border border-gray-300 !bg-teal text-left md:h-[600px] dark:border-white/95 dark:!bg-[#202f33]"
			/>
			{#if !mapLoaded}
				<MapLoadingEmbed
					style="h-[300px] md:h-[600px] rounded-b-3xl border border-gray-300 dark:border-white/95"
				/>
			{/if}
		</div>
		<AreaMerchantDrawer merchantId={selectedMerchantId} onClose={closeDrawer} />
	</div>

	<ShowTags />
	<TaggingIssues />
</section>

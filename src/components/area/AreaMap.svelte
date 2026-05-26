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
import { CLUSTERING_DISABLED_ZOOM, GradeTable } from "$lib/constants";
import {
	ensureSpritesForPlaces,
	installPlaceholderHandler,
} from "$lib/map/maplibreSprites";
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
// Track last-applied props by reference so the area-change reactive only
// fires on genuine prop turnover, not on theme-swap styleLoaded toggles.
let lastAppliedGeoJSON: GeoJSON | undefined;
let lastAppliedFilteredPlaces: Place[] | undefined;

const loadCommentBadgeSprite = (m: MapLibreMap): void => {
	if (m.hasImage("comment-badge-bg")) return;
	// 2× rasterization for crispness on retina/phone DPRs — see /map's
	// equivalent for rationale.
	const SIZE = 16;
	const SCALE = 2;
	const canvas = document.createElement("canvas");
	canvas.width = SIZE * SCALE;
	canvas.height = SIZE * SCALE;
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	ctx.fillStyle = "#16A34A";
	ctx.beginPath();
	ctx.arc(
		(SIZE * SCALE) / 2,
		(SIZE * SCALE) / 2,
		(SIZE * SCALE) / 2,
		0,
		Math.PI * 2,
	);
	ctx.fill();
	m.addImage(
		"comment-badge-bg",
		ctx.getImageData(0, 0, SIZE * SCALE, SIZE * SCALE),
		{ pixelRatio: SCALE },
	);
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
// reload so a theme swap doesn't strip the overlay. When the source already
// exists, setData updates its geometry — this is the AreaPage navigation
// path (e.g. /community/lugano → /community/zurich reuses this component,
// see AreaPage.svelte:288-307).
const addAreaLayer = (m: MapLibreMap) => {
	const existing = m.getSource("area") as GeoJSONSource | undefined;
	if (existing) {
		existing.setData(geoJSON);
	} else {
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
			// Source-side clustering. Dense communities (cities with hundreds
			// of merchants) otherwise render every pin individually — both
			// visually noisy at low zoom and a render-perf hit. clusterMaxZoom
			// matches /map: above CLUSTERING_DISABLED_ZOOM (17) all points
			// render unclustered.
			cluster: true,
			clusterRadius: 80,
			clusterMaxZoom: CLUSTERING_DISABLED_ZOOM - 1,
		});
	}

	if (!m.getLayer("cluster-discs")) {
		m.addLayer({
			id: "cluster-discs",
			type: "circle",
			source: "places",
			filter: ["has", "point_count"],
			paint: {
				"circle-color": [
					"step",
					["get", "point_count"],
					"#22c55e", // green-500 (small)
					25,
					"#eab308", // yellow-500
					100,
					"#f97316", // orange-500 (large)
				],
				"circle-radius": ["step", ["get", "point_count"], 16, 25, 22, 100, 28],
				"circle-stroke-width": 2,
				"circle-stroke-color": "rgba(255, 255, 255, 0.85)",
				"circle-opacity": 0.85,
			},
		});
	}

	if (!m.getLayer("cluster-count")) {
		m.addLayer({
			id: "cluster-count",
			type: "symbol",
			source: "places",
			filter: ["has", "point_count"],
			layout: {
				"text-field": ["get", "point_count_abbreviated"],
				"text-font": ["Noto Sans Bold"],
				"text-size": 12,
				"text-allow-overlap": true,
				"text-ignore-placement": true,
			},
			paint: {
				"text-color": "#000",
			},
		});
	}

	if (!m.getLayer("unclustered-point")) {
		m.addLayer({
			id: "unclustered-point",
			type: "symbol",
			source: "places",
			filter: ["!", ["has", "point_count"]],
			layout: {
				// Defensive coalesce — guards against any null icon value
				// surfacing as the "Expected number, found null" tile-compile
				// error we previously hit when clustering met null props.
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
			filter: [
				"all",
				["!", ["has", "point_count"]],
				[">", ["coalesce", ["get", "comments"], 0], 0],
			],
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
			filter: [
				"all",
				["!", ["has", "point_count"]],
				[">", ["coalesce", ["get", "comments"], 0], 0],
			],
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
// events fired after `setStyle()` on theme change. Camera placement is
// intentionally NOT done here — see fitToArea below; theme swaps must
// preserve the user's pan/zoom.
const initializeMapContents = (m: MapLibreMap) => {
	loadCommentBadgeSprite(m);
	addAreaLayer(m);
	addPlacesLayers(m);
	syncPlacesSource(m, filteredPlaces);
};

const fitToArea = (m: MapLibreMap, animate = false) => {
	const bbox = computeBbox(geoJSON);
	if (!bbox) return;
	m.fitBounds(
		[
			[bbox[0], bbox[1]],
			[bbox[2], bbox[3]],
		],
		{ padding: 40, animate, duration: animate ? 300 : 0 },
	);
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

	// Cluster click → zoom into the cluster's expansionZoom (drills through
	// the cluster tree until points unclumped).
	m.on("click", "cluster-discs", async (e: MapLayerMouseEvent) => {
		const feature = e.features?.[0];
		if (!feature) return;
		const clusterId = feature.properties?.cluster_id;
		if (typeof clusterId !== "number") return;
		const source = m.getSource("places") as GeoJSONSource | undefined;
		if (!source) return;
		try {
			const zoom = await source.getClusterExpansionZoom(clusterId);
			const geom = feature.geometry as unknown as {
				coordinates: [number, number];
			};
			m.easeTo({ center: geom.coordinates, zoom, duration: 300 });
		} catch (err) {
			console.error("AreaMap cluster expansion failed", err);
		}
		e.originalEvent?.stopPropagation?.();
	});
	m.on("mouseenter", "cluster-discs", setPointerCursor);
	m.on("mouseleave", "cluster-discs", resetCursor);

	// Bare map click → close any open drawer (mirrors legacy Leaflet behavior).
	m.on("click", (e: MapLayerMouseEvent) => {
		if (!map) return;
		const hits = map.queryRenderedFeatures(e.point, {
			layers: ["unclustered-point", "cluster-discs"],
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

	// MapLibre logs a "image missing" warning whenever a symbol references an
	// icon id that hasn't been registered yet. Composite pin sprites resolve
	// async; registering a transparent stub for any missing id keeps the
	// console quiet and prevents flicker until the real sprite lands.
	installPlaceholderHandler(map);

	// First load — register everything and mark mapLoaded once stable.
	map.on("load", () => {
		if (!map) return;
		initializeMapContents(map);
		fitToArea(map);
		attachInteractions(map);
		styleLoaded = true;
		mapLoaded = true;
		lastAppliedGeoJSON = geoJSON;
		lastAppliedFilteredPlaces = filteredPlaces;

		updateAreaGrade();
	});
};

// Compute area grade from the rendered place set. The legacy component
// treated every place in `filteredPlaces` as up-to-date (the parent
// AreaPage already filters by verification), so mirror that here.
const updateAreaGrade = () => {
	total = filteredPlaces.length;
	upToDate = filteredPlaces.length;
	upToDatePercent = upToDate ? (upToDate / (total / 100)).toFixed(0) : "0";
	grade = getGrade(Number(upToDatePercent));
};

// Theme reactivity — swap the basemap, then re-register area + places overlays
// on the resulting style.load event. The shared sprite cache evicts resolved
// promises on completion, so any sprites that didn't survive the style swap
// regenerate lazily on first render against the new style.
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

$: if (initialRenderComplete && geoJSON && filteredPlaces && !dataInitialized) {
	initializeMap();
}

// AreaPage reuses this AreaMap instance across community-to-community
// (and country-to-country) navigation. When the user clicks through to
// another area, geoJSON and filteredPlaces change by reference but
// `dataInitialized` stays true, so initializeMap doesn't re-run. Without
// this reactive the previous area's outline + pins would persist over
// the new area's coordinates.
//
// Compare references (not identity-equality) so that theme-swap-driven
// styleLoaded toggles don't trigger spurious rebuilds — only true prop
// changes do.
$: if (
	map &&
	styleLoaded &&
	dataInitialized &&
	(geoJSON !== lastAppliedGeoJSON ||
		filteredPlaces !== lastAppliedFilteredPlaces)
) {
	lastAppliedGeoJSON = geoJSON;
	lastAppliedFilteredPlaces = filteredPlaces;
	const areaSource = map.getSource("area") as GeoJSONSource | undefined;
	areaSource?.setData(geoJSON);
	syncPlacesSource(map, filteredPlaces);
	// Drawer pinned to a merchant that the new area doesn't contain →
	// close it so the user isn't staring at details for a place that's
	// no longer on the map. MultiPlaceMap has the same guard.
	if (
		selectedMerchantId !== null &&
		!filteredPlaces.some((p) => p.id === selectedMerchantId)
	) {
		closeDrawer();
	}
	fitToArea(map, true);
	updateAreaGrade();
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

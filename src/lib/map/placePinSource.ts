import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";

import { CLUSTERING_DISABLED_ZOOM, LABEL_VISIBLE_ZOOM } from "$lib/constants";
import {
	routePlacesByBoostAndZoom,
	shouldClusterBoostedAtZoom,
} from "$lib/map/boostedClustering";
import { HEATMAP_STORAGE_KEY } from "$lib/map/heatmap";
import type { PinVariant } from "$lib/map/maplibreSprites";
import {
	addRealImage,
	ensureCommentBadgeSprite,
	ensureSpritesForPlaces,
	hasRealImage,
	loadSvgImage,
	pinIconImageExpression,
	pinVariantFor,
} from "$lib/map/maplibreSprites";
import type { DerivedIssueCode } from "$lib/placeIssues";
import type { Place } from "$lib/types";
import { isBoosted } from "$lib/utils";

export type PlaceFeature = {
	type: "Feature";
	geometry: { type: "Point"; coordinates: [number, number] };
	properties: {
		id: number;
		boosted: boolean;
		icon: string;
		// Sprite body-color variant (see pinVariantFor): boost state normally,
		// the dominant selected issue category in ?issues mode.
		variant: PinVariant;
		comments: number;
		saved: boolean;
		name: string;
	};
};

export type PlaceFeatureCollection = {
	type: "FeatureCollection";
	features: PlaceFeature[];
};

const EMPTY_COLLECTION: PlaceFeatureCollection = {
	type: "FeatureCollection",
	features: [],
};

// All point/cluster/badge/label layers that the heatmap conceals while
// active below CLUSTERING_DISABLED_ZOOM (17).  At zoom 17+ the heatmap
// layer naturally disappears (its maxzoom), so these layers are revealed
// again without the user having to toggle heatmap off.
const HEATMAP_HIDDEN_LAYER_IDS = [
	"clusters-outer",
	"clusters-inner",
	"cluster-count",
	"clusters-hit",
	"unclustered-point",
	"boosted-point",
	"comment-badge",
	"comment-badge-count",
	"saved-badge",
	"place-label",
	"boosted-comment-badge",
	"boosted-comment-badge-count",
	"boosted-saved-badge",
	"boosted-place-label",
];

// Tailwind `text-link` color (tailwind.config.js → colors.link).
const LINK_COLOR = "#0099AF";

// Composite saved-badge SVG. Outer SVG is rasterized at 2× its declared
// dimensions (viewBox stays the same) and registered with pixelRatio: 2
// so it draws crisp at the same logical 16×16 — same trick as
// PIN_RENDER_SCALE for the main pin sprite.
const SAVED_BADGE_SCALE = 2;
const buildSavedBadgeSvg = (bookmarkSvg: string): string => {
	const w = 16 * SAVED_BADGE_SCALE;
	const h = 16 * SAVED_BADGE_SCALE;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#fff" stroke="${LINK_COLOR}" stroke-width="1"/><g transform="translate(3, 3)">${bookmarkSvg}</g></svg>`;
};

// Near-invisible circular hit-target sprite used as the icon for the
// symbol cluster layer that spiderfy hooks into. The visible cluster discs
// render as circle layers (not symbols), so this symbol layer exists purely
// so the spiderfy library can register click handlers targeting it. 1/255
// alpha keeps pixels effectively invisible while ensuring
// queryRenderedFeatures registers hits on the icon footprint.
const loadClusterHitSprite = async (m: MapLibreMap): Promise<void> => {
	// Gate on the REAL registration, not hasImage(): the styleimagemissing
	// placeholder can stub this id if a layer renders before/without the real
	// sprite, and a hasImage() gate would then block every retry.
	if (hasRealImage(m, "cluster-hit")) return;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="rgba(0,0,0,0.004)"/></svg>`;
	const img = await loadSvgImage(svg);
	if (!hasRealImage(m, "cluster-hit"))
		addRealImage(m, "cluster-hit", img, { pixelRatio: 1 });
};

const loadSavedBadgeSprite = async (m: MapLibreMap): Promise<void> => {
	if (hasRealImage(m, "saved-badge")) return;
	const encodedColor = encodeURIComponent(LINK_COLOR);
	const url = `https://api.iconify.design/ic/baseline-bookmark-added.svg?color=${encodedColor}&width=10&height=10`;
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`saved-badge bookmark fetch failed: ${res.status} ${url}`);
	}
	const bookmarkSvg = await res.text();
	const composite = buildSavedBadgeSvg(bookmarkSvg);
	const img = await loadSvgImage(composite);
	if (!hasRealImage(m, "saved-badge"))
		addRealImage(m, "saved-badge", img, { pixelRatio: SAVED_BADGE_SCALE });
	m.triggerRepaint();
};

export type PlacePinSourceDeps = {
	// Snapshots read once per feature-collection build — saved state and
	// enriched names arrive lazily and are re-read on every render.
	getSavedIds: () => Set<number>;
	getEnrichedCache: () => Map<number, Place>;
	getDisplayLang: () => string;
	// ?issues-mode pin coloring: the selected categories once the readiness
	// gate has passed, null otherwise (mode off, search exemption, or dates
	// not yet enriched). Snapshot per render like the other deps.
	getIssueCodes?: () => ReadonlySet<DerivedIssueCode> | null;
	// Fired after each render with the rendered count. The /map page uses it
	// for the loading-screen gate and the e2e __mapPlacesCount hook.
	onRendered?: (count: number) => void;
};

export type PlacePinSource = ReturnType<typeof createPlacePinSource>;

// The pin/cluster/badge/label/heatmap rendering facade for the main /map.
// Owns: the three GeoJSON sources and fifteen layers, the badge sprites, the
// Place → feature-collection build (with lazy name resolution), the
// boosted-routing render path, the zoom-boundary re-sync, and heatmap
// visibility. Does NOT own: interactions, spiderfy, camera, label palette,
// or any visibility policy — callers must pass the already-filtered list
// (selectVisiblePlaces upstream) and render() renders exactly what it gets.
export const createPlacePinSource = (deps: PlacePinSourceDeps) => {
	// Last place list fed to the sources, kept so the boosted-clustering
	// boundary re-sync (on zoom crossing BOOSTED_CLUSTERING_MAX_ZOOM) can
	// rebuild without a $places change. `boostedAreClustered` mirrors the
	// routing decision of the most recent render so the moveend handler only
	// re-syncs when it actually flips.
	let lastSyncedList: Place[] = [];
	let boostedAreClustered = false;

	// Merchant-density heatmap on/off. Off by default unless the user
	// previously enabled it (persisted in localStorage by the toggle control).
	let heatmapEnabled = false;
	if (typeof window !== "undefined") {
		try {
			heatmapEnabled = localStorage.getItem(HEATMAP_STORAGE_KEY) === "true";
		} catch {
			// localStorage may be unavailable (private mode)
		}
	}

	const buildFeatureCollection = (list: Place[]): PlaceFeatureCollection => {
		const saved = deps.getSavedIds();
		// Snapshot the enriched cache once per build — names arrive lazily as
		// the viewport-bound /v4/places/search fetch resolves.
		const enrichedCache = deps.getEnrichedCache();
		const displayLang = deps.getDisplayLang();
		const issueCodes = deps.getIssueCodes?.() ?? null;
		const resolveName = (p: Place): string => {
			const enriched = enrichedCache.get(p.id);
			// Priority: enriched localized name → enriched plain name →
			// $places localized name → $places plain name → OSM amenity fallback.
			return (
				enriched?.localized_name?.[displayLang] ??
				enriched?.name ??
				p.localized_name?.[displayLang] ??
				p.name ??
				p["osm:amenity"] ??
				""
			);
		};
		return {
			type: "FeatureCollection",
			features: list.map((p) => ({
				type: "Feature",
				geometry: { type: "Point", coordinates: [p.lon, p.lat] },
				properties: {
					id: p.id,
					// Per-place so a boosted marker folded into the clustered source
					// at low zoom still renders its orange pin when it sits
					// unclustered.
					boosted: !!isBoosted(p),
					icon: p.icon ?? "question_mark",
					variant: pinVariantFor(p, issueCodes),
					comments: p.comments ?? 0,
					saved: saved.has(p.id),
					name: resolveName(p),
				},
			})),
		};
	};

	// Badge + cluster-hit sprites. The saved-badge fetch goes to a
	// third-party CDN and must NOT block or fail map init — a transient
	// Iconify outage just degrades the saved-state badge. All loaders are
	// hasImage-guarded, so re-running after a basemap swap is a cheap no-op
	// on the normal (style-diff) path.
	const loadSprites = async (map: MapLibreMap): Promise<void> => {
		await Promise.all([
			loadSavedBadgeSprite(map).catch((err) => {
				console.warn("Saved-badge sprite failed to load:", err);
			}),
			ensureCommentBadgeSprite(map),
			loadClusterHitSprite(map).catch((err) => {
				console.warn("Cluster-hit sprite failed to load:", err);
			}),
		]);
	};

	const install = (map: MapLibreMap): void => {
		map.addSource("places", {
			type: "geojson",
			data: EMPTY_COLLECTION,
			cluster: true,
			clusterRadius: 80,
			// CLUSTERING_DISABLED_ZOOM is 17; clusterMaxZoom=16 means at z17+ all points unclustered.
			clusterMaxZoom: CLUSTERING_DISABLED_ZOOM - 1,
		});

		// Separate non-clustered source for boosted places. Above
		// BOOSTED_CLUSTERING_MAX_ZOOM, render() routes boosted features here so
		// they stay visually prominent above cluster discs and never get
		// absorbed into a cluster icon. At/below that zoom they're routed into
		// the clustered `places` source instead (see $lib/map/boostedClustering)
		// — the MapLibre analogue of the legacy /map's dedicated boostedLayer +
		// BOOSTED_CLUSTERING_MAX_ZOOM swap.
		map.addSource("places-boosted", {
			type: "geojson",
			data: EMPTY_COLLECTION,
		});

		// Non-clustered source backing the merchant-density heatmap.
		// Heatmap layers read raw point features, so they can't share the
		// clustered `places` source — this dedicated source always carries
		// the full unclustered list (see render). Visibility is toggled via
		// the tools panel; off by default.
		map.addSource("places-heatmap", {
			type: "geojson",
			data: EMPTY_COLLECTION,
		});

		// Merchant-density heatmap. Weight is uniform (1) so the gradient
		// reflects pure point density. Radius and intensity scale up with
		// zoom so the halo widens as you zoom out to a city/region view and
		// tightens as pins take over. Opacity stays at full strength through
		// zoom 14 and fades to zero from zoom 14→17 so the heatmap hands off
		// cleanly to the individual pins at CLUSTERING_DISABLED_ZOOM.
		map.addLayer({
			id: "place-heatmap",
			type: "heatmap",
			source: "places-heatmap",
			maxzoom: CLUSTERING_DISABLED_ZOOM,
			layout: { visibility: "none" },
			paint: {
				"heatmap-weight": 1,
				"heatmap-intensity": [
					"interpolate",
					["linear"],
					["zoom"],
					0,
					0.5,
					CLUSTERING_DISABLED_ZOOM,
					3,
				],
				"heatmap-color": [
					"interpolate",
					["linear"],
					["heatmap-density"],
					0,
					"rgba(0, 0, 255, 0)",
					0.2,
					"#67e8f9", // cyan-300
					0.4,
					"#22d3ee", // cyan-400
					0.6,
					"#facc15", // yellow-400
					0.8,
					"#facc15", // yellow-400 — yellow holds longer
					1.0,
					"#f97316", // orange-500
					1.2,
					"#ea580c", // orange-600
					1.5,
					"#dc2626", // red-600 — red only at extreme density
				],
				"heatmap-radius": [
					"interpolate",
					["linear"],
					["zoom"],
					0,
					3,
					CLUSTERING_DISABLED_ZOOM,
					30,
				],
				"heatmap-opacity": [
					"interpolate",
					["linear"],
					["zoom"],
					14,
					0.9,
					CLUSTERING_DISABLED_ZOOM,
					0,
				],
			},
		});

		// Translucent outer ring — green/yellow/orange tiers by point_count
		// at 0.6 alpha.
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
				"text-font": ["Noto Sans Bold"],
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

		// Symbol layer for unclustered points; boosted places use the orange
		// pin. Drawn last so pins sit on top of cluster discs at boundaries.
		map.addLayer({
			id: "unclustered-point",
			type: "symbol",
			source: "places",
			filter: ["!", ["has", "point_count"]],
			layout: {
				// Look up composite sprite (pin shape + baked category icon).
				// Until the icon's sprite finishes loading, MapLibre logs a
				// warning and skips the symbol; pins appear as their composite
				// sprites resolve. The variant property carries boost state and
				// the ?issues category color (see pinVariantFor).
				"icon-image": pinIconImageExpression("r"),
				"icon-size": 1,
				"icon-anchor": "bottom",
				"icon-allow-overlap": true,
				"icon-ignore-placement": true,
				// Keep pins upright as the map rotates/pitches.
				"icon-rotation-alignment": "viewport",
				"icon-pitch-alignment": "viewport",
			},
		});

		// Boosted pins — drawn from the separate non-clustered source on top
		// of cluster discs so a paid boost is always visually prominent.
		map.addLayer({
			id: "boosted-point",
			type: "symbol",
			source: "places-boosted",
			layout: {
				// Boosted pins take the issue-category color too in ?issues mode
				// — the worklist's vocabulary replaces the boost orange there.
				"icon-image": pinIconImageExpression("b"),
				"icon-size": 1,
				"icon-anchor": "bottom",
				"icon-allow-overlap": true,
				"icon-ignore-placement": true,
				"icon-rotation-alignment": "viewport",
				"icon-pitch-alignment": "viewport",
			},
		});

		// Comment count badge — fixed 16×16 green disc rendered as a
		// dedicated icon symbol layer. Two layers (disc + text) instead of
		// one composite symbol so positioning stays simple — both share the
		// same offset from the pin anchor.
		// Pin is 32×43, icon-anchor: bottom. Top-right of the pin head is
		// ~(+10, -36) px from the geographic anchor.
		map.addLayer({
			id: "comment-badge",
			type: "symbol",
			source: "places",
			filter: [
				"all",
				["!", ["has", "point_count"]],
				[">", ["get", "comments"], 0],
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

		map.addLayer({
			id: "comment-badge-count",
			type: "symbol",
			source: "places",
			filter: [
				"all",
				["!", ["has", "point_count"]],
				[">", ["get", "comments"], 0],
			],
			layout: {
				"text-field": ["to-string", ["get", "comments"]],
				"text-font": ["Noto Sans Bold"],
				"text-size": 11,
				"text-allow-overlap": true,
				"text-ignore-placement": true,
				"text-rotation-alignment": "viewport",
				"text-pitch-alignment": "viewport",
				// text-offset is in ems; mirror the disc's pixel offset above.
				"text-offset": [10 / 11, -36 / 11],
			},
			paint: {
				"text-color": "#fff",
			},
		});

		// Saved badge — white disc with bookmark glyph on the pin's
		// top-left corner. Filter only fires when the feature's `saved`
		// flag is true (recomputed when $savedPlaceIds size changes).
		map.addLayer({
			id: "saved-badge",
			type: "symbol",
			source: "places",
			filter: [
				"all",
				["!", ["has", "point_count"]],
				["==", ["get", "saved"], true],
			],
			layout: {
				"icon-image": "saved-badge",
				"icon-size": 1,
				"icon-anchor": "center",
				// Top-left of the pin head, relative to the bottom-anchored pin.
				"icon-offset": [-12, -38],
				"icon-allow-overlap": true,
				"icon-ignore-placement": true,
				"icon-rotation-alignment": "viewport",
				"icon-pitch-alignment": "viewport",
			},
		});

		// Place name labels — visible at high zoom once the enriched-details
		// fetch has populated each place's name. Drawn before clusters-hit so
		// the spiderfy hit-target stays on top for click routing. Colors are
		// the light palette; the page's applyLabelPalette re-colors for the
		// active theme right after install.
		map.addLayer({
			id: "place-label",
			type: "symbol",
			source: "places",
			minzoom: LABEL_VISIBLE_ZOOM,
			filter: [
				"all",
				["!", ["has", "point_count"]],
				["!=", ["get", "name"], ""],
			],
			layout: {
				"text-field": ["get", "name"],
				"text-font": ["Noto Sans Bold"],
				"text-size": 14,
				"text-anchor": "left",
				// text-offset is in ems. Pin's right edge sits at ~+16 px from
				// the geographic anchor (icon-anchor: bottom). Start the label
				// 6 px past that, vertically centered on the pin head (~ -25 px).
				"text-offset": [22 / 14, -25 / 14],
				"text-max-width": 12,
				"text-rotation-alignment": "viewport",
				"text-pitch-alignment": "viewport",
			},
			paint: {
				"text-color": [
					"case",
					["get", "boosted"],
					"#f97316", // orange-500 (boosted)
					"#0e7490", // cyan-700 (regular)
				],
				"text-halo-color": "#fff",
				"text-halo-width": 1.2,
				"text-halo-blur": 0,
			},
		});

		// Mirrors of comment-badge / comment-badge-count / saved-badge /
		// place-label for the parallel `places-boosted` source. Without
		// these a boosted merchant with comments / saved state / a
		// resolved label rendered as a bare orange pin.
		map.addLayer({
			id: "boosted-comment-badge",
			type: "symbol",
			source: "places-boosted",
			filter: [">", ["get", "comments"], 0],
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

		map.addLayer({
			id: "boosted-comment-badge-count",
			type: "symbol",
			source: "places-boosted",
			filter: [">", ["get", "comments"], 0],
			layout: {
				"text-field": ["to-string", ["get", "comments"]],
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

		map.addLayer({
			id: "boosted-saved-badge",
			type: "symbol",
			source: "places-boosted",
			filter: ["==", ["get", "saved"], true],
			layout: {
				"icon-image": "saved-badge",
				"icon-size": 1,
				"icon-anchor": "center",
				"icon-offset": [-12, -38],
				"icon-allow-overlap": true,
				"icon-ignore-placement": true,
				"icon-rotation-alignment": "viewport",
				"icon-pitch-alignment": "viewport",
			},
		});

		map.addLayer({
			id: "boosted-place-label",
			type: "symbol",
			source: "places-boosted",
			minzoom: LABEL_VISIBLE_ZOOM,
			filter: ["!=", ["get", "name"], ""],
			layout: {
				"text-field": ["get", "name"],
				"text-font": ["Noto Sans Bold"],
				"text-size": 14,
				"text-anchor": "left",
				"text-offset": [22 / 14, -25 / 14],
				"text-max-width": 12,
				"text-rotation-alignment": "viewport",
				"text-pitch-alignment": "viewport",
			},
			paint: {
				"text-color": "#f97316", // orange-500 (always boosted on this source)
				"text-halo-color": "#fff",
				"text-halo-width": 1.2,
				"text-halo-blur": 0,
			},
		});

		// Symbol cluster layer used by spiderfy. Hit-testing on this layer's
		// near-invisible icon picks up the cluster_id property and routes
		// through the library, which auto-decides between zoom-on-click and
		// spiderfying based on getClusterExpansionZoom vs maxZoom.
		map.addLayer({
			id: "clusters-hit",
			type: "symbol",
			source: "places",
			filter: ["has", "point_count"],
			layout: {
				"icon-image": "cluster-hit",
				"icon-size": 1,
				"icon-allow-overlap": true,
				"icon-ignore-placement": true,
			},
		});
	};

	// Renders exactly the list it is given — all visibility policy (search,
	// category, recency, boosts) lives upstream in selectVisiblePlaces; this
	// function must never re-filter or accept an unfiltered list.
	const render = (map: MapLibreMap, list: Place[]): void => {
		const source = map.getSource("places") as GeoJSONSource | undefined;
		const boostedSource = map.getSource("places-boosted") as
			| GeoJSONSource
			| undefined;
		const heatmapSource = map.getSource("places-heatmap") as
			| GeoJSONSource
			| undefined;
		if (!source || !boostedSource) return;
		lastSyncedList = list;
		boostedAreClustered = shouldClusterBoostedAtZoom(map.getZoom());
		const { clustered, standalone } = routePlacesByBoostAndZoom(
			list,
			map.getZoom(),
		);
		source.setData(buildFeatureCollection(clustered));
		boostedSource.setData(buildFeatureCollection(standalone));
		// The heatmap reflects overall place density, so it gets the full list
		// regardless of the boosted-clustering routing decision. Only refresh
		// it while the layer is actually visible — when off (the default) we
		// skip the full-list feature-collection build entirely and repopulate
		// from lastSyncedList on enable (see setHeatmapEnabled).
		if (heatmapSource && heatmapEnabled) {
			heatmapSource.setData(buildFeatureCollection(list));
		}
		ensureSpritesForPlaces(map, list, deps.getIssueCodes?.() ?? null);
		deps.onRendered?.(list.length);
	};

	// Re-route boosted places when zoom crosses BOOSTED_CLUSTERING_MAX_ZOOM —
	// the MapLibre analogue of the legacy boostedLayer swap. Only re-renders
	// on an actual flip, so steady-state pans stay cheap.
	const resyncForZoom = (map: MapLibreMap): void => {
		if (shouldClusterBoostedAtZoom(map.getZoom()) !== boostedAreClustered) {
			render(map, lastSyncedList);
		}
	};

	const applyHeatmapVisibility = (map: MapLibreMap): void => {
		const zoom = map.getZoom();
		// Heatmap layer: visible when enabled regardless of zoom (the layer
		// itself has maxzoom: CLUSTERING_DISABLED_ZOOM, so it won't render
		// past that).
		if (map.getLayer("place-heatmap")) {
			map.setLayoutProperty(
				"place-heatmap",
				"visibility",
				heatmapEnabled ? "visible" : "none",
			);
		}
		// Conceal all point/cluster/badge/label layers while the heatmap is
		// visible.  Pins re-appear before the heatmap fully fades out
		// (zoom 15.5, ~45 % opacity) so individual pins show through the
		// still-fading heatmap — at the maxzoom boundary (17) the heatmap
		// instantly removes itself, so waiting until then feels abrupt.
		const PIN_REVEAL_ZOOM = CLUSTERING_DISABLED_ZOOM - 1.5;
		const hidePins = heatmapEnabled && zoom < PIN_REVEAL_ZOOM;
		for (const layerId of HEATMAP_HIDDEN_LAYER_IDS) {
			if (map.getLayer(layerId)) {
				map.setLayoutProperty(
					layerId,
					"visibility",
					hidePins ? "none" : "visible",
				);
			}
		}
	};

	const setHeatmapEnabled = (map: MapLibreMap, enabled: boolean): void => {
		heatmapEnabled = enabled;
		// render() skips the heatmap source while it's hidden, so seed it from
		// the last synced list on enable — otherwise it would stay blank until
		// the next data sync.
		if (enabled) {
			const heatmapSource = map.getSource("places-heatmap") as
				| GeoJSONSource
				| undefined;
			heatmapSource?.setData(buildFeatureCollection(lastSyncedList));
		}
		applyHeatmapVisibility(map);
	};

	// Re-apply the current heatmap on/off state after a style (re)load —
	// the persisted state can't be applied before the layer exists, and a
	// basemap swap that fell back to a full style rebuild resets carried
	// layout properties.
	const refreshHeatmapAfterStyle = (map: MapLibreMap): void => {
		setHeatmapEnabled(map, heatmapEnabled);
	};

	return {
		loadSprites,
		install,
		render,
		resyncForZoom,
		applyHeatmapVisibility,
		setHeatmapEnabled,
		refreshHeatmapAfterStyle,
	};
};

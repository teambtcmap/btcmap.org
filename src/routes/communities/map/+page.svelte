<script lang="ts">
import "maplibre-gl/dist/maplibre-gl.css";

import rewind from "@mapbox/geojson-rewind";
import { geoArea } from "d3-geo";
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
	StyleSpecification,
} from "maplibre-gl";
import { onDestroy, onMount } from "svelte";
import { get } from "svelte/store";

import MapLoadingMain from "$components/MapLoadingMain.svelte";
import Socials from "$components/Socials.svelte";
import { _, locale } from "$lib/i18n";
import { BASEMAPS, type BasemapId, getStoredBasemap } from "$lib/map/basemaps";
import { parseHashCoords, writeHashCoords } from "$lib/map/mapHash";
import { areaError, areas, reportError, reports } from "$lib/store";
import { areasSync } from "$lib/sync/areas";
import { batchSync } from "$lib/sync/batchSync";
import { reportsSync } from "$lib/sync/reports";
import { theme } from "$lib/theme";
import type { Area } from "$lib/types";
import { areaIconSrc, errToast } from "$lib/utils";

import { browser } from "$app/environment";
import { resolve } from "$app/paths";
import { page } from "$app/stores";
import { BasemapsControl } from "../../map/controls/BasemapsControl";
import { NavButtonsControl } from "../../map/controls/NavButtonsControl";

let mapLoading = 0;

let mapElement: HTMLDivElement;
let map: MapLibreMap | undefined;
let mapLoaded = false;
let communitiesLoaded = false;
let destroyed = false;

const communityQuery = $page.url.searchParams.get("community");
const communityLang = $page.url.searchParams.get("communityLang");
const organization = $page.url.searchParams.get("organization");

$: $areaError && errToast($areaError);
$: $reportError && errToast($reportError);

const SOURCE_ID = "communities";
const FILL_LAYER_ID = "communities-fill";
const OUTLINE_LAYER_ID = "communities-outline";

const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

type CommunityProps = {
	id: string;
	name: string;
};

const buildFeatureCollection = (
	communities: Array<Area & { area: number }>,
): FeatureCollection => {
	const features: Feature[] = [];
	for (const c of communities) {
		try {
			// Right-hand-rule winding so MapLibre fills the polygon interior
			// rather than its complement. The legacy Leaflet impl also calls
			// rewind() before adding each geo_json layer.
			const gj = rewind(c.tags.geo_json, true) as Feature | FeatureCollection;
			const geometry =
				gj.type === "Feature"
					? gj.geometry
					: gj.type === "FeatureCollection"
						? gj.features[0]?.geometry
						: (gj as unknown as Geometry);
			if (!geometry) continue;
			features.push({
				type: "Feature",
				geometry,
				properties: { id: c.id, name: c.tags.name } satisfies CommunityProps,
			});
		} catch (e) {
			console.error("Failed to rewind community geo_json", c.id, e);
		}
	}
	return { type: "FeatureCollection", features };
};

// Inlined to avoid pulling @turf/bbox into the bundle just for this. Shares
// the same shape as AreaMap's bbox walker; lift to $lib if a third consumer
// appears.
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

const addCommunitiesLayers = (m: MapLibreMap) => {
	if (!m.getSource(SOURCE_ID)) {
		m.addSource(SOURCE_ID, { type: "geojson", data: EMPTY_FC });
	}
	if (!m.getLayer(FILL_LAYER_ID)) {
		m.addLayer({
			id: FILL_LAYER_ID,
			type: "fill",
			source: SOURCE_ID,
			paint: {
				"fill-color": "#F7931A",
				"fill-opacity": 0.5,
			},
		});
	}
	if (!m.getLayer(OUTLINE_LAYER_ID)) {
		m.addLayer({
			id: OUTLINE_LAYER_ID,
			type: "line",
			source: SOURCE_ID,
			paint: {
				"line-color": "#000000",
				"line-width": 1,
			},
		});
	}
};

const buildPopupHtml = (community: Area): HTMLDivElement => {
	const container = document.createElement("div");
	container.innerHTML = `
		<div class='text-center space-y-2'>
			<img loading='lazy' src='${areaIconSrc(community.tags["icon:square"])}' alt='${get(_)("communityMap.avatarAlt")}' class='w-24 h-24 rounded-full mx-auto' title='${get(_)("communityMap.communityIconTitle")}' onerror="this.src='/images/bitcoin.svg'" />

			<span class='text-primary dark:text-white font-semibold text-xl' title='${get(_)("communityMap.communityNameTitle")}'>${community.tags.name}</span>

			${
				community.tags.organization
					? `<span class="mx-auto whitespace-nowrap w-fit block rounded-full bg-[#10B981] px-3.5 py-1 text-xs font-semibold uppercase text-white" title="${get(_)("communityMap.organization")}">${community.tags.organization}</span>`
					: ""
			}

			${
				community.tags.sponsor
					? `<span class="block gradient-bg w-32 mx-auto py-1 text-xs text-white font-semibold rounded-full" title="${get(_)("communityMap.supporter")}">${get(_)("communityMap.sponsor")}</span>`
					: ""
			}

			<div id='socials'></div>

			<a href="${resolve(`/community/${encodeURIComponent(community.id)}`)}" class='block bg-link hover:bg-hover !text-white text-center font-semibold py-3 rounded-xl transition-colors' title='${get(_)("communityMap.communityPageTitle")}'>${get(_)("communityMap.viewCommunity")}</a>
		</div>
	`;

	const socialsMount = container.querySelector("#socials");
	if (socialsMount) {
		new Socials({
			target: socialsMount,
			props: {
				website: community.tags["contact:website"],
				email: community.tags["contact:email"],
				phone: community.tags["contact:phone"],
				nostr: community.tags["contact:nostr"],
				twitter: community.tags["contact:twitter"],
				meetup: community.tags["contact:meetup"],
				telegram: community.tags["contact:telegram"],
				discord: community.tags["contact:discord"],
				youtube: community.tags["contact:youtube"],
				github: community.tags["contact:github"],
				matrix: community.tags["contact:matrix"],
				geyser: community.tags["contact:geyser"],
				satlantis: community.tags["contact:satlantis"],
				eventbrite: community.tags["contact:eventbrite"],
				reddit: community.tags["contact:reddit"],
				simplex: community.tags["contact:simplex"],
				instagram: community.tags["contact:instagram"],
				whatsapp: community.tags["contact:whatsapp"],
				facebook: community.tags["contact:facebook"],
				linkedin: community.tags["contact:linkedin"],
				rss: community.tags["contact:rss"],
				signal: community.tags["contact:signal"],
			},
		});
	}

	return container;
};

let popupsByCommunity = new Map<string, Area>();

const initializeCommunities = async () => {
	if (communitiesLoaded || !map) return;

	const communitySelected = $areas.find((area) => area.id === communityQuery);

	const communitiesFiltered = $areas.filter(
		(area) =>
			area.tags.type === "community" &&
			area.tags.geo_json &&
			area.tags.name &&
			area.tags["icon:square"] &&
			area.tags.continent &&
			$reports.find((report) => report.area_id === area.id) &&
			(communityLang ? area.tags.language === communityLang : true) &&
			(organization ? area.tags.organization === organization : true),
	);

	// Sort largest → smallest. With a single GeoJSON source MapLibre handles
	// hit-test order itself, but we keep the legacy "smaller polygons paint
	// on top" intent by reversing — features later in the array render later.
	const communities = communitiesFiltered
		.map((community) => ({
			...community,
			area: geoArea(community.tags.geo_json),
		}))
		.sort((a, b) => b.area - a.area);

	popupsByCommunity = new Map(communities.map((c) => [c.id, c]));

	addCommunitiesLayers(map);
	const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
	source?.setData(buildFeatureCollection(communities));

	if (communityQuery && communitySelected?.tags.geo_json) {
		try {
			const bbox = computeBbox(communitySelected.tags.geo_json);
			if (bbox) {
				map.fitBounds(
					[
						[bbox[0], bbox[1]],
						[bbox[2], bbox[3]],
					],
					{ padding: 40, animate: false },
				);
			}
		} catch (error) {
			map.jumpTo({ center: [0, 0], zoom: 3 });
			errToast(get(_)("errors.mapView"));
			console.error(error);
		}
	}

	mapLoading = 100;
	communitiesLoaded = true;
};

$: if ($areas?.length && $reports?.length && mapLoaded && !communitiesLoaded) {
	initializeCommunities();
}

const initializeMap = async () => {
	const maplibre = await import("maplibre-gl");
	if (destroyed) return;

	const initialBasemap: BasemapId =
		getStoredBasemap() ?? (get(theme) === "dark" ? "carto-dark" : "osm");

	const OSM_ATTR =
		'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
	const CARTO_ATTR = `${OSM_ATTR} &copy; <a href="https://carto.com/attributions">CARTO</a>`;

	const style: StyleSpecification = {
		version: 8,
		glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
		sources: {
			osm: {
				type: "raster",
				tiles: [
					"https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
					"https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
					"https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
				],
				tileSize: 256,
				attribution: OSM_ATTR,
				maxzoom: 19,
			},
			"carto-light": {
				type: "raster",
				tiles: [
					"https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
					"https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
					"https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
					"https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
				],
				tileSize: 256,
				attribution: CARTO_ATTR,
				maxzoom: 19,
			},
			"carto-dark": {
				type: "raster",
				tiles: [
					"https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
					"https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
					"https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
					"https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
				],
				tileSize: 256,
				attribution: CARTO_ATTR,
				maxzoom: 19,
			},
		},
		layers: [
			{
				id: "osm",
				type: "raster",
				source: "osm",
				layout: { visibility: initialBasemap === "osm" ? "visible" : "none" },
			},
			{
				id: "carto-light",
				type: "raster",
				source: "carto-light",
				layout: {
					visibility: initialBasemap === "carto-light" ? "visible" : "none",
				},
			},
			{
				id: "carto-dark",
				type: "raster",
				source: "carto-dark",
				layout: {
					visibility: initialBasemap === "carto-dark" ? "visible" : "none",
				},
			},
		],
	};

	const hashCoords = parseHashCoords();

	map = new maplibre.Map({
		container: mapElement,
		style,
		center: hashCoords ? [hashCoords.lng, hashCoords.lat] : [0, 0],
		zoom: hashCoords?.zoom ?? 3,
		bearing: hashCoords?.bearing ?? 0,
		pitch: hashCoords?.pitch ?? 0,
		maxZoom: 19,
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

	const geolocate = new maplibre.GeolocateControl({
		positionOptions: { enableHighAccuracy: true },
		trackUserLocation: true,
		showUserLocation: true,
		showAccuracyCircle: true,
		fitBoundsOptions: { maxZoom: 15, linear: true },
	});
	map.addControl(geolocate, "top-right");

	map.addControl(new NavButtonsControl("communities"), "top-right");

	map.addControl(
		new BasemapsControl({ basemaps: BASEMAPS, initial: initialBasemap }),
		"top-right",
	);

	map.addControl(new maplibre.ScaleControl({ unit: "metric" }), "bottom-left");

	// Re-render popup HTML when locale changes so localized labels update
	// without requiring a reload. Popup is opened on click so we only need to
	// rebuild the open one if any.
	const localeUnsub = locale.subscribe(() => {
		// noop here — popup HTML is rebuilt on each click, no live popup state
		// to update. Subscription kept for symmetry with /map.
	});

	map.on("click", FILL_LAYER_ID, (e: MapLayerMouseEvent) => {
		if (!map) return;
		const feature = e.features?.[0];
		if (!feature) return;
		const id = feature.properties?.id as string | undefined;
		if (!id) return;
		const community = popupsByCommunity.get(id);
		if (!community) return;
		const html = buildPopupHtml(community);
		new maplibre.Popup({ maxWidth: "320px", closeOnClick: true })
			.setLngLat(e.lngLat)
			.setDOMContent(html)
			.addTo(map);
	});

	const setPointer = () => {
		if (map) map.getCanvas().style.cursor = "pointer";
	};
	const resetPointer = () => {
		if (map) map.getCanvas().style.cursor = "";
	};
	map.on("mouseenter", FILL_LAYER_ID, setPointer);
	map.on("mouseleave", FILL_LAYER_ID, resetPointer);

	map.on("moveend", () => {
		if (!map || communityQuery) return;
		writeHashCoords({
			zoom: map.getZoom(),
			lat: map.getCenter().lat,
			lng: map.getCenter().lng,
			bearing: map.getBearing(),
			pitch: map.getPitch(),
		});
	});

	map.on("load", () => {
		mapLoading = 40;
		mapLoaded = true;
	});

	onDestroy(() => {
		localeUnsub();
	});
};

onMount(() => {
	batchSync([areasSync, reportsSync]);
	if (browser) {
		initializeMap();
	}
});

onDestroy(() => {
	destroyed = true;
	if (map) {
		map.remove();
		map = undefined;
	}
});
</script>

<svelte:head>
	<title>BTC Map - {$_('meta.communityMap')}</title>
	<meta property="og:image" content="https://btcmap.org/images/og/communities.png" />
	<meta property="og:title" content="BTC Map - {$_('meta.communityMap')}" />
	<meta name="twitter:title" content="BTC Map - {$_('meta.communityMap')}" />
	<meta name="twitter:image" content="https://btcmap.org/images/og/communities.png" />
</svelte:head>

<div>
	<h1 class="hidden">{$_('communityMap.pageTitle')}</h1>

	<MapLoadingMain progress={mapLoading} />

	<div bind:this={mapElement} class="absolute h-[100%] w-full !bg-teal dark:!bg-dark" />
</div>

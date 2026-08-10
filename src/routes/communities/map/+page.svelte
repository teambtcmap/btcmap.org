<script lang="ts">
import "maplibre-gl/dist/maplibre-gl.css";
import "./communities-map.css";

import rewind from "@mapbox/geojson-rewind";
import { geoArea } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type {
	GeoJSONSource,
	MapLayerMouseEvent,
	Map as MapLibreMap,
} from "maplibre-gl";
import { mount, onDestroy, onMount, unmount } from "svelte";
import { get } from "svelte/store";

import MapLoadingMain from "$components/MapLoadingMain.svelte";
import MapUnsupportedFallback from "$components/MapUnsupportedFallback.svelte";
import Socials from "$components/Socials.svelte";
import { extractContacts } from "$lib/area/contacts";
import { _ } from "$lib/i18n";
import {
	BASEMAPS,
	type BasemapId,
	defaultBasemap,
	getStoredBasemap,
	styleForBasemap,
} from "$lib/map/basemaps";
import { computeBbox } from "$lib/map/bbox";
import type { BtcmapMapHandle } from "$lib/map/createMap";
import { createBtcmapMap } from "$lib/map/createMap";
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
import { page } from "$app/state";
import MapControls from "../../map/components/MapControls.svelte";

let mapLoading = 0;

let mapElement: HTMLDivElement;
let map: MapLibreMap | undefined;
let mapHandle: BtcmapMapHandle | undefined;
let mapLoaded = false;
// Last published polygon set, kept so a basemap swap can re-seed the fresh
// style's source (the swap machine re-installs layers instead of carrying
// them — see createBtcmapMap.setStyle).
let lastCommunitiesFC: FeatureCollection | null = null;
let webglUnsupported = false;
let communitiesLoaded = false;
let destroyed = false;

const communityQuery = page.url.searchParams.get("community");
const communityLang = page.url.searchParams.get("communityLang");
const organization = page.url.searchParams.get("organization");

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
			// A FeatureCollection community (multipart polygons split across
			// features) must emit one Feature per geometry — otherwise the
			// rendered fill shows only the first part while computeBbox
			// still fits to the full shape, and the polygon-id click handler
			// only fires for the visible part.
			const geometries: (Geometry | undefined)[] =
				gj.type === "Feature"
					? [gj.geometry]
					: gj.type === "FeatureCollection"
						? gj.features.map((f) => f.geometry)
						: [gj as unknown as Geometry];
			for (const geometry of geometries) {
				if (!geometry) continue;
				features.push({
					type: "Feature",
					geometry,
					properties: { id: c.id, name: c.tags.name } satisfies CommunityProps,
				});
			}
		} catch (e) {
			console.error("Failed to rewind community geo_json", c.id, e);
		}
	}
	return { type: "FeatureCollection", features };
};

// Swap the basemap. The facade's swap machine re-installs the polygon
// source + layers on the incoming style's style.load (registerOverlays) —
// a momentary polygon blink replaces the old transformStyle carryover and
// its hand-maintained layer list.
const applyBasemap = (id: BasemapId) => {
	mapHandle?.setStyle(styleForBasemap(id));
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

// Build popup HTML for a community. Returns the container AND the mounted
// Socials instance (if any). Caller is responsible for unmount()ing it on
// popup close — otherwise each polygon click leaks an extra Socials with
// its theme/locale subscriptions still live.
//
// Built via DOM APIs instead of innerHTML interpolation: community.tags.*
// (name, organization, …) come from the curated areas API but are still
// untrusted strings; assembling with textContent keeps any `<script>` /
// HTML in a tag from executing.
const buildPopupHtml = (
	community: Area,
): { container: HTMLDivElement; socials: ReturnType<typeof mount> } => {
	const t = get(_);
	const container = document.createElement("div");
	const wrapper = document.createElement("div");
	wrapper.className = "text-center space-y-2";
	container.appendChild(wrapper);

	const img = document.createElement("img");
	img.loading = "lazy";
	img.src = areaIconSrc(community.id, community.tags["icon:square"]);
	img.alt = t("communityMap.avatarAlt");
	img.className = "w-24 h-24 rounded-full mx-auto";
	img.title = t("communityMap.communityIconTitle");
	img.addEventListener("error", () => {
		img.src = "/images/bitcoin.svg";
	});
	wrapper.appendChild(img);

	const nameSpan = document.createElement("span");
	nameSpan.className = "text-primary dark:text-white font-semibold text-xl";
	nameSpan.title = t("communityMap.communityNameTitle");
	nameSpan.textContent = community.tags.name;
	wrapper.appendChild(nameSpan);

	if (community.tags.organization) {
		const orgSpan = document.createElement("span");
		orgSpan.className =
			"mx-auto whitespace-nowrap w-fit block rounded-full bg-[#10B981] px-3.5 py-1 text-xs font-semibold uppercase text-white";
		orgSpan.title = t("communityMap.organization");
		orgSpan.textContent = community.tags.organization;
		wrapper.appendChild(orgSpan);
	}

	if (community.tags.sponsor) {
		const sponsorSpan = document.createElement("span");
		sponsorSpan.className =
			"block gradient-bg w-32 mx-auto py-1 text-xs text-white font-semibold rounded-full";
		sponsorSpan.title = t("communityMap.supporter");
		sponsorSpan.textContent = t("communityMap.sponsor");
		wrapper.appendChild(sponsorSpan);
	}

	const socialsMount = document.createElement("div");
	wrapper.appendChild(socialsMount);

	const link = document.createElement("a");
	link.href = resolve(`/community/${encodeURIComponent(community.id)}`);
	link.className =
		"block bg-link hover:bg-hover !text-white text-center font-semibold py-3 rounded-xl transition-colors";
	link.title = t("communityMap.communityPageTitle");
	link.textContent = t("communityMap.viewCommunity");
	wrapper.appendChild(link);

	const socials = mount(Socials, {
		target: socialsMount,
		props: { contacts: extractContacts(community.tags) },
	});

	return { container, socials };
};

let popupsByCommunity = new Map<string, Area>();

const initializeCommunities = async () => {
	if (communitiesLoaded || !map) return;

	const communitySelected = $areas.find((area) => area.id === communityQuery);

	const communitiesFiltered = $areas.filter(
		(area) =>
			area.tags?.type === "community" &&
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
	const fc = buildFeatureCollection(communities);
	// Retained so a basemap swap can re-seed the fresh style's source
	lastCommunitiesFC = fc;
	const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
	source?.setData(fc);

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
	// Five basemaps (legacy parity). A stored picker choice wins; otherwise
	// the first-visit default is theme-aware (Liberty light, Carto Dark
	// Matter dark). Explicit-style mode: this page owns style selection, so
	// the facade's setTheme is inert and swaps go through applyBasemap →
	// handle.setStyle.
	const initialBasemap: BasemapId =
		getStoredBasemap() ?? defaultBasemap(get(theme));
	const hashCoords = parseHashCoords();

	const outcome = await createBtcmapMap({
		container: mapElement,
		theme: get(theme),
		style: styleForBasemap(initialBasemap),
		mapOptions: {
			center: hashCoords ? [hashCoords.lng, hashCoords.lat] : [0, 0],
			zoom: hashCoords?.zoom ?? 3,
			bearing: hashCoords?.bearing ?? 0,
			pitch: hashCoords?.pitch ?? 0,
		},
		isCancelled: () => destroyed,
		// Re-runs after every basemap swap: re-install the polygon layers and
		// re-seed the fresh style's source from the last published set.
		registerOverlays: (m) => {
			addCommunitiesLayers(m);
			if (lastCommunitiesFC) {
				const source = m.getSource(SOURCE_ID) as GeoJSONSource | undefined;
				source?.setData(lastCommunitiesFC);
			}
		},
		onFirstLoad: (m) => {
			mapLoading = 40;
			mapLoaded = true;
			attachInteractions(m);
		},
	});

	if (outcome.status === "unsupported") {
		webglUnsupported = true;
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

const attachInteractions = (m: MapLibreMap) => {
	const maplibre = mapHandle?.maplibre;
	if (!maplibre) return;

	m.addControl(new maplibre.ScaleControl({ unit: "metric" }), "bottom-left");

	m.on("click", FILL_LAYER_ID, (e: MapLayerMouseEvent) => {
		const feature = e.features?.[0];
		if (!feature) return;
		const id = feature.properties?.id as string | undefined;
		if (!id) return;
		const community = popupsByCommunity.get(id);
		if (!community) return;
		const { container, socials } = buildPopupHtml(community);
		const popup = new maplibre.Popup({ maxWidth: "320px", closeOnClick: true })
			.setLngLat(e.lngLat)
			.setDOMContent(container)
			.addTo(m);
		// Unmount the Socials Svelte instance when the popup goes away —
		// MapLibre removes the DOM but the component's reactive
		// subscriptions (theme, locale, etc.) would otherwise leak per
		// click, accumulating with every polygon the user hovers.
		popup.on("close", () => unmount(socials));
	});

	const setPointer = () => {
		m.getCanvas().style.cursor = "pointer";
	};
	const resetPointer = () => {
		m.getCanvas().style.cursor = "";
	};
	m.on("mouseenter", FILL_LAYER_ID, setPointer);
	m.on("mouseleave", FILL_LAYER_ID, resetPointer);

	m.on("moveend", () => {
		if (communityQuery) return;
		writeHashCoords({
			zoom: m.getZoom(),
			lat: m.getCenter().lat,
			lng: m.getCenter().lng,
			bearing: m.getBearing(),
			pitch: m.getPitch(),
		});
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
	mapHandle?.destroy();
	mapHandle = undefined;
	map = undefined;
});
</script>

<svelte:head>
	<title>BTC Map - {$_('meta.communityMap')}</title>
	<meta property="og:image" content="https://btcmap.org/images/og/communities.png" />
	<meta property="og:title" content="BTC Map - {$_('meta.communityMap')}" />
	<meta name="twitter:title" content="BTC Map - {$_('meta.communityMap')}" />
	<meta name="twitter:image" content="https://btcmap.org/images/og/communities.png" />
</svelte:head>

<div class="communities-map-page">
	<h1 class="hidden">{$_('communityMap.pageTitle')}</h1>

	<MapLoadingMain progress={mapLoading} />

	<!-- !absolute + inset-0 fills the viewport. MapLibre ships its own
	     `.maplibregl-map { position: relative }` rule that wins against
	     Tailwind's `absolute` class by source order; `!absolute` forces
	     the override. Leaflet used to mask this entirely by sizing its
	     own container; MapLibre respects the DOM box. -->
	<div bind:this={mapElement} class="!absolute inset-0 !bg-teal dark:!bg-dark"></div>

	<MapControls
		{map}
		variant="communities"
		basemaps={BASEMAPS}
		{applyBasemap}
	/>

	{#if webglUnsupported}
		<MapUnsupportedFallback />
	{/if}
</div>

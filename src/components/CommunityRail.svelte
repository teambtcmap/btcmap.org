<script lang="ts">
import rewind from "@mapbox/geojson-rewind";
import type { Feature, FeatureCollection } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { onDestroy, onMount } from "svelte";
import { fly } from "svelte/transition";

import {
	MAP_PANEL_MARGIN,
	MERCHANT_DRAWER_WIDTH,
	PANEL_DRAWER_GAP,
} from "$lib/constants";
import { merchantDrawer } from "$lib/merchantDrawerStore";
import { merchantList } from "$lib/merchantListStore";
import { areas } from "$lib/store";
import { areasSync } from "$lib/sync/areas";
import type { Area } from "$lib/types";
import { areaIconSrc, getCommunitiesAtCoordinates } from "$lib/utils";

import { resolve } from "$app/paths";

// MapLibre-native port of /map's CommunityRail. Same desktop/mobile
// layout + behavior; preview polygon now lives on a dedicated GeoJSON
// source + fill/outline layers that we add once and reuse, rather than
// the legacy approach of adding/removing a leaflet.geoJSON layer on
// every hover.

const DESKTOP_FLY = { duration: 280, y: 10 };
const MOBILE_FLY = { duration: 280, y: -10 };

const SOURCE_ID = "community-preview";
const FILL_LAYER_ID = "community-preview-fill";
const OUTLINE_LAYER_ID = "community-preview-outline";

const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

export let lat: number | null = null;
export let lon: number | null = null;
export let zoom: number | null = null;
export let map: MapLibreMap | undefined = undefined;

const MIN_ZOOM = 6;
const MOBILE_VISIBLE_LIMIT = 4;

$: allCommunities =
	lat !== null && lon !== null && zoom !== null && zoom >= MIN_ZOOM
		? getCommunitiesAtCoordinates(lat, lon, $areas)
		: [];

$: mobileVisible = allCommunities.slice(0, MOBILE_VISIBLE_LIMIT);
$: mobileOverflow = Math.max(0, allCommunities.length - MOBILE_VISIBLE_LIMIT);

$: rightOffset = $merchantDrawer.isOpen
	? MAP_PANEL_MARGIN + MERCHANT_DRAWER_WIDTH + PANEL_DRAWER_GAP
	: MAP_PANEL_MARGIN;

let previewCommunityId: string | null = null;
let layersAdded = false;

// Clear hover preview if the previewed community is no longer visible
// (rail removed by pan / zoom-out before mouseleave/blur fires).
$: if (
	previewCommunityId &&
	!allCommunities.some((c) => c.id === previewCommunityId)
) {
	clearPreview();
}

const avatarUrl = (community: Area): string =>
	areaIconSrc(community.tags["icon:square"], 64);

const communityHref = (community: Area): string =>
	resolve(`/community/${encodeURIComponent(community.id)}`);

const handleImgError = (e: Event) => {
	const img = e.currentTarget as HTMLImageElement;
	img.src = "/images/bitcoin.svg";
};

const ensureLayers = (m: MapLibreMap) => {
	if (layersAdded) return;
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
				"fill-opacity": 0.3,
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
	layersAdded = true;
};

function clearPreview() {
	previewCommunityId = null;
	if (!map) return;
	const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
	source?.setData(EMPTY_FC);
}

function showPreview(community: Area) {
	if (!map || !community.tags.geo_json) return;
	ensureLayers(map);
	const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
	if (!source) return;
	try {
		// Right-hand-rule winding for fill rendering correctness.
		const gj = rewind(community.tags.geo_json, true) as
			| Feature
			| FeatureCollection;
		source.setData(gj);
		previewCommunityId = community.id;
	} catch (e) {
		console.error("CommunityRail: failed to draw preview", e);
	}
}

onMount(() => {
	// /map doesn't otherwise sync the areas store; trigger it here so the
	// rail has data. areasSync has its own 5-min cache.
	areasSync();
});

onDestroy(() => {
	if (!map) return;
	if (map.getLayer(OUTLINE_LAYER_ID)) map.removeLayer(OUTLINE_LAYER_ID);
	if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
	if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
});
</script>

{#if allCommunities.length > 0}
	<!-- Desktop: bottom-right, above the attribution. Shifts left when drawer opens. -->
	<div
		class="pointer-events-none absolute bottom-10 z-[1001] hidden flex-col-reverse gap-2 transition-[right] duration-200 md:flex"
		style="right: {rightOffset}px"
	>
		{#each allCommunities as community (community.id)}
			<a
				href={communityHref(community)}
				title={community.tags.name}
				aria-label={community.tags.name}
				on:mouseenter={() => showPreview(community)}
				on:mouseleave={clearPreview}
				on:focus={() => showPreview(community)}
				on:blur={clearPreview}
				transition:fly={DESKTOP_FLY}
				class="pointer-events-auto block h-10 w-10 overflow-hidden rounded-full border border-white bg-white shadow-md hover:ring-2 hover:ring-link dark:border-dark dark:bg-dark"
			>
				<img
					loading="lazy"
					src={avatarUrl(community)}
					alt={community.tags.name}
					class="h-full w-full object-cover"
					on:error={handleImgError}
				/>
			</a>
		{/each}
	</div>

	<!-- Mobile: top-left. Hidden when drawer or list panel is open. -->
	<div
		class="pointer-events-none absolute top-3 left-3 z-[1001] flex flex-col gap-1.5 md:hidden"
		class:hidden={$merchantDrawer.isOpen || $merchantList.isOpen}
	>
		{#each mobileVisible as community (community.id)}
			<a
				href={communityHref(community)}
				title={community.tags.name}
				aria-label={community.tags.name}
				transition:fly={MOBILE_FLY}
				class="pointer-events-auto block h-8 w-8 overflow-hidden rounded-full border border-white bg-white shadow-md dark:border-dark dark:bg-dark"
			>
				<img
					loading="lazy"
					src={avatarUrl(community)}
					alt={community.tags.name}
					class="h-full w-full object-cover"
					on:error={handleImgError}
				/>
			</a>
		{/each}
		{#if mobileOverflow > 0}
			<a
				href={resolve('/communities/map')}
				title="+{mobileOverflow} more"
				aria-label="View all communities on the community map"
				transition:fly={MOBILE_FLY}
				class="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-white bg-white text-xs font-semibold text-primary shadow-md dark:border-dark dark:bg-dark dark:text-white"
			>
				+{mobileOverflow}
			</a>
		{/if}
	</div>
{/if}

<script lang="ts">
import rewind from "@mapbox/geojson-rewind";
import type { GeoJSON as LeafletGeoJSON, Map as LeafletMap } from "leaflet";
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
import type { Area, Leaflet } from "$lib/types";
import { getCommunitiesAtCoordinates } from "$lib/utils";

import { resolve } from "$app/paths";

// Enter from 10px below (slides up), exit reverses. Y motion avoids the
// horizontal scrollbar that X motion caused when the rail sat at the viewport edge.
const DESKTOP_FLY = { duration: 280, y: 10 };
// Mobile rail is anchored top-left, so enter from above sliding down.
const MOBILE_FLY = { duration: 280, y: -10 };

export let lat: number | null = null;
export let lon: number | null = null;
export let zoom: number | null = null;
export let map: LeafletMap | undefined = undefined;
export let leaflet: Leaflet | undefined = undefined;

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

// Clear hover preview if the previewed community is no longer visible.
// This handles the case where the rail DOM is removed (pan / zoom-out)
// before mouseleave or blur fires on the hovered anchor.
$: if (
	previewCommunityId &&
	!allCommunities.some((c) => c.id === previewCommunityId)
) {
	clearPreview();
}

const avatarUrl = (community: Area): string =>
	`https://btcmap.org/.netlify/images?url=${encodeURIComponent(community.tags["icon:square"])}&fit=cover&w=64&h=64`;

const communityHref = (community: Area): string =>
	resolve(`/community/${encodeURIComponent(community.id)}`);

const handleImgError = (e: Event) => {
	const img = e.currentTarget as HTMLImageElement;
	img.src = "/images/bitcoin.svg";
};

let previewLayer: LeafletGeoJSON | null = null;
let previewCommunityId: string | null = null;

function clearPreview() {
	if (previewLayer && map) {
		map.removeLayer(previewLayer);
	}
	previewLayer = null;
	previewCommunityId = null;
}

function showPreview(community: Area) {
	if (!map || !leaflet || !community.tags.geo_json) return;
	clearPreview();
	try {
		const gj = rewind(community.tags.geo_json, true);
		previewLayer = leaflet
			.geoJSON(gj, {
				style: {
					color: "#000000",
					weight: 1,
					fillColor: "#F7931A",
					fillOpacity: 0.3,
				},
				interactive: false,
			})
			.addTo(map);
		previewCommunityId = community.id;
	} catch (e) {
		console.error("CommunityRail: failed to draw preview", e);
	}
}

onMount(() => {
	// /map does not otherwise sync the areas store; trigger it here so the
	// rail has data. areasSync has its own 5-min cache so repeat calls are cheap.
	areasSync();
});

onDestroy(clearPreview);
</script>

{#if allCommunities.length > 0}
	<!-- Desktop: bottom-right, above Leaflet attribution. Shifts left when drawer opens. -->
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

	<!-- Mobile: top-left. Hidden when the merchant drawer or the nearby/worldwide list is open so the active merchant context owns the screen. -->
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

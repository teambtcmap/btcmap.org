<script lang="ts">
import { onMount } from "svelte";

import {
	MAP_PANEL_MARGIN,
	MERCHANT_DRAWER_WIDTH,
	PANEL_DRAWER_GAP,
} from "$lib/constants";
import { merchantDrawer } from "$lib/merchantDrawerStore";
import { areas } from "$lib/store";
import { areasSync } from "$lib/sync/areas";
import type { Area } from "$lib/types";
import { getCommunitiesAtCoordinates } from "$lib/utils";

import { resolve } from "$app/paths";

export let lat: number | null = null;
export let lon: number | null = null;
export let zoom: number | null = null;

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

const avatarUrl = (community: Area): string =>
	`https://btcmap.org/.netlify/images?url=${community.tags["icon:square"]}&fit=cover&w=64&h=64`;

const communityHref = (community: Area): string =>
	resolve(`/community/${encodeURIComponent(community.id)}`);

const handleImgError = (e: Event) => {
	const img = e.currentTarget as HTMLImageElement;
	img.src = "/images/bitcoin.svg";
};

onMount(() => {
	// /map does not otherwise sync the areas store; trigger it here so the
	// rail has data. areasSync has its own 5-min cache so repeat calls are cheap.
	areasSync();
});
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

	<!-- Mobile: top-left (desktop search bar moves to bottom on mobile, leaving space here). Capped with +N overflow link. -->
	<div
		class="pointer-events-none absolute top-3 left-3 z-[1001] flex flex-col gap-1.5 md:hidden"
	>
		{#each mobileVisible as community (community.id)}
			<a
				href={communityHref(community)}
				title={community.tags.name}
				aria-label={community.tags.name}
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
				class="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-white bg-white text-xs font-semibold text-primary shadow-md dark:border-dark dark:bg-dark dark:text-white"
			>
				+{mobileOverflow}
			</a>
		{/if}
	</div>
{/if}

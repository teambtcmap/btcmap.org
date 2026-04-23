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

$: communities =
	lat !== null && lon !== null && zoom !== null && zoom >= MIN_ZOOM
		? getCommunitiesAtCoordinates(lat, lon, $areas)
		: [];

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

{#if communities.length > 0}
	<div
		class="pointer-events-none absolute top-24 z-[1001] hidden flex-col gap-2 transition-[right] duration-200 md:flex"
		style="right: {rightOffset}px"
	>
		{#each communities as community (community.id)}
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
{/if}

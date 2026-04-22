<script lang="ts">
import { onDestroy, onMount } from "svelte";

import Icon from "$components/Icon.svelte";
import MultiPlaceMap from "$components/MultiPlaceMap.svelte";
import api from "$lib/axios";
import { _ } from "$lib/i18n";
import { removeSavedItem, setSavedList } from "$lib/savedItems";
import { session } from "$lib/session";
import type { SavedPlace } from "$lib/types";
import { errToast } from "$lib/utils";

import { goto } from "$app/navigation";
import { resolve } from "$app/paths";

type SavedArea = {
	id: number;
	name: string;
	type: string;
	url_alias: string;
	icon?: string;
	website_url?: string;
};

let places: SavedPlace[] = [];
let areas: SavedArea[] = [];
let loading = true;
let placesError = false;
let areasError = false;
let removingPlaces = new Set<number>();
let removingAreas = new Set<number>();

// Gate the heavy MultiPlaceMap on desktop viewports so mobile users
// don't download Leaflet + MapLibre + plugins for a view they can't see.
// Matches Tailwind's default `md` breakpoint (768px).
let isDesktop = false;
let desktopMql: MediaQueryList | undefined;
const handleDesktopChange = (e: MediaQueryListEvent) => {
	isDesktop = e.matches;
};

async function removePlace(id: number) {
	if (!$session || removingPlaces.has(id)) return;
	const token = $session.token;
	const index = places.findIndex((p) => p.id === id);
	if (index === -1) return;
	const previous = places[index];

	removingPlaces = new Set(removingPlaces).add(id);
	places = places.filter((p) => p.id !== id);

	try {
		const serverList = await removeSavedItem("place", token, id);
		setSavedList("place", serverList);
		// Drop any cards for IDs the server no longer lists (e.g. removed
		// from another tab/device since we loaded this page).
		const serverIds = new Set(serverList);
		places = places.filter((p) => serverIds.has(p.id));
	} catch (err) {
		console.error("Failed to remove saved place", err);
		errToast($_("saved.removeFailed"));
		places = [...places.slice(0, index), previous, ...places.slice(index)];
	} finally {
		const next = new Set(removingPlaces);
		next.delete(id);
		removingPlaces = next;
	}
}

async function removeArea(id: number) {
	if (!$session || removingAreas.has(id)) return;
	const token = $session.token;
	const index = areas.findIndex((a) => a.id === id);
	if (index === -1) return;
	const previous = areas[index];

	removingAreas = new Set(removingAreas).add(id);
	areas = areas.filter((a) => a.id !== id);

	try {
		const serverList = await removeSavedItem("area", token, id);
		setSavedList("area", serverList);
		// Drop any cards for IDs the server no longer lists (e.g. removed
		// from another tab/device since we loaded this page).
		const serverIds = new Set(serverList);
		areas = areas.filter((a) => serverIds.has(a.id));
	} catch (err) {
		console.error("Failed to remove saved area", err);
		errToast($_("saved.removeFailed"));
		areas = [...areas.slice(0, index), previous, ...areas.slice(index)];
	} finally {
		const next = new Set(removingAreas);
		next.delete(id);
		removingAreas = next;
	}
}

onMount(async () => {
	desktopMql = window.matchMedia("(min-width: 768px)");
	isDesktop = desktopMql.matches;
	desktopMql.addEventListener("change", handleDesktopChange);

	// Ensure session is hydrated from localStorage before checking.
	// Child onMount runs before layout onMount in Svelte, so we can't
	// rely on the layout's session.init() having run yet.
	session.init();

	if (!$session) {
		goto("/login");
		return;
	}

	const headers = { Authorization: `Bearer ${$session.token}` };
	const [placesRes, areasRes] = await Promise.allSettled([
		api.get<SavedPlace[]>("/api/session/saved-places", { headers }),
		api.get<SavedArea[]>("/api/session/saved-areas", { headers }),
	]);

	if (placesRes.status === "fulfilled") {
		places = placesRes.value.data;
	} else {
		placesError = true;
		console.error("Failed to load saved places", placesRes.reason);
	}

	if (areasRes.status === "fulfilled") {
		areas = areasRes.value.data;
	} else {
		areasError = true;
		console.error("Failed to load saved areas", areasRes.reason);
	}

	loading = false;
});

onDestroy(() => {
	desktopMql?.removeEventListener("change", handleDesktopChange);
});
</script>

<svelte:head>
	<title>{$_("saved.title")} | BTC Map</title>
</svelte:head>

<div class="my-10 space-y-12 md:my-20">
	<h1 class="text-center text-4xl font-semibold text-primary dark:text-white">
		{$_("saved.title")}
	</h1>

	{#if loading}
		<div class="flex justify-center">
			<div class="h-8 w-8 animate-spin rounded-full border-4 border-link border-t-transparent" />
		</div>
	{:else if !places.length && !areas.length && !placesError && !areasError}
		<p class="text-center text-lg text-body dark:text-white/70">
			{$_("saved.empty")}
		</p>
	{:else}
		{#if placesError}
			<p class="text-center text-body dark:text-white/70">{$_("saved.loadError")}</p>
		{/if}
		{#if areasError}
			<p class="text-center text-body dark:text-white/70">{$_("saved.loadError")}</p>
		{/if}
		{#if places.length}
			<section class="space-y-4">
				<h2 class="text-2xl font-semibold text-primary dark:text-white">
					<Icon type="material" icon="location_on" w="24" h="24" class="mr-1 inline align-middle" />
					{$_("saved.places")}
				</h2>
				{#if isDesktop}
					<MultiPlaceMap {places} />
				{/if}
				<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each places as place (place.id)}
						{@const placeLabel = place.name || `Place ${place.id}`}
						<div
							class="flex items-center gap-2 rounded-xl border border-gray-300 pr-2 transition-colors hover:border-link dark:border-white/20 dark:hover:border-link {removingPlaces.has(
								place.id,
							)
								? 'opacity-50'
								: ''}"
						>
							<a
								href={resolve(`/merchant/${place.id}`)}
								class="flex min-w-0 flex-1 items-center gap-3 p-4"
							>
								<Icon
									type="material"
									icon="bookmark_filled"
									w="20"
									h="20"
									class="shrink-0 text-link"
								/>
								<span class="truncate font-semibold text-primary dark:text-white">
									{placeLabel}
								</span>
							</a>
							<button
								type="button"
								aria-label={$_("saved.removeNamed", { values: { name: placeLabel } })}
								title={$_("saved.removeNamed", { values: { name: placeLabel } })}
								class="shrink-0 rounded-full p-2 text-body/60 transition-colors hover:bg-gray-100 hover:text-body disabled:opacity-40 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
								disabled={removingPlaces.has(place.id)}
								on:click={() => removePlace(place.id)}
							>
								<Icon type="material" icon="close" w="18" h="18" />
							</button>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		{#if areas.length}
			<section class="space-y-4">
				<h2 class="text-2xl font-semibold text-primary dark:text-white">
					<Icon type="material" icon="map" w="24" h="24" class="mr-1 inline align-middle" />
					{$_("saved.areas")}
				</h2>
				<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each areas as area (area.id)}
						{@const areaLabel = area.name || area.url_alias}
						<div
							class="flex items-center gap-2 rounded-xl border border-gray-300 pr-2 transition-colors hover:border-link dark:border-white/20 dark:hover:border-link {removingAreas.has(
								area.id,
							)
								? 'opacity-50'
								: ''}"
						>
							<a
								href={resolve(
									`/${area.type === "community" ? "community" : "country"}/${area.url_alias}/merchants`,
								)}
								class="flex min-w-0 flex-1 items-center gap-3 p-4"
							>
								{#if area.icon}
									<img
										src={area.icon}
										alt=""
										class="h-8 w-8 shrink-0 rounded-full object-cover"
									/>
								{:else}
									<Icon
										type="material"
										icon="bookmark_filled"
										w="20"
										h="20"
										class="shrink-0 text-link"
									/>
								{/if}
								<span class="truncate font-semibold text-primary dark:text-white">
									{areaLabel}
								</span>
							</a>
							<button
								type="button"
								aria-label={$_("saved.removeNamed", { values: { name: areaLabel } })}
								title={$_("saved.removeNamed", { values: { name: areaLabel } })}
								class="shrink-0 rounded-full p-2 text-body/60 transition-colors hover:bg-gray-100 hover:text-body disabled:opacity-40 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
								disabled={removingAreas.has(area.id)}
								on:click={() => removeArea(area.id)}
							>
								<Icon type="material" icon="close" w="18" h="18" />
							</button>
						</div>
					{/each}
				</div>
			</section>
		{/if}
	{/if}
</div>

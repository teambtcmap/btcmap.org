<script lang="ts">
import { onMount } from "svelte";

import Icon from "$components/Icon.svelte";
import api from "$lib/axios";
import { _ } from "$lib/i18n";
import { session } from "$lib/session";

import { goto } from "$app/navigation";
import { resolve } from "$app/paths";

type SavedPlace = {
	id: number;
	name: string;
	lat: number;
	lon: number;
};

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

onMount(async () => {
	if (!$session) {
		goto("/map");
		return;
	}

	try {
		const headers = { Authorization: `Bearer ${$session.token}` };
		const [placesRes, areasRes] = await Promise.all([
			api.get<SavedPlace[]>("/api/session/saved-places", { headers }),
			api.get<SavedArea[]>("/api/session/saved-areas", { headers }),
		]);
		places = placesRes.data;
		areas = areasRes.data;
	} catch (err) {
		console.error("Failed to load saved items", err);
	}
	loading = false;
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
	{:else if !places.length && !areas.length}
		<p class="text-center text-lg text-body dark:text-white/70">
			{$_("saved.empty")}
		</p>
	{:else}
		{#if places.length}
			<section class="space-y-4">
				<h2 class="text-2xl font-semibold text-primary dark:text-white">
					<Icon type="material" icon="location_on" w="24" h="24" class="mr-1 inline align-middle" />
					{$_("saved.places")}
				</h2>
				<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each places as place (place.id)}
						<a
							href={resolve(`/merchant/${place.id}`)}
							class="flex items-center gap-3 rounded-xl border border-gray-300 p-4 transition-colors hover:border-link dark:border-white/20 dark:hover:border-link"
						>
							<Icon type="material" icon="bookmark_filled" w="20" h="20" class="shrink-0 text-link" />
							<span class="truncate font-semibold text-primary dark:text-white">
								{place.name || `Place ${place.id}`}
							</span>
						</a>
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
						<a
							href={resolve(`/${area.type === "community" ? "community" : "country"}/${area.url_alias}/merchants`)}
							class="flex items-center gap-3 rounded-xl border border-gray-300 p-4 transition-colors hover:border-link dark:border-white/20 dark:hover:border-link"
						>
							{#if area.icon}
								<img
									src={area.icon}
									alt=""
									class="h-8 w-8 shrink-0 rounded-full object-cover"
								/>
							{:else}
								<Icon type="material" icon="bookmark_filled" w="20" h="20" class="shrink-0 text-link" />
							{/if}
							<span class="truncate font-semibold text-primary dark:text-white">
								{area.name || area.url_alias}
							</span>
						</a>
					{/each}
				</div>
			</section>
		{/if}
	{/if}
</div>

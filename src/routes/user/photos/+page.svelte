<script lang="ts">
import { onMount } from "svelte";
import Time from "svelte-time";

import type { PlacePhotoSource } from "#lib/analytics.js";
import { trackEvent } from "#lib/analytics.js";
import { createTimeLocale } from "#lib/dayjsLocale.js";
import { _, locale } from "#lib/i18n/index.js";
import {
	askPhotoDelete,
	cancelPhotoDelete,
	confirmPhotoDelete,
} from "#lib/placePhotoDelete.js";
import { fetchMyPlacePhotos, placePhotoUrl } from "#lib/placePhotos.js";
import { session } from "#lib/session.js";
import { placesById } from "#lib/store.js";
import Icon from "$components/Icon.svelte";
import PhotoDeleteConfirm from "$components/PhotoDeleteConfirm.svelte";
import Skeleton from "$components/Skeleton.svelte";

import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import type { PlaceImage } from "$types/btcmap-api/PlaceImage";

// "My photos": every photo the signed-in user uploaded, across places,
// newest first: the photo opens on its merchant page, the place name links
// to the place, and each has a delete action (#1469).

const TILE_HEIGHT = 160;
// One row on desktop (4 columns), two on phones
const SKELETON_CARDS = 4;
const SOURCE: PlacePhotoSource = "my_photos";

let photos = $state<PlaceImage[]>([]);
let loading = $state(true);
let loadError = $state(false);
// The photo whose delete is waiting for confirmation, and the one in flight
let confirmingId = $state<number | null>(null);
let deletingId = $state<number | null>(null);

const timeLocale = createTimeLocale(locale);

// Places come from the app-wide sync; a place that's gone (or not synced
// yet) still gets a readable label
const placeName = (placeId: number) =>
	$placesById.get(placeId)?.name ||
	$_("myPhotos.unknownPlace", { values: { id: placeId } });

const askDelete = (imageId: number) => {
	confirmingId = imageId;
	askPhotoDelete(SOURCE);
};

const cancelDelete = () => {
	confirmingId = null;
	cancelPhotoDelete(SOURCE);
};

const confirmDelete = async (photo: PlaceImage) => {
	const token = $session?.token;
	if (!token || deletingId !== null) return;
	deletingId = photo.id;
	const deleted = await confirmPhotoDelete({
		placeId: photo.place_id,
		imageId: photo.id,
		token,
		source: SOURCE,
		t: $_,
	});
	if (deleted) photos = photos.filter((p) => p.id !== photo.id);
	deletingId = null;
	confirmingId = null;
};

onMount(async () => {
	// Child onMount runs before the layout's, so hydrate the session here
	session.init();
	if (!$session) {
		goto("/login");
		return;
	}
	try {
		photos = await fetchMyPlacePhotos($session.token);
	} catch (error) {
		console.error("my photos: load failed", error);
		loadError = true;
	} finally {
		loading = false;
	}
});
</script>

<svelte:head>
	<title>{$_("myPhotos.title")} | BTC Map</title>
</svelte:head>

<div class="my-10 space-y-8 md:my-20">
	<h1 class="text-center text-4xl font-semibold text-primary dark:text-white">
		{$_("myPhotos.title")}
	</h1>

	{#if loading}
		<!-- Skeleton cards shaped like the real ones, so the grid doesn't jump -->
		<div role="status" aria-label={$_("aria.loading")}>
			<ul aria-hidden="true" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
				{#each { length: SKELETON_CARDS } as _card, i (i)}
					<li class="overflow-hidden rounded-2xl border border-gray-300 dark:border-white/20 dark:bg-white/5">
						<Skeleton class="h-40" />
						<div class="space-y-2 p-3">
							<Skeleton class="h-4 w-3/4 rounded" />
							<Skeleton class="h-3 w-1/3 rounded" />
							<Skeleton class="h-4 w-24 rounded" />
						</div>
					</li>
				{/each}
			</ul>
		</div>
	{:else if loadError}
		<p class="text-center text-body dark:text-white/70">{$_("myPhotos.loadError")}</p>
	{:else if !photos.length}
		<p class="text-center text-lg text-body dark:text-white/70">{$_("myPhotos.empty")}</p>
	{:else}
		<ul role="list" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
			{#each photos as photo (photo.id)}
				<li class="overflow-hidden rounded-2xl border border-gray-300 dark:border-white/20 dark:bg-white/5">
					<a
						href={`${resolve(`merchant/${photo.place_id}`)}?photo=${photo.id}`}
						onclick={() => trackEvent("my_photos_tile_click", { link: "photo" })}
						class="block bg-link/50 dark:bg-white/10"
					>
						<img
							src={placePhotoUrl(photo.place_id, photo.id, { h: TILE_HEIGHT * 2 })}
							alt={placeName(photo.place_id)}
							loading="lazy"
							decoding="async"
							referrerpolicy="no-referrer"
							class="h-40 w-full object-cover"
						/>
					</a>
					<div class="space-y-2 p-3">
						<a
							href={resolve(`merchant/${photo.place_id}`)}
							onclick={() => trackEvent("my_photos_tile_click", { link: "place" })}
							class="block truncate text-sm font-semibold text-primary hover:text-link dark:text-white"
						>
							{placeName(photo.place_id)}
						</a>
						<p class="text-xs text-body dark:text-white/70">
							<Time timestamp={photo.created_at} relative locale={$timeLocale} />
						</p>
						{#if confirmingId === photo.id}
							<div class="flex items-center gap-2">
								<PhotoDeleteConfirm
									size="xs"
									deleting={deletingId === photo.id}
									onCancel={cancelDelete}
									onConfirm={() => confirmDelete(photo)}
								/>
							</div>
						{:else}
							<button
								type="button"
								onclick={() => askDelete(photo.id)}
								class="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
							>
								<Icon w="16" h="16" icon="delete" type="material" />
								{$_("placePhotos.deletePhoto")}
							</button>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

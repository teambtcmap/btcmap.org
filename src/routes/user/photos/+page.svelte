<script lang="ts">
import { isAxiosError } from "axios";
import { onMount } from "svelte";
import type { Locales } from "svelte-time";
import Time from "svelte-time";

import Icon from "$components/Icon.svelte";
import { trackEvent } from "$lib/analytics";
import { loadDayjsLocale } from "$lib/dayjsLocale";
import { _, locale } from "$lib/i18n";
import type { PlacePhotoSource } from "$lib/placePhotos";
import {
	deletePlacePhoto,
	fetchMyPlacePhotos,
	photoPagePath,
	placePhotoUrl,
} from "$lib/placePhotos";
import { session } from "$lib/session";
import { placesById } from "$lib/store";
import { errToast, successToast } from "$lib/utils";

import { goto } from "$app/navigation";
import type { PlaceImage } from "$types/btcmap-api/PlaceImage";

// "My photos": every photo the signed-in user uploaded, across places,
// newest first, each with a link to its place and a delete action (#1469).

const TILE_HEIGHT = 160;
const SOURCE: PlacePhotoSource = "my_photos";

let photos = $state<PlaceImage[]>([]);
let loading = $state(true);
let loadError = $state(false);
// The photo whose delete is waiting for confirmation, and the one in flight
let confirmingId = $state<number | null>(null);
let deletingId = $state<number | null>(null);

let timeLocale = $state<Locales>("en");
$effect(() => {
	const code = $locale;
	loadDayjsLocale(code).then((key) => {
		if ($locale === code) timeLocale = key;
	});
});

// Places come from the app-wide sync; a place that's gone (or not synced
// yet) still gets a readable label
const placeName = (placeId: number) =>
	$placesById.get(placeId)?.name ||
	$_("myPhotos.unknownPlace", { values: { id: placeId } });

const askDelete = (imageId: number) => {
	confirmingId = imageId;
	trackEvent("place_photo_delete_click", { source: SOURCE });
};

const confirmDelete = async (photo: PlaceImage) => {
	const token = $session?.token;
	if (!token || deletingId !== null) return;
	deletingId = photo.id;
	try {
		await deletePlacePhoto(photo.place_id, photo.id, token);
		photos = photos.filter((p) => p.id !== photo.id);
		trackEvent("place_photo_delete_success", { source: SOURCE });
		successToast($_("placePhotos.deleted"));
	} catch (error) {
		console.error("my photos: delete failed", error);
		errToast(
			isAxiosError(error) && error.response?.status === 403
				? $_("placePhotos.deleteForbidden")
				: $_("placePhotos.deleteFailed"),
		);
	} finally {
		deletingId = null;
		confirmingId = null;
	}
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
		<div class="flex justify-center">
			<div class="h-8 w-8 animate-spin rounded-full border-4 border-link border-t-transparent"></div>
		</div>
	{:else if loadError}
		<p class="text-center text-body dark:text-white/70">{$_("myPhotos.loadError")}</p>
	{:else if !photos.length}
		<p class="text-center text-lg text-body dark:text-white/70">{$_("myPhotos.empty")}</p>
	{:else}
		<ul role="list" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
			{#each photos as photo (photo.id)}
				<li class="overflow-hidden rounded-2xl border border-gray-300 dark:border-white/20 dark:bg-white/5">
					<a href={photoPagePath(photo.place_id, photo.id)} class="block bg-gray-200 dark:bg-white/10">
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
							href={photoPagePath(photo.place_id, photo.id)}
							class="block truncate text-sm font-semibold text-primary hover:text-link dark:text-white"
						>
							{placeName(photo.place_id)}
						</a>
						<p class="text-xs text-body dark:text-white/70">
							<Time timestamp={photo.created_at} relative locale={timeLocale} />
						</p>
						{#if confirmingId === photo.id}
							<div class="flex items-center gap-2">
								<button
									type="button"
									onclick={() => confirmDelete(photo)}
									disabled={deletingId === photo.id}
									class="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
								>
									{$_("placePhotos.deleteConfirmAction")}
								</button>
								<button
									type="button"
									onclick={() => (confirmingId = null)}
									class="rounded-lg px-3 py-1.5 text-xs font-semibold text-primary hover:bg-gray-100 dark:text-white dark:hover:bg-white/10"
								>
									{$_("placePhotos.cancel")}
								</button>
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

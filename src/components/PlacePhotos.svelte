<script lang="ts">
import { tick } from "svelte";
import { SvelteSet } from "svelte/reactivity";

import PhotoAuthPrompt from "$components/auth/PhotoAuthPrompt.svelte";
import Icon from "$components/Icon.svelte";
import PlacePhotoViewer from "$components/PlacePhotoViewer.svelte";
import { trackEvent } from "$lib/analytics";
import { _ } from "$lib/i18n";
import {
	fetchPlacePhotos,
	MAX_PHOTOS_PER_PICK,
	placePhotoUrl,
	prepareUpload,
	splitPick,
	uploadPlacePhoto,
	uploadPlacePhotos,
} from "$lib/placePhotos";
import { session } from "$lib/session";
import { errToast, successToast, warningToast } from "$lib/utils";

import type { PlaceImage } from "$types/btcmap-api/PlaceImage";

// Community photo strip for a place: exact-ratio boxes from the metadata,
// thumbnails fetched in parallel at tile size, a full-screen viewer, and an
// "Add photo" tile (#1469).
type Props = {
	placeId: number;
	// Tile height in CSS px; thumbnails are requested at 2x for HiDPI
	tileHeight?: number;
	// Deleted places keep their photos but take no new ones
	canAdd?: boolean;
	// Where the photo/add analytics events came from
	source: "merchant_page" | "map_drawer" | "area_drawer";
};

let { placeId, tileHeight = 112, canAdd = true, source }: Props = $props();

// undefined = loading, [] = none
let photos = $state<PlaceImage[] | undefined>(undefined);
let uploading = $state(0);
let viewerIndex = $state<number | null>(null);
let fileInput = $state<HTMLInputElement>();
let showAuthPrompt = $state(false);
let addButton = $state<HTMLButtonElement>();
let highlightAdd = $state(false);
const loadedIds = new SvelteSet<number>();

// The map drawer reuses this component across merchants, so refetch on
// every placeId change and drop answers for a place we already left.
$effect(() => {
	const id = placeId;
	photos = undefined;
	viewerIndex = null;
	fetchPlacePhotos(id)
		.then((list) => {
			if (id === placeId) photos = list;
		})
		.catch((error) => {
			console.error("place photos: failed to load", error);
			if (id === placeId) photos = [];
		});
});

// Keep odd panoramas and tall shots from blowing up the strip
const tileWidth = (photo: PlaceImage) =>
	Math.round(
		tileHeight * Math.min(1.8, Math.max(0.6, photo.width / photo.height)),
	);

const openViewer = (index: number) => {
	viewerIndex = index;
	trackEvent("place_photo_open", { source });
};

// Signed-out users sign in right here instead of leaving for /login, so
// they stay on the place they wanted to photograph.
const handleAddClick = () => {
	trackEvent("place_photo_add_click", { source, signedIn: !!$session });
	if ($session) fileInput?.click();
	else showAuthPrompt = true;
};

// Browsers may refuse the picker here since the click's user activation
// can expire during login. Undetectable, so also bring the Add tile into
// view, focus it and highlight it briefly: then it's one obvious tap away.
const handleAuthenticated = async () => {
	await tick();
	addButton?.scrollIntoView({ block: "nearest", inline: "nearest" });
	addButton?.focus({ preventScroll: true });
	highlightAdd = true;
	setTimeout(() => {
		highlightAdd = false;
	}, 4000);
	fileInput?.click();
};

const handleFiles = async (event: Event) => {
	const input = event.currentTarget as HTMLInputElement;
	const { batch, dropped } = splitPick(Array.from(input.files ?? []));
	input.value = "";
	if (dropped) {
		warningToast(
			$_("placePhotos.tooMany", { values: { max: MAX_PHOTOS_PER_PICK } }),
		);
	}
	const token = $session?.token;
	if (!batch.length || !token) return;

	const id = placeId;
	uploading += batch.length;
	const { stored, failed } = await uploadPlacePhotos(
		batch,
		async (file) => uploadPlacePhoto(id, token, await prepareUpload(file)),
		() => {
			uploading -= 1;
		},
	);

	if (stored.length) {
		if (id === placeId) photos = [...stored, ...(photos ?? [])];
		successToast(
			$_("placePhotos.uploaded", { values: { count: stored.length } }),
		);
		trackEvent("place_photo_add_success", { source, count: stored.length });
	}
	if (failed.length) {
		console.error("place photos: upload failed", failed);
		errToast(
			$_("placePhotos.uploadFailed", { values: { count: failed.length } }),
		);
	}
};
</script>

{#if photos === undefined}
	<div
		class="flex gap-2 overflow-hidden"
		style:--tile="{tileHeight}px"
		aria-hidden="true"
	>
		{#each [0, 1, 2] as i (i)}
			<div
				class="size-(--tile) shrink-0 animate-pulse rounded-xl bg-gray-200 dark:bg-white/10"
			></div>
		{/each}
	</div>
{:else if photos.length || canAdd}
	<section aria-label={$_('placePhotos.title')}>
		<div class="flex snap-x gap-2 overflow-x-auto pb-1" style:--tile="{tileHeight}px">
			{#each photos as photo, i (photo.id)}
				<button
					type="button"
					onclick={() => openViewer(i)}
					class="relative h-(--tile) shrink-0 snap-start overflow-hidden rounded-xl bg-gray-200 focus-visible:ring-2 focus-visible:ring-link dark:bg-white/10 {loadedIds.has(photo.id) ? '' : 'animate-pulse'}"
					style:width="{tileWidth(photo)}px"
					aria-label={$_('placePhotos.photoAlt', { values: { n: i + 1, total: photos.length } })}
				>
					<img
						src={placePhotoUrl(placeId, photo.id, { h: tileHeight * 2 })}
						alt=""
						loading="lazy"
						decoding="async"
						referrerpolicy="no-referrer"
						onload={() => loadedIds.add(photo.id)}
						class="h-full w-full object-cover transition-opacity duration-300 {loadedIds.has(photo.id) ? 'opacity-100' : 'opacity-0'}"
					/>
				</button>
			{/each}

			{#each { length: uploading } as _u, i (i)}
				<div
					class="flex size-(--tile) shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5"
					role="status"
					aria-label={$_('placePhotos.uploading')}
				>
					<span class="h-6 w-6 animate-spin rounded-full border-2 border-link border-t-transparent"></span>
				</div>
			{/each}

			{#if canAdd}
				<button
					bind:this={addButton}
					type="button"
					onclick={handleAddClick}
					class="flex h-(--tile) max-w-[calc(var(--tile)*1.4)] min-w-(--tile) shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-gray-300 px-3 text-center text-xs font-semibold text-link transition-colors hover:bg-link/5 dark:border-white/20 {highlightAdd ? 'animate-pulse bg-link/10 ring-2 ring-link' : ''}"
				>
					<Icon w="24" h="24" icon="add_a_photo" type="material" />
					{photos.length ? $_('placePhotos.add') : $_('placePhotos.addFirst')}
				</button>
				<!-- An explicit list, not image/*: iOS then hands over HEIC photos
				     converted to JPEG, while image/* can pass HEIC through, which
				     createImageBitmap can't decode in Chrome/Firefox. Mobile
				     browsers still offer the camera with this list. -->
				<input
					bind:this={fileInput}
					type="file"
					accept="image/jpeg,image/png,image/webp"
					multiple
					class="hidden"
					onchange={handleFiles}
				/>
			{/if}
		</div>
	</section>
{/if}

{#if photos?.length && viewerIndex !== null}
	<PlacePhotoViewer
		{placeId}
		{photos}
		startIndex={viewerIndex}
		onClose={() => (viewerIndex = null)}
	/>
{/if}

{#if canAdd}
	<PhotoAuthPrompt bind:open={showAuthPrompt} onAuthenticated={handleAuthenticated} />
{/if}

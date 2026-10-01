<script lang="ts">
import { SvelteSet } from "svelte/reactivity";

import Icon from "$components/Icon.svelte";
import PlacePhotoViewer from "$components/PlacePhotoViewer.svelte";
import { trackEvent } from "$lib/analytics";
import { _ } from "$lib/i18n";
import type { PlacePhoto } from "$lib/placePhotos";
import {
	fetchPlacePhotos,
	placePhotoUrl,
	prepareUpload,
	uploadPlacePhoto,
} from "$lib/placePhotos";
import { session } from "$lib/session";
import { errToast, successToast } from "$lib/utils";

import { resolve } from "$app/paths";

// Community photo strip for a place: exact-ratio boxes from the metadata,
// thumbnails fetched in parallel at tile size, a full-screen viewer, and an
// "Add photo" tile for signed-in users (#1469).
type Props = {
	placeId: number;
	// Tile height in CSS px; thumbnails are requested at 2x for HiDPI
	tileHeight?: number;
	// Deleted places keep their photos but take no new ones
	canAdd?: boolean;
	// Where the photo/add analytics events came from
	source: "merchant_page" | "map_drawer";
};

let { placeId, tileHeight = 112, canAdd = true, source }: Props = $props();

const MAX_FILES_PER_PICK = 5;

// undefined = loading, [] = none
let photos = $state<PlacePhoto[] | undefined>(undefined);
let uploading = $state(0);
let viewerIndex = $state<number | null>(null);
let fileInput = $state<HTMLInputElement>();
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
const tileWidth = (photo: PlacePhoto) =>
	Math.round(
		tileHeight * Math.min(1.8, Math.max(0.6, photo.width / photo.height)),
	);

const openViewer = (index: number) => {
	viewerIndex = index;
	trackEvent("place_photo_open", { source });
};

const pickFiles = () => {
	trackEvent("place_photo_add_click", { source });
	fileInput?.click();
};

const handleFiles = async (event: Event) => {
	const input = event.currentTarget as HTMLInputElement;
	const files = Array.from(input.files ?? []).slice(0, MAX_FILES_PER_PICK);
	input.value = "";
	const token = $session?.token;
	if (!files.length || !token) return;

	const id = placeId;
	uploading += files.length;
	const results = await Promise.allSettled(
		files.map(async (file) => {
			try {
				return await uploadPlacePhoto(id, token, await prepareUpload(file));
			} finally {
				uploading -= 1;
			}
		}),
	);

	const stored = results.flatMap((r) =>
		r.status === "fulfilled" ? [r.value] : [],
	);
	const failed = results.length - stored.length;
	if (stored.length) {
		if (id === placeId) photos = [...stored.reverse(), ...(photos ?? [])];
		successToast(
			$_("placePhotos.uploaded", { values: { count: stored.length } }),
		);
		trackEvent("place_photo_add_success", { source, count: stored.length });
	}
	if (failed) {
		console.error("place photos: upload failed", results);
		errToast($_("placePhotos.uploadFailed", { values: { count: failed } }));
	}
};
</script>

{#if photos === undefined}
	<div class="flex gap-2 overflow-hidden" aria-hidden="true">
		{#each [0, 1, 2] as i (i)}
			<div
				class="shrink-0 animate-pulse rounded-xl bg-gray-200 dark:bg-white/10"
				style:height="{tileHeight}px"
				style:width="{tileHeight}px"
			></div>
		{/each}
	</div>
{:else if photos.length || canAdd}
	<section aria-label={$_('placePhotos.title')}>
		<div class="flex snap-x gap-2 overflow-x-auto pb-1">
			{#each photos as photo, i (photo.id)}
				<button
					type="button"
					onclick={() => openViewer(i)}
					class="relative shrink-0 snap-start overflow-hidden rounded-xl bg-gray-200 focus-visible:ring-2 focus-visible:ring-link dark:bg-white/10 {loadedIds.has(photo.id) ? '' : 'animate-pulse'}"
					style:height="{tileHeight}px"
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
					class="flex shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5"
					style:height="{tileHeight}px"
					style:width="{tileHeight}px"
					role="status"
					aria-label={$_('placePhotos.uploading')}
				>
					<span class="h-6 w-6 animate-spin rounded-full border-2 border-link border-t-transparent"></span>
				</div>
			{/each}

			{#if canAdd}
				{@const addLabel = photos.length ? $_('placePhotos.add') : $_('placePhotos.addFirst')}
				{#if $session}
					<button
						type="button"
						onclick={pickFiles}
						class="flex shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-gray-300 px-3 text-center text-xs font-semibold text-link transition-colors hover:bg-link/5 dark:border-white/20"
						style:height="{tileHeight}px"
						style:min-width="{tileHeight}px"
					>
						<Icon w="24" h="24" icon="add_a_photo" type="material" />
						{addLabel}
					</button>
					<input
						bind:this={fileInput}
						type="file"
						accept="image/jpeg,image/png,image/webp"
						multiple
						class="hidden"
						onchange={handleFiles}
					/>
				{:else}
					<a
						href={resolve('/login')}
						onclick={() => trackEvent("place_photo_add_click", { source, signedIn: false })}
						class="flex shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-gray-300 px-3 text-center text-xs font-semibold text-link transition-colors hover:bg-link/5 dark:border-white/20"
						style:height="{tileHeight}px"
						style:min-width="{tileHeight}px"
						style:max-width="{tileHeight * 1.4}px"
					>
						<Icon w="24" h="24" icon="add_a_photo" type="material" />
						{photos.length ? $_('placePhotos.loginToAdd') : addLabel}
					</a>
				{/if}
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

<script lang="ts">
import { tick } from "svelte";
import { SvelteSet } from "svelte/reactivity";

import PhotoAuthPrompt from "$components/auth/PhotoAuthPrompt.svelte";
import Icon from "$components/Icon.svelte";
import PlacePhotoViewer from "$components/PlacePhotoViewer.svelte";
import { trackEvent } from "$lib/analytics";
import { _ } from "$lib/i18n";
import type { PlacePhotoSource } from "$lib/placePhotos";
import {
	deepLinkTarget,
	fetchPlacePhotos,
	MAX_PHOTOS_PER_PICK,
	photoPagePath,
	placePhotoUrl,
	prepareUpload,
	splitPick,
	uploadPlacePhoto,
	uploadPlacePhotos,
	withPhotoParam,
} from "$lib/placePhotos";
import { session } from "$lib/session";
import { errToast, successToast, warningToast } from "$lib/utils";

import type { PlaceImage } from "$types/btcmap-api/PlaceImage";

// Community photo strip for a place: a "Photos N · Add photo" header,
// exact-ratio thumbnails fetched in parallel at tile size, a full-screen
// viewer, and a one-row invitation when there are no photos yet (#1469).
type Props = {
	placeId: number;
	// Shown in the viewer's caption, so a shared photo says where it is
	placeName: string;
	// page: 112px tiles at the photo's ratio, full-bleed on mobile.
	// drawer: square 88px tiles, plus a scroll chevron on pointer devices.
	layout?: "page" | "drawer";
	// Deleted places keep their photos but take no new ones
	canAdd?: boolean;
	// Where the photo/add analytics events came from
	source: PlacePhotoSource;
};

let {
	placeId,
	placeName,
	layout = "page",
	canAdd = true,
	source,
}: Props = $props();

const tileHeight = $derived(layout === "drawer" ? 88 : 112);

// undefined = loading, [] = none
let photos = $state<PlaceImage[] | undefined>(undefined);
let uploading = $state(0);
let viewerIndex = $state<number | null>(null);
let fileInput = $state<HTMLInputElement>();
let strip = $state<HTMLDivElement>();
const tileEls: HTMLAnchorElement[] = $state([]);
let canScrollMore = $state(false);
let showAuthPrompt = $state(false);
let addButton = $state<HTMLButtonElement>();
let highlightAdd = $state(false);
// Briefly marks whichever add control is on screen after sign-in
const HIGHLIGHT_ADD_CLASS = "animate-pulse bg-link/10 ring-2 ring-link";
const loadedIds = new SvelteSet<number>();

// The map drawer reuses this component across merchants, so refetch on
// every placeId change and drop answers for a place we already left.
$effect(() => {
	const id = placeId;
	photos = undefined;
	viewerIndex = null;
	fetchPlacePhotos(id)
		.then((list) => {
			if (id !== placeId) return;
			photos = list;
			openFromDeepLink(list);
		})
		.catch((error) => {
			console.error("place photos: failed to load", error);
			if (id === placeId) photos = [];
		});
});

// Keep odd panoramas and tall shots from blowing up the strip; the drawer
// uses square tiles for an even rhythm in its narrow column
const tileWidth = (photo: PlaceImage) =>
	layout === "drawer"
		? tileHeight
		: Math.round(
				tileHeight * Math.min(1.8, Math.max(0.6, photo.width / photo.height)),
			);

const updateCanScrollMore = () => {
	if (!strip) return;
	canScrollMore = strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1;
};

// Re-measure when the tiles change or the strip resizes
$effect(() => {
	void photos?.length;
	void uploading;
	if (!strip) return;
	updateCanScrollMore();
	const observer = new ResizeObserver(updateCanScrollMore);
	observer.observe(strip);
	return () => observer.disconnect();
});

const scrollMore = () => {
	trackEvent("place_photo_strip_scroll", { source });
	strip?.scrollBy({ left: strip.clientWidth * 0.8, behavior: "smooth" });
};

// Mirror the shown photo in ?photo=<id> without a navigation. Plain
// history.replaceState like the map's own hash writer ($lib/map/mapHash),
// so SvelteKit's page store doesn't re-run the drawer's URL logic.
const syncPhotoParam = (imageId: number | null) => {
	history.replaceState(
		history.state,
		"",
		withPhotoParam(window.location.href, imageId),
	);
};

const openViewer = (index: number, via: "tile" | "deeplink" = "tile") => {
	viewerIndex = index;
	trackEvent("place_photo_open", { source, index, via });
	if (photos?.[index]) syncPhotoParam(photos[index].id);
};

// Focus the tile of the photo that was on screen: works for deep-link
// opens too, and on macOS Safari, where a click doesn't focus the button
// Plain left clicks open the viewer in place; modified clicks (new tab or
// window) stay with the browser. Capture phase, on the element itself, so
// preventDefault lands before SvelteKit's link router sees the click.
const handleTileClick = (event: MouseEvent, index: number) => {
	if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
	event.preventDefault();
	openViewer(index);
};

const closeViewer = async (index: number) => {
	// Already reset by a place switch in the reused drawer: the old viewer's
	// late close must not pull focus to the new place's tiles
	if (viewerIndex === null) return;
	viewerIndex = null;
	syncPhotoParam(null);
	await tick();
	tileEls[index]?.focus();
};

// ?photo=<id> opens the viewer once the photos are in. An id that isn't
// one of this place's public photos is ignored and dropped from the URL.
const openFromDeepLink = (list: PlaceImage[]) => {
	const target = deepLinkTarget(list, window.location.search);
	if (!target) return;
	if ("stale" in target) syncPhotoParam(null);
	else openViewer(target.index, "deeplink");
};

// Signed-out users sign in right here instead of leaving for /login, so
// they stay on the place they wanted to photograph.
const handleAddClick = (entry: "header" | "empty") => {
	trackEvent("place_photo_add_click", {
		source,
		entry,
		signedIn: !!$session,
	});
	if ($session) fileInput?.click();
	else showAuthPrompt = true;
};

// Browsers may refuse the picker here since the click's user activation
// can expire during login. Undetectable, so also bring the Add button into
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
{:else if photos.length || uploading}
	<section aria-labelledby="place-photos-{placeId}-{layout}">
		<div class="mb-2 flex items-center justify-between gap-3">
			<span
				id="place-photos-{placeId}-{layout}"
				class="flex items-baseline gap-1.5 text-xs text-mapLabel dark:text-white/70"
			>
				{$_('placePhotos.title')}
				<span class="tabular-nums">{photos.length}</span>
			</span>
			{#if canAdd}
				<button
					bind:this={addButton}
					type="button"
					onclick={() => handleAddClick('header')}
					class="-mx-2 -my-1.5 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-link transition-colors hover:bg-link/10 {highlightAdd ? HIGHLIGHT_ADD_CLASS : ''}"
				>
					<Icon w="20" h="20" icon="add_a_photo" type="material" />
					{$_('placePhotos.add')}
				</button>
			{/if}
		</div>

		<div class="relative">
			<div
				bind:this={strip}
				onscroll={updateCanScrollMore}
				class="flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden {layout === 'page' ? '-mx-4 scroll-px-4 px-4 lg:mx-0 lg:scroll-px-0 lg:px-0' : ''}"
				style:--tile="{tileHeight}px"
			>
				<!-- Uploads in progress sit first, where the new photos will land -->
				{#each { length: uploading } as _placeholder, i (i)}
					<div
						class="flex size-(--tile) shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5"
						role="status"
						aria-label={$_('placePhotos.uploading')}
					>
						<span class="h-6 w-6 animate-spin rounded-full border-2 border-link border-t-transparent"></span>
					</div>
				{/each}

				<!-- role="list": Tailwind's list-style: none makes Safari/VoiceOver drop
				     the implicit list role, and with it "list, 6 items" -->
				<ul role="list" class="flex gap-2">
					{#each photos as photo, i (photo.id)}
						<li class="shrink-0 snap-start">
							<!-- A link: the tile has a real URL (the merchant page with this
							     photo open), so new-tab clicks and "Copy link" just work;
							     plain clicks open the viewer in place -->
							<a
								href={photoPagePath(placeId, photo.id)}
								bind:this={tileEls[i]}
								onclickcapture={(event) => handleTileClick(event, i)}
								class="relative block h-(--tile) overflow-hidden rounded-xl bg-gray-200 focus-visible:ring-2 focus-visible:ring-link dark:bg-white/10 {loadedIds.has(photo.id) ? '' : 'animate-pulse'}"
								style:width="{tileWidth(photo)}px"
								aria-haspopup="dialog"
							>
								<!-- The alt names the button: it survives translation tools and
								     shows if the image fails -->
								<img
									src={placePhotoUrl(placeId, photo.id, { h: tileHeight * 2 })}
									alt={$_('placePhotos.photoAlt', { values: { n: i + 1, total: photos.length } })}
									loading="lazy"
									decoding="async"
									referrerpolicy="no-referrer"
									onload={() => loadedIds.add(photo.id)}
									onerror={() => loadedIds.add(photo.id)}
									class="h-full w-full object-cover transition-opacity duration-300 {loadedIds.has(photo.id) ? 'opacity-100' : 'opacity-0'}"
								/>
							</a>
						</li>
					{/each}
				</ul>
			</div>

			{#if layout === 'drawer' && canScrollMore}
				<!-- Pointer devices only: touch users swipe, and a fade over a
				     swipeable strip would just hide part of a photo -->
				<div class="pointer-events-none absolute inset-y-0 right-0 hidden w-12 bg-gradient-to-r from-transparent to-white pointer-fine:block dark:to-dark"></div>
				<button
					type="button"
					onclick={scrollMore}
					class="absolute top-1/2 right-1 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-gray-300 bg-white text-primary shadow-md pointer-fine:flex dark:border-white/20 dark:bg-dark dark:text-white"
					aria-label={$_('placePhotos.morePhotos')}
				>
					<Icon w="20" h="20" icon="chevron_right" type="material" />
				</button>
			{/if}
		</div>
	</section>
{:else if canAdd}
	<button
		bind:this={addButton}
		type="button"
		onclick={() => handleAddClick('empty')}
		class="flex w-full items-center gap-3 rounded-2xl border border-dashed border-gray-300 px-3.5 py-3 text-left transition-colors hover:border-link hover:bg-link/5 dark:border-white/20 {highlightAdd ? HIGHLIGHT_ADD_CLASS : ''}"
	>
		<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-link dark:bg-white/10">
			<Icon w="20" h="20" icon="add_a_photo" type="material" />
		</span>
		<span class="min-w-0">
			<span class="block text-[15px] leading-5 font-semibold text-link">{$_('placePhotos.emptyTitle')}</span>
			<span class="block text-[13px] leading-[18px] text-body dark:text-white/70">{$_('placePhotos.emptyHint')}</span>
		</span>
	</button>
{/if}

{#if canAdd}
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

{#if photos?.length && viewerIndex !== null}
	<PlacePhotoViewer
		{placeId}
		{placeName}
		{photos}
		startIndex={viewerIndex}
		thumbHeight={tileHeight}
		{source}
		onIndexChange={(i) => syncPhotoParam(photos?.[i]?.id ?? null)}
		onClose={closeViewer}
	/>
{/if}

{#if canAdd}
	<PhotoAuthPrompt bind:open={showAuthPrompt} onAuthenticated={handleAuthenticated} />
{/if}

<script lang="ts">
import { tick } from "svelte";
import { SvelteSet } from "svelte/reactivity";
import Time from "svelte-time";

import { trackEvent } from "#lib/analytics.js";
import { createTimeLocale } from "#lib/dayjsLocale.js";
import { _, locale } from "#lib/i18n/index.js";
import type { PlacePhotoSource, StripScrollState } from "#lib/placePhotos.js";
import {
	deepLinkTarget,
	fetchPlacePhotos,
	MAX_PHOTOS_PER_PICK,
	photoAuthorName,
	photoPagePath,
	placePhotoUrl,
	prepareUpload,
	splitPick,
	stripScrollState,
	undoUploads,
	uploadPlacePhoto,
	uploadPlacePhotos,
	withPhotoParam,
} from "#lib/placePhotos.js";
import { session } from "#lib/session.js";
import { errToast, successToast, warningToast } from "#lib/utils.js";
import PhotoAuthPrompt from "$components/auth/PhotoAuthPrompt.svelte";
import Icon from "$components/Icon.svelte";
import PlacePhotoViewer from "$components/PlacePhotoViewer.svelte";

import type { PlaceImage } from "$types/btcmap-api/PlaceImage";

// Community photo strip for a place: a "Photos N · Add photo" header,
// exact-ratio thumbnails fetched in parallel at tile size, a full-screen
// viewer, and a one-row invitation when there are no photos yet (#1469).
type Props = {
	placeId: number;
	// Shown in the viewer's caption, so a shared photo says where it is
	placeName: string;
	// page: 112px tiles at the photo's ratio, full-bleed on mobile.
	// drawer: square 88px tiles. Both get scroll chevrons on pointer devices.
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
let scrollState = $state<StripScrollState>({
	canScrollBack: false,
	canScrollForward: false,
});
let showAuthPrompt = $state(false);
let addButton = $state<HTMLButtonElement>();
let highlightAdd = $state(false);
// Briefly marks whichever add control is on screen after sign-in
const HIGHLIGHT_ADD_CLASS = "animate-pulse bg-link/10 ring-2 ring-link";
const loadedIds = new SvelteSet<number>();
// Hover captions' relative date, in the app's language
const timeLocale = createTimeLocale(locale);

// The map drawer reuses this component across merchants, so refetch on
// every placeId change and drop answers for a place we already left.
// Through a $derived: a legacy parent's prop getter (placeId={merchant.id})
// makes every refresh of its merchant object a dependency, and re-running
// on the same id would close an open viewer (e.g. a ?photo= deep link).
const currentPlaceId = $derived(placeId);
$effect(() => {
	const id = currentPlaceId;
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

const updateScrollState = () => {
	if (strip) scrollState = stripScrollState(strip);
};

// Re-measure when the tiles change or the strip resizes
$effect(() => {
	void photos?.length;
	void uploading;
	if (!strip) return;
	updateScrollState();
	const observer = new ResizeObserver(updateScrollState);
	observer.observe(strip);
	return () => observer.disconnect();
});

// The edge fades blend into what's behind the strip: the drawer's white
// panel, or the page's teal background
const fadeTo = $derived(
	layout === "drawer" ? "to-white dark:to-dark" : "to-teal dark:to-dark",
);

const scrollStrip = (direction: "back" | "forward") => {
	trackEvent("place_photo_strip_scroll", { source, direction });
	const step = (strip?.clientWidth ?? 0) * 0.8;
	strip?.scrollBy({
		left: direction === "forward" ? step : -step,
		behavior: "smooth",
	});
};

// Mirror the shown photo in ?photo=<id> without a navigation. Plain
// history.replaceState like the map's own hash writer (src/lib/map/mapHash.ts),
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

// Plain left clicks open the viewer in place; modified clicks (new tab or
// window) stay with the browser. Capture phase, on the element itself, so
// preventDefault lands before SvelteKit's link router sees the click.
const handleTileClick = (event: MouseEvent, index: number) => {
	if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
	event.preventDefault();
	openViewer(index);
};

// Focus the tile of the photo that was on screen: works for deep-link
// opens too, and on macOS Safari, where a click doesn't focus the link
const closeViewer = async (index: number) => {
	// Already reset by a place switch in the reused drawer: the old viewer's
	// late close must not pull focus to the new place's tiles
	if (viewerIndex === null) return;
	viewerIndex = null;
	syncPhotoParam(null);
	await tick();
	tileEls[index]?.focus();
};

// A photo deleted from the viewer: drop it, close the viewer, and focus the
// tile that took its place (or the new last one)
const handlePhotoDeleted = async (imageId: number, index: number) => {
	// Stale: the drawer switched place while the delete was in flight. The
	// old viewer's callback must not touch the new place's URL or focus.
	if (viewerIndex === null || !photos?.some((p) => p.id === imageId)) return;
	photos = photos.filter((p) => p.id !== imageId);
	viewerIndex = null;
	syncPhotoParam(null);
	await tick();
	// No photos left: the empty-state add button takes the focus
	if (photos.length) tileEls[Math.min(index, photos.length - 1)]?.focus();
	else addButton?.focus();
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

// "Undo" on the upload toast: an accidental upload is one tap from gone
const undoUpload = async (id: number, stored: PlaceImage[], token: string) => {
	trackEvent("place_photo_upload_undo_click", { source, count: stored.length });
	// The toast sits above the viewer: close it first so its photo list
	// can't change underneath it
	if (id === placeId && viewerIndex !== null) {
		viewerIndex = null;
		syncPhotoParam(null);
	}
	const { removed, complete } = await undoUploads(
		id,
		stored.map((p) => p.id),
		token,
	);
	if (id === placeId) {
		photos = (photos ?? []).filter((p) => !removed.includes(p.id));
	}
	if (complete) {
		trackEvent("place_photo_upload_undo_success", {
			source,
			count: removed.length,
		});
		successToast(
			$_("placePhotos.undone", { values: { count: removed.length } }),
		);
	} else {
		errToast($_("placePhotos.deleteFailed"));
	}
};

// New tiles land at the start of the strip, but scroll snapping re-snaps to
// the tile that was already snapped and pushes them out of view: bring the
// start back so the spinner, and then the new photo, are seen
const showStripStart = async () => {
	await tick();
	strip?.scrollTo({ left: 0 });
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
	showStripStart();
	const { stored, failed } = await uploadPlacePhotos(
		batch,
		async (file) => uploadPlacePhoto(id, token, await prepareUpload(file)),
		() => {
			uploading -= 1;
		},
	);

	if (stored.length) {
		if (id === placeId) {
			photos = [...stored, ...(photos ?? [])];
			showStripStart();
		}
		successToast(
			$_("placePhotos.uploaded", { values: { count: stored.length } }),
			{
				label: $_("placePhotos.undo"),
				onClick: () => undoUpload(id, stored, token),
			},
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
				class="size-(--tile) shrink-0 animate-pulse rounded-xl bg-link/20 dark:bg-white/10"
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
				onscroll={updateScrollState}
				class="flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden {layout === 'page' ? '-mx-4 scroll-px-4 px-4 lg:mx-0 lg:scroll-px-0 lg:px-0' : ''}"
				style:--tile="{tileHeight}px"
			>
				<!-- Uploads in progress sit first, where the new photos will land -->
				{#each { length: uploading } as _placeholder, i (i)}
					<div
						class="flex size-(--tile) shrink-0 snap-start items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5"
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
								class="group relative block h-(--tile) overflow-hidden rounded-xl bg-link/20 focus-visible:ring-2 focus-visible:ring-link dark:bg-white/10 {loadedIds.has(photo.id) ? '' : 'animate-pulse'}"
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
								<!-- Hover/focus caption, like the viewer's credit line. aria-hidden:
								     the alt already names the link -->
								<span
									aria-hidden="true"
									class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pt-4 pb-1.5 text-[11px] leading-tight text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
								>
									<!-- The drawer's 88px tile has room for the name alone -->
									<span class="block truncate font-semibold">
										{#if !photoAuthorName(photo)}
											{$_('placePhotos.communityPhoto')}
										{:else if layout === 'drawer'}
											{photoAuthorName(photo)}
										{:else}
											{$_('placePhotos.credit', { values: { name: photoAuthorName(photo) } })}
										{/if}
									</span>
									{#if layout === 'page'}
										<span class="block truncate text-white/80">
											<Time timestamp={photo.created_at} relative locale={$timeLocale} />
										</span>
									{/if}
								</span>
							</a>
						</li>
					{/each}
				</ul>
			</div>

			<!-- Pointer devices only: touch users swipe, and a fade over a
			     swipeable strip would just hide part of a photo -->
			{#if scrollState.canScrollBack}
				<div class="pointer-events-none absolute inset-y-0 left-0 hidden w-12 bg-gradient-to-l from-transparent pointer-fine:block {fadeTo}"></div>
				<button
					type="button"
					onclick={() => scrollStrip('back')}
					class="absolute top-1/2 left-1 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-gray-300 bg-white text-primary shadow-md pointer-fine:flex dark:border-white/20 dark:bg-dark dark:text-white"
					aria-label={$_('placePhotos.previousPhotos')}
				>
					<Icon w="20" h="20" icon="chevron_left" type="material" />
				</button>
			{/if}
			{#if scrollState.canScrollForward}
				<div class="pointer-events-none absolute inset-y-0 right-0 hidden w-12 bg-gradient-to-r from-transparent pointer-fine:block {fadeTo}"></div>
				<button
					type="button"
					onclick={() => scrollStrip('forward')}
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
		onDeleted={handlePhotoDeleted}
	/>
{/if}

{#if canAdd}
	<PhotoAuthPrompt bind:open={showAuthPrompt} onAuthenticated={handleAuthenticated} />
{/if}

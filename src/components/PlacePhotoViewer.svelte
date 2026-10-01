<script lang="ts">
import { onDestroy, onMount, untrack } from "svelte";
import { OutClick } from "svelte-outclick";
import type { Locales } from "svelte-time";
import Time from "svelte-time";

import Icon from "$components/Icon.svelte";
import { trackEvent } from "$lib/analytics";
import { lockBodyScroll, unlockBodyScroll } from "$lib/bodyScrollLock";
import { loadDayjsLocale } from "$lib/dayjsLocale";
import { trapTab } from "$lib/focusTrap";
import { _, locale } from "$lib/i18n";
import type { LightboxHandle } from "$lib/placePhotoLightbox";
import { buildSlides, openPlaceLightbox } from "$lib/placePhotoLightbox";
import type { PlacePhotoSource } from "$lib/placePhotos";
import { photoShareUrl, placePhotoUrl } from "$lib/placePhotos";
import { errToast, successToast } from "$lib/utils";

import type { PlaceImage } from "$types/btcmap-api/PlaceImage";

// Full-screen photo viewer (#1469). PhotoSwipe renders the image stage
// (swipe, pinch/zoom, swipe-down to close) through $lib/placePhotoLightbox;
// this component owns the chrome: caption bar, arrows, filmstrip/dots,
// keyboard and focus.
type Props = {
	placeId: number;
	placeName: string;
	photos: PlaceImage[];
	startIndex: number;
	// Strip tile height, so the filmstrip reuses the already cached thumbnails
	thumbHeight: number;
	source: PlacePhotoSource;
	// Keeps ?photo=<id> in the URL in step with the shown photo
	onIndexChange: (index: number) => void;
	// Gets the index on screen at close, so the strip can focus that tile
	onClose: (index: number) => void;
};

let {
	placeId,
	placeName,
	photos,
	startIndex,
	thumbHeight,
	source,
	onIndexChange,
	onClose,
}: Props = $props();

// Dots replace the counter on mobile up to this many photos
const MAX_DOTS = 8;

let index = $state(untrack(() => startIndex));
const photo = $derived(photos[index]);

// Relative date in the app's language; English until its dayjs locale loads
let timeLocale = $state<Locales>("en");
$effect(() => {
	const code = $locale;
	loadDayjsLocale(code).then((key) => {
		if ($locale === code) timeLocale = key;
	});
});

const total = $derived(photos.length);

let rootEl = $state<HTMLDivElement>();
let stageEl = $state<HTMLDivElement>();
let closeButton = $state<HTMLButtonElement>();
let menuOpen = $state(false);
let handle: LightboxHandle | undefined;
let destroyed = false;
// place_photo_open already covers the first photo; views count the ones
// reached by swiping/arrows, once each per open
const viewed = new Set<number>([untrack(() => startIndex)]);

const trackView = (i: number) => {
	if (viewed.has(i)) return;
	viewed.add(i);
	trackEvent("place_photo_view", { source, index: i });
};

const goTo = (i: number) => {
	if (i < 0 || i >= total || i === index) return;
	handle?.goTo(i);
};

const toggleMenu = () => {
	menuOpen = !menuOpen;
	if (menuOpen) trackEvent("place_photo_menu_open", { source });
};

const copyLink = async () => {
	menuOpen = false;
	try {
		await navigator.clipboard.writeText(
			photoShareUrl(window.location.origin, placeId, photo.id),
		);
		successToast($_("placePhotos.linkCopied"));
		trackEvent("place_photo_link_copy", { source });
	} catch (error) {
		console.error("place photos: copy link failed", error);
		errToast($_("placePhotos.copyLinkFailed"));
	}
};

// Animate out through PhotoSwipe; its destroy event then calls onClose
const close = () => {
	if (handle) handle.close();
	else onClose(index);
};

// Capture phase + stopPropagation for every key while open: the map drawers
// react to bubbling window keydowns (Escape closes, ↑ ↓ Enter resize the
// mobile sheet), and PhotoSwipe's own key handling is off.
const handleKeydown = (event: KeyboardEvent) => {
	event.stopPropagation();
	if (event.key === "Escape") {
		event.preventDefault();
		// The open menu closes first, the viewer on the next Escape
		if (menuOpen) menuOpen = false;
		else close();
	} else if (event.key === "ArrowRight") {
		event.preventDefault();
		goTo(index + 1);
	} else if (event.key === "ArrowLeft") {
		event.preventDefault();
		goTo(index - 1);
	} else if (rootEl) {
		trapTab(event, rootEl);
	}
};

// Render at the end of <body>: the map drawer is position-fixed with its
// own stacking context, which would trap a fixed overlay inside it.
const portal = (node: HTMLElement) => {
	document.body.appendChild(node);
	return { destroy: () => node.remove() };
};

onMount(() => {
	lockBodyScroll();
	closeButton?.focus();

	if (!stageEl) return;
	const pointerFine = window.matchMedia("(pointer: fine)").matches;
	openPlaceLightbox({
		slides: buildSlides(placeId, photos, (i, n) =>
			$_("placePhotos.photoAlt", { values: { n: i + 1, total: n } }),
		),
		startIndex: index,
		container: stageEl,
		sidePadding: pointerFine ? 72 : 0,
		reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
			.matches,
		onChange: (i) => {
			index = i;
			menuOpen = false;
			trackView(i);
			onIndexChange(i);
		},
		onDestroy: () => {
			handle = undefined;
			onClose(index);
		},
	})
		.then((h) => {
			// Closed before the library finished loading
			if (destroyed) h.destroy();
			else handle = h;
		})
		.catch((error) => {
			console.error("place photos: viewer failed to load", error);
			onClose(index);
		});
});

onDestroy(() => {
	destroyed = true;
	// Parent unmounted us directly (e.g. the drawer switched place)
	handle?.destroy();
	unlockBodyScroll();
});
</script>

<svelte:window onkeydowncapture={handleKeydown} />

<div
	use:portal
	bind:this={rootEl}
	role="dialog"
	aria-modal="true"
	aria-label={$_('placePhotos.title')}
	class="fixed inset-0 z-[3000] flex flex-col bg-dark text-white"
>
	<div class="flex items-start gap-3 pt-[max(0.875rem,env(safe-area-inset-top))] pr-3.5 pb-2.5 pl-4 md:pl-5">
		<div class="min-w-0 flex-1">
			<p class="truncate text-[15px] leading-5 font-bold">{placeName}</p>
			<p class="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] leading-[18px] text-white/80">
				<span>{$_('placePhotos.communityPhoto')}</span>
				<span aria-hidden="true">·</span>
				<!-- live keeps "a few seconds ago" current while the viewer is open -->
				<Time timestamp={photo.created_at} relative live locale={timeLocale} />
			</p>
		</div>
		<span
			class="text-[13px] leading-10 whitespace-nowrap text-white/80 tabular-nums {total <= MAX_DOTS ? 'hidden md:inline' : ''}"
		>
			{index + 1} / {total}
		</span>
		<OutClick onOutClick={() => (menuOpen = false)}>
			<div class="relative">
				<button
					type="button"
					onclick={toggleMenu}
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white {menuOpen ? 'bg-white/12' : ''}"
					aria-label={$_('placePhotos.moreActions')}
					aria-haspopup="menu"
					aria-expanded={menuOpen}
				>
					<Icon w="24" h="24" icon="more_vert" type="material" />
				</button>
				{#if menuOpen}
					<div
						role="menu"
						class="absolute top-11 right-0 z-20 min-w-[200px] rounded-xl bg-white p-1.5 text-primary shadow-[0_10px_30px_rgba(0,0,0,0.35)] dark:bg-dark dark:text-white dark:ring-1 dark:ring-white/15"
					>
						<button
							type="button"
							role="menuitem"
							onclick={copyLink}
							class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-white/10"
						>
							<Icon w="20" h="20" icon="link" type="material" class="text-body dark:text-white/70" />
							{$_('placePhotos.copyLink')}
						</button>
					</div>
				{/if}
			</div>
		</OutClick>
		<button
			bind:this={closeButton}
			type="button"
			onclick={close}
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white"
			aria-label={$_('placePhotos.close')}
		>
			<Icon w="24" h="24" icon="close" type="material" />
		</button>
	</div>

	<div class="relative min-h-0 flex-1">
		<div bind:this={stageEl} class="absolute inset-0"></div>

		{#if total > 1}
			<!-- Pointer devices only: touch users swipe -->
			<button
				type="button"
				onclick={() => goTo(index - 1)}
				disabled={index === 0}
				class="group absolute inset-y-0 left-0 z-10 hidden w-[72px] items-center justify-center disabled:cursor-default disabled:opacity-25 pointer-fine:flex"
				aria-label={$_('placePhotos.previous')}
			>
				<span class="flex h-11 w-11 items-center justify-center rounded-full bg-white/12 group-enabled:group-hover:bg-white/20">
					<Icon w="28" h="28" icon="chevron_left" type="material" />
				</span>
			</button>
			<button
				type="button"
				onclick={() => goTo(index + 1)}
				disabled={index === total - 1}
				class="group absolute inset-y-0 right-0 z-10 hidden w-[72px] items-center justify-center disabled:cursor-default disabled:opacity-25 pointer-fine:flex"
				aria-label={$_('placePhotos.next')}
			>
				<span class="flex h-11 w-11 items-center justify-center rounded-full bg-white/12 group-enabled:group-hover:bg-white/20">
					<Icon w="28" h="28" icon="chevron_right" type="material" />
				</span>
			</button>
		{/if}
	</div>

	{#if total > 1}
		<!-- Desktop: filmstrip from the strip's cached thumbnails -->
		<div class="hidden justify-center gap-1.5 overflow-x-auto p-3.5 md:flex">
			{#each photos as thumb, i (thumb.id)}
				<button
					type="button"
					onclick={() => goTo(i)}
					class="h-13 w-13 shrink-0 overflow-hidden rounded-lg bg-white/10 transition-opacity {i === index ? 'opacity-100 outline-2 outline-offset-2 outline-white' : 'opacity-50 hover:opacity-80'}"
					aria-label={$_('placePhotos.photoAlt', { values: { n: i + 1, total } })}
					aria-current={i === index ? 'true' : undefined}
				>
					<img
						src={placePhotoUrl(placeId, thumb.id, { h: thumbHeight * 2 })}
						alt=""
						referrerpolicy="no-referrer"
						class="h-full w-full object-cover"
					/>
				</button>
			{/each}
		</div>

		<!-- Mobile: dots up to MAX_DOTS photos, otherwise the header counter -->
		{#if total <= MAX_DOTS}
			<div
				class="flex justify-center gap-1.5 pt-4 pb-[max(1.75rem,env(safe-area-inset-bottom))] md:hidden"
				aria-hidden="true"
			>
				{#each photos as dot, i (dot.id)}
					<span class="h-1.5 w-1.5 rounded-full {i === index ? 'bg-white' : 'bg-white/35'}"></span>
				{/each}
			</div>
		{/if}
	{/if}
</div>

import type { SlideData } from "photoswipe";

import { fitWithin, placePhotoUrl } from "#lib/placePhotos.js";

import type { PlaceImage } from "$types/btcmap-api/PlaceImage";

// The only module that knows about PhotoSwipe (#1469): it renders the image
// stage (swipe, pinch/zoom, preload) while PlacePhotoViewer owns every bit of
// chrome, keyboard and focus handling. Swapping the library means rewriting
// this file only.

const SRCSET_BOUNDS = [800, 1200, 1600];
const MAX_BOUND = SRCSET_BOUNDS[SRCSET_BOUNDS.length - 1];

export type LightboxHandle = {
	goTo: (index: number) => void;
	close: () => void;
	destroy: () => void;
};

// The API fits images into a w×h box and never upscales, so each candidate's
// real width is the fit of the original; equal widths mean the same bytes.
export const buildSlides = (
	placeId: number,
	photos: PlaceImage[],
	alt: (index: number, total: number) => string,
): SlideData[] =>
	photos.map((photo, index) => {
		const candidates = new Map<number, string>();
		for (const bound of SRCSET_BOUNDS) {
			const { width } = fitWithin(photo.width, photo.height, bound);
			if (!candidates.has(width)) {
				candidates.set(
					width,
					placePhotoUrl(placeId, photo.id, { w: bound, h: bound }),
				);
			}
		}
		const largest = fitWithin(photo.width, photo.height, MAX_BOUND);
		return {
			src: placePhotoUrl(placeId, photo.id, { w: MAX_BOUND, h: MAX_BOUND }),
			srcset: [...candidates]
				.map(([width, url]) => `${url} ${width}w`)
				.join(", "),
			width: largest.width,
			height: largest.height,
			alt: alt(index, photos.length),
		};
	});

export const openPlaceLightbox = async (opts: {
	slides: SlideData[];
	startIndex: number;
	// Our stage element; PhotoSwipe sizes itself to it, not to the window
	container: HTMLElement;
	// Room left and right of the image for our arrow zones
	sidePadding: number;
	reducedMotion: boolean;
	onChange: (index: number) => void;
	// Fires once the lightbox is gone, however it was closed (button,
	// Escape via close(), or swipe-down)
	onDestroy: () => void;
}): Promise<LightboxHandle> => {
	const [{ default: PhotoSwipe }] = await Promise.all([
		import("photoswipe"),
		import("photoswipe/style.css"),
		import("./placePhotoLightbox.css"),
	]);

	const pswp = new PhotoSwipe({
		dataSource: opts.slides,
		index: opts.startIndex,
		appendToEl: opts.container,
		mainClass: "pswp--btcmap",
		getViewportSizeFn: () => ({
			x: opts.container.clientWidth,
			y: opts.container.clientHeight,
		}),
		padding: {
			top: 0,
			bottom: 0,
			left: opts.sidePadding,
			right: opts.sidePadding,
		},
		loop: false,
		bgOpacity: 1,
		showHideAnimationType: opts.reducedMotion ? "none" : "fade",
		// Our Svelte chrome renders these
		arrowPrev: false,
		arrowNext: false,
		close: false,
		counter: false,
		zoom: false,
		// Keys and focus are owned by PlacePhotoViewer: the map drawers listen
		// on window too, and PhotoSwipe's focus trap would pull focus out of
		// our header
		escKey: false,
		arrowKeys: false,
		trapFocus: false,
		returnFocus: false,
		closeOnVerticalDrag: true,
		pinchToClose: true,
	});

	// Fires before the src is set, so no request leaks a referrer
	pswp.on("contentLoadImage", ({ content }) => {
		if (content.element instanceof HTMLImageElement) {
			content.element.referrerPolicy = "no-referrer";
		}
	});
	pswp.on("change", () => opts.onChange(pswp.currIndex));
	pswp.on("destroy", opts.onDestroy);

	// PhotoSwipe ignores close() and destroy() while its opening animation
	// runs (~333ms, or one frame without animation). Queue them for its end:
	// a dropped destroy leaks the instance with its window listeners.
	let opened = false;
	let pending: "close" | "destroy" | null = null;
	pswp.on("openingAnimationEnd", () => {
		opened = true;
		if (pending === "destroy") pswp.destroy();
		else if (pending === "close") pswp.close();
		pending = null;
	});
	pswp.init();

	return {
		goTo: (index) => pswp.goTo(index),
		close: () => {
			if (opened) pswp.close();
			else if (pending !== "destroy") pending = "close";
		},
		destroy: () => {
			if (opened) pswp.destroy();
			else pending = "destroy";
		},
	};
};

import { beforeEach, describe, expect, it, vi } from "vitest";

import { API_BASE } from "$lib/api-base";

import { buildSlides, openPlaceLightbox } from "./placePhotoLightbox";

type Listener = (event: unknown) => void;

const pswps = vi.hoisted(() => [] as FakePhotoSwipe[]);

type FakePhotoSwipe = {
	options: Record<string, unknown>;
	currIndex: number;
	listeners: Record<string, Listener[]>;
	emit: (name: string) => void;
	close: ReturnType<typeof vi.fn>;
	destroy: ReturnType<typeof vi.fn>;
	goTo: ReturnType<typeof vi.fn>;
};

vi.mock("photoswipe/style.css", () => ({}));
vi.mock("./placePhotoLightbox.css", () => ({}));
vi.mock("photoswipe", () => ({
	default: class {
		options: Record<string, unknown>;
		currIndex = 0;
		listeners: Record<string, Listener[]> = {};
		close = vi.fn();
		destroy = vi.fn();
		goTo = vi.fn();
		constructor(options: Record<string, unknown>) {
			this.options = options;
			pswps.push(this as unknown as FakePhotoSwipe);
		}
		on(name: string, listener: Listener) {
			this.listeners[name] = [...(this.listeners[name] ?? []), listener];
		}
		emit(name: string) {
			for (const listener of this.listeners[name] ?? []) listener({});
		}
		init() {}
	},
}));

const photo = (id: number, width: number, height: number) => ({
	id,
	place_id: 42,
	type: "user",
	width,
	height,
	size_bytes: 1,
	created_at: "2026-10-01T06:48:23.658Z",
});

const url = (id: number, w: number) =>
	`${API_BASE}/v4/places/42/images/${id}?w=${w}&h=${w}`;

describe("buildSlides", () => {
	it("serves the 1600px fit as src and sizes the slide to it, so zoom never exceeds the delivered pixels", () => {
		const [slide] = buildSlides(42, [photo(3, 4032, 3024)], () => "alt");

		expect(slide.src).toBe(url(3, 1600));
		expect(slide.width).toBe(1600);
		expect(slide.height).toBe(1200);
	});

	it("lists 800/1200/1600 candidates with the width the server actually returns", () => {
		const [slide] = buildSlides(42, [photo(3, 964, 1280)], () => "alt");

		// Portrait: the height hits the w×w box first
		expect(slide.srcset).toBe(
			[
				`${url(3, 800)} 603w`,
				`${url(3, 1200)} 904w`,
				`${url(3, 1600)} 964w`,
			].join(", "),
		);
	});

	it("drops candidates that would be the same unscaled original", () => {
		const [slide] = buildSlides(42, [photo(3, 700, 500)], () => "alt");

		// Smaller than every bound: the server returns the original each time
		expect(slide.srcset).toBe(`${url(3, 800)} 700w`);
		expect(slide.width).toBe(700);
		expect(slide.height).toBe(500);
	});

	it("labels each slide with its position", () => {
		const slides = buildSlides(
			42,
			[photo(1, 800, 600), photo(2, 800, 600)],
			(i, total) => `Photo ${i + 1} of ${total}`,
		);

		expect(slides.map((s) => s.alt)).toEqual(["Photo 1 of 2", "Photo 2 of 2"]);
	});
});

describe("openPlaceLightbox", () => {
	beforeEach(() => {
		pswps.length = 0;
	});

	const open = () =>
		openPlaceLightbox({
			slides: [],
			startIndex: 0,
			container: document.createElement("div"),
			sidePadding: 0,
			reducedMotion: false,
			onChange: () => {},
			onDestroy: () => {},
		});

	// PhotoSwipe ignores close() and destroy() while its opening animation
	// runs, which leaked the instance when the viewer unmounted early
	it("defers close until the opening animation has ended", async () => {
		const handle = await open();
		const [pswp] = pswps;

		handle.close();
		expect(pswp.close).not.toHaveBeenCalled();

		pswp.emit("openingAnimationEnd");
		expect(pswp.close).toHaveBeenCalledOnce();
	});

	it("defers destroy until the opening animation has ended", async () => {
		const handle = await open();
		const [pswp] = pswps;

		handle.destroy();
		expect(pswp.destroy).not.toHaveBeenCalled();

		pswp.emit("openingAnimationEnd");
		expect(pswp.destroy).toHaveBeenCalledOnce();
		expect(pswp.close).not.toHaveBeenCalled();
	});

	it("closes and destroys right away once open", async () => {
		const handle = await open();
		const [pswp] = pswps;
		pswp.emit("openingAnimationEnd");

		handle.close();
		expect(pswp.close).toHaveBeenCalledOnce();

		handle.destroy();
		expect(pswp.destroy).toHaveBeenCalledOnce();
	});
});

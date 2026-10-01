import { describe, expect, it } from "vitest";

import { API_BASE } from "$lib/api-base";

import { buildSlides } from "./placePhotoLightbox";

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

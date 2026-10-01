import { beforeEach, describe, expect, it, vi } from "vitest";

import { API_BASE } from "$lib/api-base";

import {
	fetchPlacePhotos,
	fitWithin,
	placePhotoUrl,
	uploadPlacePhoto,
} from "./placePhotos";

vi.mock("$lib/axios", () => ({
	default: {
		get: vi.fn(),
		post: vi.fn(),
	},
}));

const photo = {
	id: 12,
	place_id: 20423,
	type: "user",
	width: 964,
	height: 1280,
	size_bytes: 131676,
	created_at: "2026-10-01T06:48:23.658Z",
	created_by: 668,
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("placePhotoUrl", () => {
	it("points at the image bytes endpoint", () => {
		expect(placePhotoUrl(42, 3)).toBe(`${API_BASE}/v4/places/42/images/3`);
	});

	it("asks the server for a resized copy when bounds are given", () => {
		expect(placePhotoUrl(42, 3, { h: 224 })).toBe(
			`${API_BASE}/v4/places/42/images/3?h=224`,
		);
		expect(placePhotoUrl(42, 3, { w: 1600, h: 1600 })).toBe(
			`${API_BASE}/v4/places/42/images/3?w=1600&h=1600`,
		);
	});

	it("drops non-positive bounds — the API answers 400 to w=0", () => {
		expect(placePhotoUrl(42, 3, { w: 0, h: -1 })).toBe(
			`${API_BASE}/v4/places/42/images/3`,
		);
	});
});

describe("fetchPlacePhotos", () => {
	it("requests user uploads only — report evidence can show reporters", async () => {
		const { default: api } = await import("$lib/axios");
		vi.mocked(api.get).mockResolvedValue({ data: [photo] });

		await fetchPlacePhotos(20423);

		expect(api.get).toHaveBeenCalledWith(
			`${API_BASE}/v4/places/20423/images?type=user`,
		);
	});

	it("returns the photos newest first as the API sends them", async () => {
		const { default: api } = await import("$lib/axios");
		const older = { ...photo, id: 8 };
		vi.mocked(api.get).mockResolvedValue({ data: [photo, older] });

		expect(await fetchPlacePhotos(20423)).toEqual([photo, older]);
	});

	it("drops entries without usable dimensions instead of rendering broken boxes", async () => {
		const { default: api } = await import("$lib/axios");
		vi.mocked(api.get).mockResolvedValue({
			data: [photo, { id: 1, width: 0, height: 10 }, { id: "x" }, null],
		});

		expect(await fetchPlacePhotos(20423)).toEqual([photo]);
	});

	it("treats a non-array response as no photos", async () => {
		const { default: api } = await import("$lib/axios");
		vi.mocked(api.get).mockResolvedValue({ data: "<html>" });

		expect(await fetchPlacePhotos(20423)).toEqual([]);
	});
});

describe("uploadPlacePhoto", () => {
	it("POSTs the base64 body with the Bearer token", async () => {
		const { default: api } = await import("$lib/axios");
		vi.mocked(api.post).mockResolvedValue({ data: photo });

		const stored = await uploadPlacePhoto(20423, "tok", "AAAA");

		expect(api.post).toHaveBeenCalledWith(
			`${API_BASE}/v4/places/20423/images`,
			{ data_base64: "AAAA" },
			{ headers: { Authorization: "Bearer tok" } },
		);
		expect(stored).toEqual(photo);
	});

	it("throws when the API answers with something that is not a photo", async () => {
		const { default: api } = await import("$lib/axios");
		vi.mocked(api.post).mockResolvedValue({ data: {} });

		await expect(uploadPlacePhoto(20423, "tok", "AAAA")).rejects.toThrow();
	});
});

describe("fitWithin", () => {
	it("keeps images that already fit", () => {
		expect(fitWithin(800, 600, 2048)).toEqual({ width: 800, height: 600 });
	});

	it("scales the longer side down to the limit, keeping the aspect ratio", () => {
		expect(fitWithin(4032, 3024, 2048)).toEqual({ width: 2048, height: 1536 });
		expect(fitWithin(3024, 4032, 2048)).toEqual({ width: 1536, height: 2048 });
	});
});

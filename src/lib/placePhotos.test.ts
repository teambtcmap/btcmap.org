import type { AxiosResponse } from "axios";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { API_BASE } from "#lib/api-base.js";

import {
	canDeletePhoto,
	deepLinkTarget,
	deleteErrorKey,
	deletePlacePhoto,
	fetchMyPlacePhotos,
	fetchPlacePhotos,
	fitWithin,
	MAX_PHOTOS_PER_PICK,
	photoAuthorName,
	photoIdFromSearch,
	photoPagePath,
	photoShareUrl,
	placePhotoUrl,
	prependUploaded,
	splitPick,
	stripScrollState,
	undoUploads,
	uploadPlacePhoto,
	uploadPlacePhotos,
	withPhotoParam,
} from "./placePhotos";

vi.mock("#lib/axios.js", () => ({
	default: {
		get: vi.fn(),
		post: vi.fn(),
		delete: vi.fn(),
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
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.get).mockResolvedValue({ data: [photo] });

		await fetchPlacePhotos(20423);

		expect(api.get).toHaveBeenCalledWith(
			`${API_BASE}/v4/places/20423/images?type=user`,
		);
	});

	it("returns the photos newest first as the API sends them", async () => {
		const { default: api } = await import("#lib/axios.js");
		const older = { ...photo, id: 8 };
		vi.mocked(api.get).mockResolvedValue({ data: [photo, older] });

		expect(await fetchPlacePhotos(20423)).toEqual([photo, older]);
	});

	it("drops entries without usable dimensions instead of rendering broken boxes", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.get).mockResolvedValue({
			data: [photo, { id: 1, width: 0, height: 10 }, { id: "x" }, null],
		});

		expect(await fetchPlacePhotos(20423)).toEqual([photo]);
	});

	it("treats a non-array response as no photos", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.get).mockResolvedValue({ data: "<html>" });

		expect(await fetchPlacePhotos(20423)).toEqual([]);
	});
});

describe("uploadPlacePhoto", () => {
	it("POSTs the base64 body with the Bearer token", async () => {
		const { default: api } = await import("#lib/axios.js");
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
		const { default: api } = await import("#lib/axios.js");
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

describe("splitPick", () => {
	it("keeps up to MAX_PHOTOS_PER_PICK files and counts the rest", () => {
		const files = Array.from({ length: MAX_PHOTOS_PER_PICK + 2 }, (_, i) => i);

		expect(splitPick(files)).toEqual({
			batch: files.slice(0, MAX_PHOTOS_PER_PICK),
			dropped: 2,
		});
		expect(splitPick([1, 2])).toEqual({ batch: [1, 2], dropped: 0 });
	});
});

describe("uploadPlacePhotos", () => {
	const stored = (id: number, created_at: string) => ({
		...photo,
		id,
		created_at,
	});

	it("uploads in parallel and returns the stored photos newest first", async () => {
		const settled: string[] = [];
		const result = await uploadPlacePhotos(
			["a", "b"],
			async (file) =>
				file === "a"
					? stored(1, "2026-10-01T10:00:00Z")
					: stored(2, "2026-10-01T10:00:05Z"),
			() => settled.push("x"),
		);

		expect(result.stored.map((p) => p.id)).toEqual([2, 1]);
		expect(result.failed).toEqual([]);
		expect(settled).toHaveLength(2);
	});

	it("keeps going when one upload fails and reports the failures", async () => {
		const error = new Error("413");
		const result = await uploadPlacePhotos(
			["ok", "bad"],
			async (file) => {
				if (file === "bad") throw error;
				return stored(3, "2026-10-01T10:00:00Z");
			},
			() => {},
		);

		expect(result.stored.map((p) => p.id)).toEqual([3]);
		expect(result.failed).toEqual([error]);
	});
});

describe("photoIdFromSearch", () => {
	it("reads a positive integer photo id", () => {
		expect(photoIdFromSearch("?merchant=5&photo=12")).toBe(12);
	});

	it("ignores missing, junk and non-positive values", () => {
		expect(photoIdFromSearch("?merchant=5")).toBeNull();
		expect(photoIdFromSearch("?photo=abc")).toBeNull();
		expect(photoIdFromSearch("?photo=1.5")).toBeNull();
		expect(photoIdFromSearch("?photo=0")).toBeNull();
		expect(photoIdFromSearch("?photo=-3")).toBeNull();
	});
});

describe("withPhotoParam", () => {
	it("sets the photo param and keeps the rest of the URL, hash included", () => {
		expect(
			withPhotoParam("https://btcmap.org/map?merchant=20423#18/7.88/98.38", 12),
		).toBe("/map?merchant=20423&photo=12#18/7.88/98.38");
	});

	it("keeps the map's literal commas (?issues=a,b) instead of %2C", () => {
		expect(
			withPhotoParam("https://btcmap.org/map?issues=hours,payment", 7),
		).toBe("/map?issues=hours,payment&photo=7");
	});

	it("replaces an existing photo param", () => {
		expect(withPhotoParam("https://btcmap.org/merchant/1?photo=3", 4)).toBe(
			"/merchant/1?photo=4",
		);
	});

	it("removes the param on null, leaving no dangling ?", () => {
		expect(withPhotoParam("https://btcmap.org/merchant/1?photo=3", null)).toBe(
			"/merchant/1",
		);
		expect(
			withPhotoParam("https://btcmap.org/map?merchant=1&photo=3#z", null),
		).toBe("/map?merchant=1#z");
	});
});

describe("photoPagePath", () => {
	it("is the merchant page with the photo open", () => {
		expect(photoPagePath(20423, 12)).toBe("/merchant/20423?photo=12");
	});
});

describe("photoShareUrl", () => {
	it("links the merchant page, which works without the map", () => {
		expect(photoShareUrl("https://btcmap.org", 20423, 12)).toBe(
			"https://btcmap.org/merchant/20423?photo=12",
		);
	});
});

describe("deepLinkTarget", () => {
	const list = [
		{ ...photo, id: 12 },
		{ ...photo, id: 8 },
	];

	it("finds the index of the linked photo", () => {
		expect(deepLinkTarget(list, "?merchant=1&photo=8")).toEqual({ index: 1 });
	});

	it("flags a photo id that isn't among this place's photos as stale", () => {
		expect(deepLinkTarget(list, "?photo=99")).toEqual({ stale: true });
	});

	it("does nothing without a usable photo param", () => {
		expect(deepLinkTarget(list, "?merchant=1")).toBeNull();
		expect(deepLinkTarget(list, "?photo=abc")).toBeNull();
	});
});

describe("photoAuthorName", () => {
	it("returns the uploader's name", () => {
		expect(
			photoAuthorName({ ...photo, author: { id: 668, name: "satoshi" } }),
		).toBe("satoshi");
	});

	it("is null without a usable author, so the UI falls back to 'Community photo'", () => {
		expect(photoAuthorName(photo)).toBeNull();
		expect(
			photoAuthorName({ ...photo, author: { id: 1, name: "  " } }),
		).toBeNull();
	});

	it("is null when the API sends an author without a string name", () => {
		// The response isn't validated beyond its top-level shape: a malformed
		// author must not throw inside the viewer's $derived
		for (const author of [{}, { id: 1, name: null }, { id: 1, name: 42 }]) {
			expect(
				photoAuthorName({ ...photo, author } as unknown as typeof photo),
			).toBeNull();
		}
	});
});

describe("canDeletePhoto", () => {
	const mine = { ...photo, author: { id: 668, name: "me" } };

	it("lets the uploader delete their photo", () => {
		expect(canDeletePhoto(mine, { id: 668, roles: ["user"] })).toBe(true);
	});

	it("falls back to created_by when there's no author object", () => {
		expect(canDeletePhoto(photo, { id: 668, roles: [] })).toBe(true);
	});

	it("lets admin and root delete anyone's photo", () => {
		expect(canDeletePhoto(mine, { id: 1, roles: ["user", "admin"] })).toBe(
			true,
		);
		expect(canDeletePhoto(mine, { id: 1, roles: ["root"] })).toBe(true);
	});

	it("refuses other users and signed-out visitors", () => {
		expect(canDeletePhoto(mine, { id: 1, roles: ["user"] })).toBe(false);
		expect(canDeletePhoto(mine, null)).toBe(false);
		expect(
			canDeletePhoto(
				{ ...photo, created_by: undefined },
				{ id: 668, roles: [] },
			),
		).toBe(false);
	});
});

describe("deletePlacePhoto", () => {
	it("DELETEs the image with the Bearer token", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.delete).mockResolvedValue({ data: photo });

		await deletePlacePhoto(20423, 12, "tok");

		expect(api.delete).toHaveBeenCalledWith(
			`${API_BASE}/v4/places/20423/images/12`,
			{ headers: { Authorization: "Bearer tok" } },
		);
	});
});

describe("undoUploads", () => {
	it("deletes every just-uploaded photo and reports which ones went", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.delete)
			.mockResolvedValueOnce({ data: {} })
			.mockRejectedValueOnce(new Error("500"));

		const result = await undoUploads(20423, [12, 13], "tok");

		expect(api.delete).toHaveBeenCalledTimes(2);
		expect(result).toEqual({ removed: [12], complete: false });
	});

	it("counts a photo that's already gone (404) as removed", async () => {
		const { default: api } = await import("#lib/axios.js");
		const notFound = new AxiosError(
			"404",
			"ERR_BAD_REQUEST",
			undefined,
			undefined,
			{
				status: 404,
			} as AxiosResponse,
		);
		vi.mocked(api.delete).mockRejectedValueOnce(notFound);

		expect(await undoUploads(20423, [12], "tok")).toEqual({
			removed: [12],
			complete: true,
		});
	});
});

describe("deleteErrorKey", () => {
	const httpError = (status: number) =>
		new AxiosError("x", "ERR_BAD_REQUEST", undefined, undefined, {
			status,
		} as AxiosResponse);

	it("explains a 403 as not your photo", () => {
		expect(deleteErrorKey(httpError(403))).toBe("placePhotos.deleteForbidden");
	});

	it("is the generic failure for anything else", () => {
		expect(deleteErrorKey(httpError(500))).toBe("placePhotos.deleteFailed");
		expect(deleteErrorKey(new Error("offline"))).toBe(
			"placePhotos.deleteFailed",
		);
	});
});

describe("fetchMyPlacePhotos", () => {
	it("lists the caller's uploads with the Bearer token", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.get).mockResolvedValue({ data: [photo, { id: "x" }] });

		expect(await fetchMyPlacePhotos("tok")).toEqual([photo]);
		expect(api.get).toHaveBeenCalledWith(
			`${API_BASE}/v4/users/me/place-images`,
			{ headers: { Authorization: "Bearer tok" } },
		);
	});

	it("leaves out report evidence: only the user's public uploads", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.get).mockResolvedValue({
			data: [photo, { ...photo, id: 7, type: "report" }],
		});

		expect((await fetchMyPlacePhotos("tok")).map((p) => p.id)).toEqual([12]);
	});

	it("throws on a non-array response so the page can show its error state", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.get).mockResolvedValue({ data: "<html>" });

		await expect(fetchMyPlacePhotos("tok")).rejects.toThrow();
	});
});

describe("stripScrollState", () => {
	const box = { clientWidth: 300, scrollWidth: 900 };

	it("can only go forward at the start", () => {
		expect(stripScrollState({ ...box, scrollLeft: 0 })).toEqual({
			canScrollBack: false,
			canScrollForward: true,
		});
	});

	it("can go both ways in the middle", () => {
		expect(stripScrollState({ ...box, scrollLeft: 300 })).toEqual({
			canScrollBack: true,
			canScrollForward: true,
		});
	});

	it("can only go back at the end, within a pixel of rounding", () => {
		expect(stripScrollState({ ...box, scrollLeft: 599.5 })).toEqual({
			canScrollBack: true,
			canScrollForward: false,
		});
	});

	it("can't scroll at all when everything fits", () => {
		expect(
			stripScrollState({ scrollLeft: 0, clientWidth: 300, scrollWidth: 300 }),
		).toEqual({ canScrollBack: false, canScrollForward: false });
	});

	it("reads right-to-left strips, where scrollLeft runs negative", () => {
		expect(stripScrollState({ ...box, scrollLeft: -300 })).toEqual({
			canScrollBack: true,
			canScrollForward: true,
		});
	});
});

describe("prependUploaded", () => {
	const a = { ...photo, id: 1 };
	const b = { ...photo, id: 2 };
	const fresh = { ...photo, id: 3 };

	it("puts the new uploads first", () => {
		expect(prependUploaded([fresh], [a, b]).map((p) => p.id)).toEqual([
			3, 1, 2,
		]);
	});

	it("keeps each photo once when a refetch already brought the upload", () => {
		// Switch away and back while uploading: the strip refetches and gets
		// the stored photo before the upload loop reports it
		expect(prependUploaded([fresh], [fresh, a]).map((p) => p.id)).toEqual([
			3, 1,
		]);
	});

	it("starts the list when there was none yet", () => {
		expect(prependUploaded([fresh], undefined)).toEqual([fresh]);
	});
});

import { get } from "svelte/store";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { places } from "$lib/store";
import type { Place } from "$lib/types";

vi.mock("localforage", () => ({
	default: {
		getItem: vi.fn(),
		setItem: vi.fn(),
	},
}));

import localforage from "localforage";

import {
	placesPublished,
	publishPlaces,
	readPlaceCache,
	readPlacesSyncedAt,
	writePlacesSyncedAt,
} from "./placeCache";

const mockGetItem = vi.mocked(localforage.getItem);
const mockSetItem = vi.mocked(localforage.setItem);

const place = (id: number): Place => ({ id, lat: 1, lon: 2 }) as Place;

beforeEach(() => {
	mockGetItem.mockReset();
	mockSetItem.mockReset();
	mockSetItem.mockResolvedValue(undefined as never);
	places.set([]);
});

describe("readPlaceCache", () => {
	it("returns null for a cold cache", async () => {
		mockGetItem.mockResolvedValueOnce(null);
		expect(await readPlaceCache()).toBeNull();
	});

	it("treats a corrupt non-array blob as a cold cache", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			// The #1187 class: a persisted error page / char-iterated string
			mockGetItem.mockResolvedValueOnce("<html>maintenance</html>");
			expect(await readPlaceCache()).toBeNull();
			expect(warnSpy).toHaveBeenCalled();
		} finally {
			warnSpy.mockRestore();
		}
	});

	it("treats a non-empty all-invalid array as corruption, not a warm empty cache", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			// The literal #1187 shape: a string char-iterated into an array.
			// Reading this as warm-but-empty would skip the baseline download.
			mockGetItem.mockResolvedValueOnce(["\n", "\n", "\n"]);
			expect(await readPlaceCache()).toBeNull();
			expect(warnSpy).toHaveBeenCalled();
		} finally {
			warnSpy.mockRestore();
		}
	});

	it("preserves a legitimately empty array blob", async () => {
		mockGetItem.mockResolvedValueOnce([]);
		expect(await readPlaceCache()).toEqual([]);
	});

	it("drops rows that don't look like places and keeps the rest", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			mockGetItem.mockResolvedValueOnce([
				place(1),
				"\n",
				{ id: "nope" },
				{ id: 2, lat: Number.NaN, lon: 0 },
				{ id: Number.NaN, lat: 1, lon: 2 },
				place(3),
			]);
			const rows = await readPlaceCache();
			expect(rows?.map((r) => r.id)).toEqual([1, 3]);
			expect(warnSpy).toHaveBeenCalled();
		} finally {
			warnSpy.mockRestore();
		}
	});
});

describe("publishPlaces", () => {
	it("persists, publishes to $places, and latches placesPublished", async () => {
		const rows = [place(1), place(2)];
		const result = await publishPlaces(rows);

		expect(result.persisted).toBe(true);
		expect(mockSetItem).toHaveBeenCalledWith("places_v4", rows);
		expect(get(places)).toEqual(rows);
		expect(get(placesPublished)).toBe(true);
	});

	it("still publishes when persistence fails", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		try {
			mockSetItem.mockRejectedValueOnce(new Error("quota exceeded"));
			const rows = [place(7)];
			const result = await publishPlaces(rows);

			// The session keeps working on broken storage
			expect(result.persisted).toBe(false);
			expect(get(places)).toEqual(rows);
		} finally {
			errorSpy.mockRestore();
		}
	});

	it("skips persistence when asked (CDN fallback path)", async () => {
		const result = await publishPlaces([place(9)], { persist: false });
		expect(result.persisted).toBe(false);
		expect(mockSetItem).not.toHaveBeenCalled();
		expect(get(places).map((r) => r.id)).toEqual([9]);
	});

	it("sanitizes rows at the write boundary too", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			await publishPlaces([place(1), "junk" as unknown as Place]);
			expect(get(places).map((r) => r.id)).toEqual([1]);
			expect(mockSetItem).toHaveBeenCalledWith("places_v4", [
				expect.objectContaining({ id: 1 }),
			]);
			expect(warnSpy).toHaveBeenCalled();
		} finally {
			warnSpy.mockRestore();
		}
	});
});

describe("synced-at watermark", () => {
	it("reads and writes through the shared keys", async () => {
		mockGetItem.mockResolvedValueOnce("2026-08-01T00:00:00.000Z");
		expect(await readPlacesSyncedAt()).toBe("2026-08-01T00:00:00.000Z");
		expect(mockGetItem).toHaveBeenCalledWith("places_v4_synced_at");

		await writePlacesSyncedAt("2026-08-04T12:00:00.000Z");
		expect(mockSetItem).toHaveBeenCalledWith(
			"places_v4_synced_at",
			"2026-08-04T12:00:00.000Z",
		);
	});
});

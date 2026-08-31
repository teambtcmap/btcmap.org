import { afterEach, describe, expect, it, vi } from "vitest";

import type { Place } from "$lib/types";

import {
	buildAddLocationUrl,
	clampDedupeRadiusKm,
	fetchNearbyPlaceNames,
	findNearbyPlaces,
	parseCoordsParams,
} from "./placementMode";

describe("buildAddLocationUrl", () => {
	it("builds the add-location URL with 5-decimal coords", () => {
		expect(buildAddLocationUrl(32.649012345, -16.910299999)).toBe(
			"/add-location?lat=32.64901&long=-16.91030",
		);
	});
});

describe("parseCoordsParams", () => {
	it("parses valid coords", () => {
		expect(
			parseCoordsParams(new URLSearchParams("lat=32.64901&long=-16.9103")),
		).toEqual({ lat: 32.64901, long: -16.9103 });
	});

	it("returns null when a param is missing", () => {
		expect(parseCoordsParams(new URLSearchParams("lat=32.64901"))).toBeNull();
		expect(parseCoordsParams(new URLSearchParams(""))).toBeNull();
	});

	it("returns null for empty, non-numeric, or out-of-range values", () => {
		expect(parseCoordsParams(new URLSearchParams("lat=&long=1"))).toBeNull();
		expect(parseCoordsParams(new URLSearchParams("lat=abc&long=1"))).toBeNull();
		expect(parseCoordsParams(new URLSearchParams("lat=91&long=0"))).toBeNull();
		expect(parseCoordsParams(new URLSearchParams("lat=0&long=181"))).toBeNull();
	});

	it("rejects the legacy bounds form (two lat/long pairs)", () => {
		expect(
			parseCoordsParams(new URLSearchParams("lat=1&long=2&lat=3&long=4")),
		).toBeNull();
	});
});

const makePlace = (
	id: number,
	lat: number,
	lon: number,
	extra: Partial<Place> = {},
): Place => ({
	id,
	lat,
	lon,
	icon: "restaurant",
	name: `Place ${id}`,
	...extra,
});

describe("findNearbyPlaces", () => {
	// At lat 42, 0.0005° of latitude ≈ 55.6 m (inside 75 m) and 0.001° ≈ 111 m
	// (outside) — offsets chosen so the radius cut is unambiguous.
	const LAT = 42.2762511;
	const LONG = 42.7024218;

	it("returns places inside the radius, closest first, with distances in meters", () => {
		const near = makePlace(1, LAT + 0.0005, LONG);
		const nearer = makePlace(2, LAT + 0.0002, LONG);
		const far = makePlace(3, LAT + 0.001, LONG);
		const result = findNearbyPlaces(LAT, LONG, [near, far, nearer], 75);
		expect(result.map(({ place }) => place.id)).toEqual([2, 1]);
		expect(result[0].distanceM).toBeGreaterThan(20);
		expect(result[0].distanceM).toBeLessThan(25);
		expect(result[1].distanceM).toBeGreaterThan(50);
		expect(result[1].distanceM).toBeLessThan(60);
	});

	it("excludes deleted places even inside the radius", () => {
		const deleted = makePlace(1, LAT, LONG, {
			deleted_at: "2026-01-01T00:00:00Z",
		});
		expect(findNearbyPlaces(LAT, LONG, [deleted], 75)).toEqual([]);
	});

	it("caps the list at NEARBY_LIMIT", () => {
		const cluster = Array.from({ length: 7 }, (_, i) =>
			makePlace(i + 1, LAT + i * 0.00005, LONG),
		);
		expect(findNearbyPlaces(LAT, LONG, cluster, 75)).toHaveLength(5);
	});

	it("returns empty for an empty store", () => {
		expect(findNearbyPlaces(LAT, LONG, [], 75)).toEqual([]);
	});

	it("respects the radius parameter", () => {
		// ~555 m north of the pin: inside a 1 km radius, far outside 75 m.
		const mid = makePlace(9, LAT + 0.005, LONG);
		expect(findNearbyPlaces(LAT, LONG, [mid], 1000)).toHaveLength(1);
		expect(findNearbyPlaces(LAT, LONG, [mid], 75)).toHaveLength(0);
	});
});

describe("clampDedupeRadiusKm", () => {
	it("clamps below the floor to 0.25", () => {
		expect(clampDedupeRadiusKm(0.08)).toBe(0.25);
	});

	it("passes mid-range values through", () => {
		expect(clampDedupeRadiusKm(0.6)).toBe(0.6);
	});

	it("caps above the ceiling at 1", () => {
		expect(clampDedupeRadiusKm(4.8)).toBe(1);
	});
});

describe("fetchNearbyPlaceNames", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("maps valid rows by id, skipping empty names and non-numeric ids", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				ok: true,
				json: async () => [
					{ id: 1, name: "Kiosk 87" },
					{ id: 2, name: "" },
					{ id: "x", name: "bad" },
				],
			})),
		);
		const names = await fetchNearbyPlaceNames(42.2762511, 42.7024218, 0.075);
		expect(names).toEqual(new Map([[1, "Kiosk 87"]]));
	});

	it("passes the given radius to the search URL", async () => {
		const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
			ok: true,
			json: async () => [],
		}));
		vi.stubGlobal("fetch", fetchMock);
		await fetchNearbyPlaceNames(1, 2, 1);
		expect(fetchMock.mock.calls[0]?.[0]).toContain("radius_km=1&");
	});

	it("returns an empty Map when the response is not ok", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({ ok: false, json: async () => [] })),
		);
		const names = await fetchNearbyPlaceNames(42.2762511, 42.7024218, 0.075);
		expect(names).toEqual(new Map());
	});

	it("returns an empty Map when fetch rejects", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new Error("network error");
			}),
		);
		const names = await fetchNearbyPlaceNames(42.2762511, 42.7024218, 0.075);
		expect(names).toEqual(new Map());
	});
});

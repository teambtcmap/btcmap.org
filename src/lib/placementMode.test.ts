import { describe, expect, it } from "vitest";

import type { Place } from "$lib/types";

import {
	buildAddLocationUrl,
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
		const result = findNearbyPlaces(LAT, LONG, [near, far, nearer]);
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
		expect(findNearbyPlaces(LAT, LONG, [deleted])).toEqual([]);
	});

	it("caps the list at NEARBY_LIMIT", () => {
		const cluster = Array.from({ length: 7 }, (_, i) =>
			makePlace(i + 1, LAT + i * 0.00005, LONG),
		);
		expect(findNearbyPlaces(LAT, LONG, cluster)).toHaveLength(5);
	});

	it("returns empty for an empty store", () => {
		expect(findNearbyPlaces(LAT, LONG, [])).toEqual([]);
	});
});

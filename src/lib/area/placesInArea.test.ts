import rewind from "@mapbox/geojson-rewind";
import { geoBounds, geoContains } from "d3-geo";
import type { GeoJSON } from "geojson";
import { describe, expect, it } from "vitest";

import type { Place } from "$lib/types";

import { placesInArea, placesInAreaChunked, pointInArea } from "./placesInArea";

let nextId = 1;
const place = (lon: number, lat: number): Place =>
	({ id: nextId++, lat, lon }) as Place;

// lon 10..20, lat 10..20
const square = (): GeoJSON => ({
	type: "Polygon",
	coordinates: [
		[
			[10, 10],
			[20, 10],
			[20, 20],
			[10, 20],
			[10, 10],
		],
	],
});

// Fiji-style archipelago straddling the antimeridian: MultiPolygon parts on
// each side (real OSM areas split at ±180; a single ring jumping 175 → -175
// would break planar winding math and invert the interior). geoBounds merges
// the parts into a wrap bbox (west > east) — the case where a naive
// `lon < w || lon > e` reject drops EVERY in-area place. (Parts touching
// ±180 exactly make d3 report a safe full-width bbox instead — unprunable
// but never wrong.)
const wrapArea = (): GeoJSON => ({
	type: "MultiPolygon",
	coordinates: [
		[
			[
				[175, -20],
				[179, -20],
				[179, -10],
				[175, -10],
				[175, -20],
			],
		],
		[
			[
				[-179, -20],
				[-175, -20],
				[-175, -10],
				[-179, -10],
				[-179, -20],
			],
		],
	],
});

describe("placesInArea", () => {
	it("matches the naive rewind + geoContains sweep exactly", () => {
		const geo = square();
		const candidates = [
			place(15, 15),
			place(10.5, 19.5),
			place(25, 15),
			place(15, 25),
			place(-15, -15),
			place(19.9, 10.1),
		];

		const naive = candidates.filter((p) =>
			geoContains(rewind(square(), true), [p.lon, p.lat]),
		);
		const result = placesInArea(candidates, geo);

		expect(result).toEqual(naive);
		expect(result.map((p) => [p.lon, p.lat])).toEqual([
			[15, 15],
			[10.5, 19.5],
			[19.9, 10.1],
		]);
	});

	it("keeps in-area places on both sides of the antimeridian", () => {
		const geo = wrapArea();
		// Guard the fixture itself: this test only covers the wrap branch if
		// geoBounds actually reports west > east for it (on the rewound
		// geometry — raw RFC7946 winding reads as the complement in d3)
		const [[west], [east]] = geoBounds(
			rewind(wrapArea(), true) as Parameters<typeof geoBounds>[0],
		);
		expect(west).toBeGreaterThan(east);

		const inEast = place(177, -15);
		const inWest = place(-177, -15);
		// Inside the wrap bbox but in the water between the parts —
		// bbox passes it, geoContains rejects it
		const betweenParts = place(180, -15);
		const outFar = place(0, -15);
		const outLat = place(177, -50);

		const result = placesInArea(
			[inEast, inWest, betweenParts, outFar, outLat],
			geo,
		);
		expect(result).toEqual([inEast, inWest]);
	});

	it("returns nothing for degenerate geometry instead of throwing", () => {
		const empty: GeoJSON = { type: "Polygon", coordinates: [] };
		expect(placesInArea([place(15, 15)], empty)).toEqual([]);
	});
});

describe("pointInArea", () => {
	it("agrees with the sweep on both bbox rejection and containment", () => {
		const geo = square();
		expect(pointInArea(geo, 15, 15)).toBe(true);
		// bbox-rejected (far outside)
		expect(pointInArea(geo, 100, 15)).toBe(false);
		// inside the bbox but outside the polygon can't happen for a square —
		// the wrap area covers the interesting geometry above
		expect(pointInArea(wrapArea(), -177, -15)).toBe(true);
	});
});

describe("placesInAreaChunked", () => {
	it("produces the same result as the synchronous sweep across chunk boundaries", async () => {
		const geo = square();
		// Cross two chunk boundaries (chunk size 5000) so the yield path runs
		const many: Place[] = [];
		for (let i = 0; i < 12001; i++) {
			// Alternate inside/outside deterministically
			many.push(i % 2 === 0 ? place(15, 15) : place(25, 15));
		}

		const chunked = await placesInAreaChunked(many, geo);
		expect(chunked).toEqual(placesInArea(many, geo));
		expect(chunked).toHaveLength(6001);
	});

	it("returns null when marked stale instead of publishing a partial result", async () => {
		const geo = square();
		const many: Place[] = [];
		for (let i = 0; i < 6000; i++) {
			many.push(place(15, 15));
		}

		let checks = 0;
		const result = await placesInAreaChunked(many, geo, {
			// Fresh for the first chunk, stale from the second boundary on —
			// simulating an area navigation mid-sweep
			isStale: () => ++checks > 1,
		});
		expect(result).toBeNull();
	});
});

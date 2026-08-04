import rewind from "@mapbox/geojson-rewind";
import { geoBounds, geoContains } from "d3-geo";
import type { GeoJSON } from "geojson";

import type { Place } from "$lib/types";
import { yieldToMain } from "$lib/utils";

// The one point-in-area rule: a wrap-aware bbox prefilter cheaply rejects the
// obvious outsiders, then geoContains decides for the survivors against the
// rewound polygon. The bbox is ALWAYS derived from the polygon itself
// (d3-geo's spherical geoBounds — antimeridian-aware, west > east for
// wrapping areas like Fiji). There is deliberately NO caller-supplied bbox
// parameter: an external box (e.g. the human-authored box:* camera hints)
// smaller than the polygon would silently drop real merchants — advisory
// perf data must never become a correctness filter (#1175 re-review).

type AreaTester = (lon: number, lat: number) => boolean;

// Both derived artifacts are cached per polygon object: geoBounds walks every
// coordinate, and rewind is O(coords) too. WeakMap keying means a new SSR
// bundle (new object) naturally gets fresh entries.
const bboxCache = new WeakMap<
	object,
	[number, number, number, number] | null
>();
const testerCache = new WeakMap<object, AreaTester>();

const deriveBbox = (
	geoJson: GeoJSON,
): [number, number, number, number] | null => {
	const cached = bboxCache.get(geoJson);
	if (cached !== undefined) return cached;
	let bbox: [number, number, number, number] | null = null;
	try {
		// geoBounds returns [[west, south], [east, north]] on the sphere.
		const [[w, s], [e, n]] = geoBounds(
			geoJson as Parameters<typeof geoBounds>[0],
		);
		if ([w, s, e, n].every(Number.isFinite)) {
			bbox = [w, s, e, n];
		}
	} catch {
		// Degenerate geometry — no prefilter, geoContains decides everything
	}
	bboxCache.set(geoJson, bbox);
	return bbox;
};

const createAreaTester = (geoJson: GeoJSON): AreaTester => {
	const cached = testerCache.get(geoJson);
	if (cached) return cached;

	// Rewind BEFORE deriving bounds: d3 interprets ring winding spherically,
	// so on raw RFC7946 (counterclockwise-exterior) data geoBounds sees the
	// COMPLEMENT of the area and reports a useless full-width bbox — the
	// prefilter would be silently inert for every well-formed polygon.
	const rewoundPoly = rewind(geoJson, true);
	const bbox = deriveBbox(rewoundPoly);

	const tester: AreaTester = (lon, lat) => {
		if (bbox) {
			const [w, s, e, n] = bbox;
			// Antimeridian-wrapping bboxes (Fiji, far-east Russia) have w > e:
			// the valid longitude range is [w, 180] ∪ [-180, e]. A naive
			// `lon < w || lon > e` reject against a wrap bbox would drop
			// EVERY in-area place.
			const outsideLon = w <= e ? lon < w || lon > e : lon < w && lon > e;
			if (outsideLon || lat < s || lat > n) return false;
		}
		try {
			return geoContains(rewoundPoly, [lon, lat]);
		} catch {
			return false;
		}
	};
	testerCache.set(geoJson, tester);
	return tester;
};

export const pointInArea = (
	geoJson: GeoJSON,
	lon: number,
	lat: number,
): boolean => createAreaTester(geoJson)(lon, lat);

// Pure, synchronous sweep — the unit-testable equivalence anchor.
export const placesInArea = (places: Place[], geoJson: GeoJSON): Place[] => {
	const test = createAreaTester(geoJson);
	return places.filter((place) => test(place.lon, place.lat));
};

const SWEEP_CHUNK_SIZE = 5000;

// Chunked sweep for the ~29k-place store: yields to the main thread between
// chunks so a heavy country polygon (Brazil's is 69 KB of coordinates)
// doesn't block rendering for the whole pass. isStale is checked at every
// chunk boundary; a stale sweep returns null and the caller publishes
// nothing — one fresh array per completed sweep, never partial results.
export const placesInAreaChunked = async (
	places: Place[],
	geoJson: GeoJSON,
	opts: { isStale?: () => boolean } = {},
): Promise<Place[] | null> => {
	const test = createAreaTester(geoJson);
	const result: Place[] = [];
	for (let start = 0; start < places.length; start += SWEEP_CHUNK_SIZE) {
		if (opts.isStale?.()) return null;
		const end = Math.min(start + SWEEP_CHUNK_SIZE, places.length);
		for (let i = start; i < end; i++) {
			const place = places[i];
			if (test(place.lon, place.lat)) result.push(place);
		}
		if (end < places.length) await yieldToMain();
	}
	if (opts.isStale?.()) return null;
	return result;
};

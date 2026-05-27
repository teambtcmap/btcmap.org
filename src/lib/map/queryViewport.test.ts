import { describe, expect, it } from "vitest";

import { parseLatLongQuery } from "./queryViewport";

const sp = (qs: string): URLSearchParams => new URLSearchParams(qs);

describe("parseLatLongQuery", () => {
	it("returns null when neither lat nor long is present", () => {
		expect(parseLatLongQuery(sp(""))).toBeNull();
		expect(parseLatLongQuery(sp("foo=bar"))).toBeNull();
	});

	it("returns null when only one of lat/long is present", () => {
		expect(parseLatLongQuery(sp("lat=40"))).toBeNull();
		expect(parseLatLongQuery(sp("long=-74"))).toBeNull();
	});

	it('returns a "point" for a single lat/long pair', () => {
		expect(parseLatLongQuery(sp("lat=40&long=-74"))).toEqual({
			kind: "point",
			lat: 40,
			lng: -74,
		});
	});

	it('returns "bounds" with canonicalized SW/NE for two pairs', () => {
		// Pass them out-of-order; the helper should sort to SW/NE
		// regardless of which corner the embed listed first.
		const got = parseLatLongQuery(sp("lat=41&long=-73&lat=40&long=-74"));
		expect(got).toEqual({
			kind: "bounds",
			sw: [-74, 40],
			ne: [-73, 41],
		});
	});

	it("uses the first two pairs when three or more are supplied", () => {
		const got = parseLatLongQuery(
			sp("lat=10&long=10&lat=20&long=20&lat=99&long=99"),
		);
		expect(got).toEqual({
			kind: "bounds",
			sw: [10, 10],
			ne: [20, 20],
		});
	});

	it("falls back to a single point when counts are asymmetric", () => {
		// Legacy /map treated mismatched counts (1 lat + 2 longs, etc.) as
		// a single point using the first of each — preserve that.
		expect(parseLatLongQuery(sp("lat=40&long=-74&long=-73"))).toEqual({
			kind: "point",
			lat: 40,
			lng: -74,
		});
		expect(parseLatLongQuery(sp("lat=40&lat=41&long=-74"))).toEqual({
			kind: "point",
			lat: 40,
			lng: -74,
		});
	});

	it("returns null when any coordinate is non-numeric", () => {
		expect(parseLatLongQuery(sp("lat=abc&long=-74"))).toBeNull();
		expect(parseLatLongQuery(sp("lat=40&long=xyz"))).toBeNull();
	});

	it("returns null when any coordinate is out of range", () => {
		expect(parseLatLongQuery(sp("lat=91&long=0"))).toBeNull();
		expect(parseLatLongQuery(sp("lat=-91&long=0"))).toBeNull();
		expect(parseLatLongQuery(sp("lat=0&long=181"))).toBeNull();
		expect(parseLatLongQuery(sp("lat=0&long=-181"))).toBeNull();
	});

	it("returns null when either pair in a bounds query is invalid", () => {
		expect(
			parseLatLongQuery(sp("lat=40&long=-74&lat=200&long=-73")),
		).toBeNull();
	});

	it("returns null when any coordinate is empty", () => {
		expect(parseLatLongQuery(sp("lat=&long=-74"))).toBeNull();
		expect(parseLatLongQuery(sp("lat=40&long="))).toBeNull();
	});
});

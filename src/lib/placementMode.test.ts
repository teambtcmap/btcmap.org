import { describe, expect, it } from "vitest";

import { buildAddLocationUrl, parseCoordsParams } from "./placementMode";

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

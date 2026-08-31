import { describe, expect, it } from "vitest";

import { buildRadiusSearchUrl, filterValidPlaces } from "./radiusSearch";

describe("buildRadiusSearchUrl", () => {
	it("produces the exact expected URL for a sample center/radius/fields", () => {
		expect(
			buildRadiusSearchUrl(
				{ lat: 42.2762511, lon: 42.7024218 },
				0.075,
				"id,name",
			),
		).toBe(
			"https://api.btcmap.org/v4/places/search/?lat=42.2762511&lon=42.7024218&radius_km=0.075&fields=id,name",
		);
	});
});

describe("filterValidPlaces", () => {
	it("drops rows with missing or string ids while keeping numeric-id rows", () => {
		const rows = [
			{ id: 1, name: "Kiosk 87" },
			{ id: "x", name: "bad id" },
			{ name: "missing id" },
			{ id: 2, name: "Cafe" },
		];
		expect(filterValidPlaces(rows)).toEqual([
			{ id: 1, name: "Kiosk 87" },
			{ id: 2, name: "Cafe" },
		]);
	});
});

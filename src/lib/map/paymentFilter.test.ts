import { describe, expect, it } from "vitest";

import type { Place } from "$lib/types";

import {
	parsePaymentFilter,
	placeMatchesPaymentFilter,
	serializePaymentFilter,
} from "./paymentFilter";

let nextId = 1;
function place(overrides: Partial<Place> = {}): Place {
	return { id: nextId++, lat: 0, lon: 0, ...overrides } as Place;
}

describe("parsePaymentFilter", () => {
	it("returns null when no payment param is present", () => {
		expect(parsePaymentFilter(new URLSearchParams(""))).toBeNull();
		expect(parsePaymentFilter(new URLSearchParams("?basemap=7"))).toBeNull();
		expect(
			parsePaymentFilter(new URLSearchParams("?lat=52.5&long=13.4")),
		).toBeNull();
	});

	it("flags each documented param", () => {
		expect(parsePaymentFilter(new URLSearchParams("?onchain"))).toEqual({
			onchain: true,
			lightning: false,
			nfc: false,
		});
		expect(parsePaymentFilter(new URLSearchParams("?lightning"))).toEqual({
			onchain: false,
			lightning: true,
			nfc: false,
		});
		expect(parsePaymentFilter(new URLSearchParams("?nfc"))).toEqual({
			onchain: false,
			lightning: false,
			nfc: true,
		});
	});

	it("combines params (?onchain&lightning — the documented embed form)", () => {
		expect(
			parsePaymentFilter(new URLSearchParams("?onchain&lightning")),
		).toEqual({ onchain: true, lightning: true, nfc: false });
	});

	// Presence alone counts, matching the legacy Leaflet params — a
	// well-meaning ?lightning=false still engages the filter.
	it("uses presence semantics, ignoring any param value", () => {
		expect(parsePaymentFilter(new URLSearchParams("?lightning=false"))).toEqual(
			{ onchain: false, lightning: true, nfc: false },
		);
	});
});

describe("placeMatchesPaymentFilter", () => {
	const filter = (
		overrides: Partial<{ onchain: boolean; lightning: boolean; nfc: boolean }>,
	) => ({ onchain: false, lightning: false, nfc: false, ...overrides });

	it("requires the flagged tag to be exactly 'yes'", () => {
		const f = filter({ onchain: true });
		expect(
			placeMatchesPaymentFilter(place({ "osm:payment:onchain": "yes" }), f),
		).toBe(true);
		expect(placeMatchesPaymentFilter(place({}), f)).toBe(false);
		// Live OSM data carries "no" and free-text noise ("Yes", "yed",
		// addresses) in these tags — only a literal "yes" may match, exactly
		// like the legacy Leaflet filter.
		for (const noise of ["no", "Yes", "YES", "yed", "y"]) {
			expect(
				placeMatchesPaymentFilter(
					place({ "osm:payment:onchain": noise as "yes" }),
					f,
				),
			).toBe(false);
		}
	});

	it("ANDs multiple flagged methods, like the legacy filter", () => {
		const f = filter({ onchain: true, lightning: true });
		expect(
			placeMatchesPaymentFilter(
				place({
					"osm:payment:onchain": "yes",
					"osm:payment:lightning": "yes",
				}),
				f,
			),
		).toBe(true);
		expect(
			placeMatchesPaymentFilter(place({ "osm:payment:onchain": "yes" }), f),
		).toBe(false);
		expect(
			placeMatchesPaymentFilter(place({ "osm:payment:lightning": "yes" }), f),
		).toBe(false);
	});

	it("maps nfc to the lightning_contactless tag", () => {
		const f = filter({ nfc: true });
		expect(
			placeMatchesPaymentFilter(
				place({ "osm:payment:lightning_contactless": "yes" }),
				f,
			),
		).toBe(true);
		// The plain lightning tag must not satisfy nfc.
		expect(
			placeMatchesPaymentFilter(place({ "osm:payment:lightning": "yes" }), f),
		).toBe(false);
	});

	it("ignores unflagged methods entirely", () => {
		const f = filter({ lightning: true });
		expect(
			placeMatchesPaymentFilter(
				place({
					"osm:payment:lightning": "yes",
					"osm:payment:onchain": "no" as "yes",
				}),
				f,
			),
		).toBe(true);
	});
});

describe("serializePaymentFilter", () => {
	it("is 'off' for null and never empty for an active filter", () => {
		expect(serializePaymentFilter(null)).toBe("off");
		expect(
			serializePaymentFilter({ onchain: true, lightning: false, nfc: false }),
		).not.toBe("");
	});

	it("distinguishes every combination", () => {
		const combos = [
			{ onchain: true, lightning: false, nfc: false },
			{ onchain: false, lightning: true, nfc: false },
			{ onchain: false, lightning: false, nfc: true },
			{ onchain: true, lightning: true, nfc: false },
			{ onchain: true, lightning: true, nfc: true },
		];
		const serialized = combos.map(serializePaymentFilter);
		expect(new Set(serialized).size).toBe(combos.length);
		expect(serialized).not.toContain("off");
	});
});

import { describe, expect, it } from "vitest";

import type { Place } from "$lib/types";

import {
	PAYMENT_METHODS,
	parsePaymentMethodsParam,
	placeMatchesPaymentMethods,
	placePaymentFilterState,
	readPaymentTag,
	serializePaymentMethodsParam,
} from "./paymentMethodFilter";

let nextId = 1;
const place = (overrides: Partial<Place> = {}): Place =>
	({ id: nextId++, lat: 0, lon: 0, ...overrides }) as Place;

// The generated types promise "yes", but the wire data is untrusted: OSM
// carries "no", "only", casing variants and outright junk in these fields.
const tagged = (lightning: string): Place =>
	({
		id: nextId++,
		lat: 0,
		lon: 0,
		"osm:payment:lightning": lightning,
	}) as unknown as Place;

describe("parsePaymentMethodsParam", () => {
	it("reads bare presence params (the legacy embed form)", () => {
		expect(
			parsePaymentMethodsParam(new URLSearchParams("?onchain&nfc")),
		).toEqual(new Set(["onchain", "nfc"]));
	});

	it("counts any value as present", () => {
		expect(
			parsePaymentMethodsParam(new URLSearchParams("?lightning=1")),
		).toEqual(new Set(["lightning"]));
	});

	it("is null when no recognized param appears", () => {
		expect(parsePaymentMethodsParam(new URLSearchParams(""))).toBeNull();
		expect(
			parsePaymentMethodsParam(new URLSearchParams("?paid=true")),
		).toBeNull();
	});

	it("ignores unrecognized payment-ish params", () => {
		expect(
			parsePaymentMethodsParam(new URLSearchParams("?cash&bitcoin")),
		).toBeNull();
	});
});

describe("serializePaymentMethodsParam", () => {
	it("round-trips through parse in canonical PAYMENT_METHODS order", () => {
		const parsed = parsePaymentMethodsParam(
			new URLSearchParams("?nfc&onchain"),
		);
		expect(parsed && serializePaymentMethodsParam(parsed)).toBe("onchain,nfc");
	});
});

describe("placeMatchesPaymentMethods", () => {
	it("requires every selected method to be tagged yes", () => {
		const full = place({
			"osm:payment:onchain": "yes",
			"osm:payment:lightning": "yes",
			"osm:payment:lightning_contactless": "yes",
		});
		for (const method of PAYMENT_METHODS) {
			expect(placeMatchesPaymentMethods(full, new Set([method]))).toBe(true);
		}
		expect(placeMatchesPaymentMethods(full, new Set(PAYMENT_METHODS))).toBe(
			true,
		);
	});

	it("drops places missing any selected method", () => {
		const lnOnly = place({ "osm:payment:lightning": "yes" });
		expect(placeMatchesPaymentMethods(lnOnly, new Set(["lightning"]))).toBe(
			true,
		);
		expect(placeMatchesPaymentMethods(lnOnly, new Set(["onchain"]))).toBe(
			false,
		);
		expect(
			placeMatchesPaymentMethods(lnOnly, new Set(["lightning", "onchain"])),
		).toBe(false);
	});

	it("treats non-yes tag values as not accepted", () => {
		// The generated types promise "yes", but the wire data is untrusted —
		// anything else must fail the match.
		const noTag = {
			id: nextId++,
			lat: 0,
			lon: 0,
			"osm:payment:onchain": "no",
		} as unknown as Place;
		expect(placeMatchesPaymentMethods(noTag, new Set(["onchain"]))).toBe(false);
	});

	it("accepts every spelling that normalizes to yes", () => {
		for (const value of ["yes", "Yes", "YES", " yes ", "only", "Only"]) {
			expect(
				placeMatchesPaymentMethods(tagged(value), new Set(["lightning"])),
			).toBe(true);
		}
	});

	it("keeps excluding refusals and unusable values", () => {
		for (const value of ["no", "No", "y", "yed", "2024-01-01"]) {
			expect(
				placeMatchesPaymentMethods(tagged(value), new Set(["lightning"])),
			).toBe(false);
		}
	});

	it("maps nfc onto lightning_contactless only", () => {
		const contactless = place({ "osm:payment:lightning_contactless": "yes" });
		expect(placeMatchesPaymentMethods(contactless, new Set(["nfc"]))).toBe(
			true,
		);
		expect(
			placeMatchesPaymentMethods(contactless, new Set(["lightning"])),
		).toBe(false);
	});
});

describe("readPaymentTag", () => {
	it("reads the three states an OSM tag can be in", () => {
		expect(readPaymentTag("yes")).toBe("yes");
		expect(readPaymentTag("no")).toBe("no");
		expect(readPaymentTag(undefined)).toBe("unknown");
	});

	it("normalizes case and surrounding whitespace", () => {
		for (const value of ["Yes", "YES", " yes ", "\tyes\n"]) {
			expect(readPaymentTag(value)).toBe("yes");
		}
		expect(readPaymentTag(" No ")).toBe("no");
	});

	it("reads only as the most emphatic yes", () => {
		// payment:X=only means "this method and nothing else" — the strongest
		// yes OSM can express, which a bare === "yes" test reads as a refusal.
		expect(readPaymentTag("only")).toBe("yes");
		expect(readPaymentTag("Only")).toBe("yes");
	});

	it("treats unrecognized values as unknown rather than as no", () => {
		// All of these sit in live payment fields (2026-09-20). They record
		// nothing usable, which is not the same as recording a refusal.
		for (const junk of ["y", "yea", "yed", "yno", "2024-01-01", "a@b.com"]) {
			expect(readPaymentTag(junk)).toBe("unknown");
		}
		expect(readPaymentTag("")).toBe("unknown");
		expect(readPaymentTag("   ")).toBe("unknown");
	});
});

describe("placePaymentFilterState", () => {
	it("matches only when every selected method is a yes", () => {
		const both = place({
			"osm:payment:onchain": "yes",
			"osm:payment:lightning": "yes",
		});
		expect(
			placePaymentFilterState(both, new Set(["onchain", "lightning"])),
		).toBe("match");
		expect(placePaymentFilterState(both, new Set(["nfc"]))).toBe("unknown");
	});

	it("separates a refusal from a blank", () => {
		expect(placePaymentFilterState(tagged("no"), new Set(["lightning"]))).toBe(
			"no",
		);
		expect(placePaymentFilterState(place(), new Set(["lightning"]))).toBe(
			"unknown",
		);
		expect(placePaymentFilterState(tagged("yed"), new Set(["lightning"]))).toBe(
			"unknown",
		);
	});

	it("reports a refusal ahead of an unknown across selected methods", () => {
		// Mixed evidence: one method refused, one never recorded. The refusal
		// is the stronger statement — this place is not a verification lead.
		const mixed = {
			id: 99,
			lat: 0,
			lon: 0,
			"osm:payment:onchain": "no",
		} as unknown as Place;
		expect(
			placePaymentFilterState(mixed, new Set(["onchain", "lightning"])),
		).toBe("no");
	});
});

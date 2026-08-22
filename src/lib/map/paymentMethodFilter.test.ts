import { describe, expect, it } from "vitest";

import type { Place } from "$lib/types";

import {
	PAYMENT_METHODS,
	parsePaymentMethodsParam,
	placeMatchesPaymentMethods,
	serializePaymentMethodsParam,
} from "./paymentMethodFilter";

let nextId = 1;
const place = (overrides: Partial<Place> = {}): Place =>
	({ id: nextId++, lat: 0, lon: 0, ...overrides }) as Place;

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

import { describe, expect, it } from "vitest";

import {
	buildPlaceSubmissionArgs,
	buildSubmitPlaceParams,
} from "./placeSubmission";

const fullForm = {
	name: "Satoshi's Comics",
	nameEn: "Satoshi Comics",
	address: "Nansenstr. 1, Berlin",
	lat: 52.48841,
	long: 13.42986,
	category: "shop",
	methods: ["onchain", "lightning"],
	website: "https://example.com",
	phone: "+49 30 123456",
	hours: "Mo-Fr 10:00-18:00",
	notes: "Ring the bell",
	contact: "owner@example.com",
};

describe("buildSubmitPlaceParams", () => {
	it("maps the core fields and renames long to lon", () => {
		const params = buildSubmitPlaceParams(fullForm, "uuid-1");
		expect(params.origin).toBe("btcmap-website");
		expect(params.external_id).toBe("uuid-1");
		expect(params.lat).toBe(52.48841);
		expect(params.lon).toBe(13.42986);
		expect(params.name).toBe("Satoshi's Comics");
		expect(params.category).toBe("shop");
	});

	it("carries the rest in extra_fields and drops empty values", () => {
		const { extra_fields } = buildSubmitPlaceParams(fullForm, "uuid-1");
		expect(extra_fields).toEqual({
			"name:en": "Satoshi Comics",
			address: "Nansenstr. 1, Berlin",
			payment_methods: "onchain,lightning",
			website: "https://example.com",
			phone: "+49 30 123456",
			opening_hours: "Mo-Fr 10:00-18:00",
			notes: "Ring the bell",
			contact: "owner@example.com",
			osm_edit_url:
				"https://www.openstreetmap.org/edit#map=21/52.48841/13.42986",
		});
		// Empty optionals must not appear.
		const { extra_fields: sparse } = buildSubmitPlaceParams(
			{ ...fullForm, nameEn: "" },
			"uuid-1",
		);
		expect("name:en" in sparse).toBe(false);
	});

	it("keeps zero coordinates", () => {
		const params = buildSubmitPlaceParams(
			{ ...fullForm, lat: 0, long: 0 },
			"uuid-2",
		);
		expect(params.lat).toBe(0);
		expect(params.lon).toBe(0);
	});
});

describe("buildPlaceSubmissionArgs", () => {
	it("maps the authorized-path body without identity or contact", () => {
		const args = buildPlaceSubmissionArgs(fullForm);
		expect(args).toEqual({
			lat: 52.48841,
			lon: 13.42986,
			category: "shop",
			name: "Satoshi's Comics",
			extra_fields: {
				"name:en": "Satoshi Comics",
				address: "Nansenstr. 1, Berlin",
				payment_methods: "onchain,lightning",
				website: "https://example.com",
				phone: "+49 30 123456",
				opening_hours: "Mo-Fr 10:00-18:00",
				notes: "Ring the bell",
				osm_edit_url:
					"https://www.openstreetmap.org/edit#map=21/52.48841/13.42986",
			},
		});
		// extra_fields are place fields (#1348) — the submitter's contact
		// email must never ride along, even when the form collected one.
		expect("contact" in args.extra_fields).toBe(false);
	});

	it("drops empty optionals", () => {
		const args = buildPlaceSubmissionArgs({
			...fullForm,
			nameEn: "",
			website: "",
			phone: "",
			hours: "",
			notes: "",
			methods: [],
		});
		expect(args.extra_fields).toEqual({
			address: "Nansenstr. 1, Berlin",
			osm_edit_url:
				"https://www.openstreetmap.org/edit#map=21/52.48841/13.42986",
		});
	});
});

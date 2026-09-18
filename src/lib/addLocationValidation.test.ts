import { describe, expect, it } from "vitest";

import type { DetailsInput } from "./addLocationValidation";
import {
	firstInvalidField,
	isValidEmail,
	normalizeWebsite,
	recheckFlagged,
	validateDetails,
} from "./addLocationValidation";

const valid: DetailsInput = {
	name: "Satoshi Comics",
	address: "Nansenstr. 1, Berlin",
	addressRequired: true,
	category: "restaurants",
	categoryOther: "",
	methods: ["onchain"],
	website: "",
	contact: "owner@example.com",
	contactRequired: true,
};

describe("validateDetails", () => {
	it("passes a complete form", () => {
		expect(validateDetails(valid)).toEqual({});
	});

	it("requires a name, whitespace alone included", () => {
		expect(validateDetails({ ...valid, name: "" })).toEqual({
			name: "required",
		});
		expect(validateDetails({ ...valid, name: "   " })).toEqual({
			name: "required",
		});
	});

	it("requires the address only once a suggestion made it required", () => {
		expect(validateDetails({ ...valid, address: " " })).toEqual({
			address: "required",
		});
		expect(
			validateDetails({ ...valid, address: "", addressRequired: false }),
		).toEqual({});
	});

	it("requires a category, and a description when it's Other", () => {
		expect(validateDetails({ ...valid, category: "" })).toEqual({
			category: "required",
		});
		expect(
			validateDetails({ ...valid, category: "Other", categoryOther: "  " }),
		).toEqual({ category: "otherRequired" });
		expect(
			validateDetails({
				...valid,
				category: "Other",
				categoryOther: "Bike repair",
			}),
		).toEqual({});
	});

	it("requires at least one payment method", () => {
		expect(validateDetails({ ...valid, methods: [] })).toEqual({
			methods: "required",
		});
	});

	it("rejects a website it can't turn into an http(s) address", () => {
		expect(validateDetails({ ...valid, website: "not a site" })).toEqual({
			website: "invalid",
		});
		expect(validateDetails({ ...valid, website: "bitcoin.org" })).toEqual({});
	});

	it("requires a valid contact email on the anonymous path", () => {
		expect(validateDetails({ ...valid, contact: " " })).toEqual({
			contact: "required",
		});
		expect(validateDetails({ ...valid, contact: "owner@" })).toEqual({
			contact: "invalid",
		});
	});

	it("skips the contact email when an account is attached", () => {
		expect(
			validateDetails({ ...valid, contact: "", contactRequired: false }),
		).toEqual({});
	});

	it("reports every invalid field at once", () => {
		expect(
			validateDetails({
				...valid,
				name: "",
				category: "",
				methods: [],
				website: "ftp://bitcoin.org",
				contact: "",
			}),
		).toEqual({
			name: "required",
			category: "required",
			methods: "required",
			website: "invalid",
			contact: "required",
		});
	});
});

describe("firstInvalidField", () => {
	it("follows the form's top-to-bottom order, not insertion order", () => {
		expect(firstInvalidField({ contact: "required", website: "invalid" })).toBe(
			"website",
		);
		expect(
			firstInvalidField({ methods: "required", category: "required" }),
		).toBe("category");
		expect(firstInvalidField({ contact: "invalid", name: "required" })).toBe(
			"name",
		);
	});

	it("is undefined when nothing is invalid", () => {
		expect(firstInvalidField({})).toBeUndefined();
	});
});

describe("recheckFlagged", () => {
	it("keeps a flagged field while the same rule still fails", () => {
		expect(
			recheckFlagged({ contact: "invalid" }, { contact: "invalid" }),
		).toEqual({ contact: "invalid" });
	});

	it("clears a flagged field once a different rule fails instead", () => {
		// Typing into an empty email, or emptying an invalid one: the user
		// is mid-correction, so the new rule waits for the next Review.
		expect(
			recheckFlagged({ contact: "required" }, { contact: "invalid" }),
		).toEqual({});
		expect(
			recheckFlagged({ contact: "invalid" }, { contact: "required" }),
		).toEqual({});
		// Picking Other fixes "pick a category"; its empty text field isn't
		// an error until the next Review.
		expect(
			recheckFlagged({ category: "required" }, { category: "otherRequired" }),
		).toEqual({});
	});

	it("clears a flagged field once it's valid", () => {
		expect(
			recheckFlagged(
				{ name: "required", contact: "required" },
				{
					contact: "required",
				},
			),
		).toEqual({ contact: "required" });
	});

	it("keeps fields the last Review didn't flag quiet", () => {
		expect(
			recheckFlagged(
				{ name: "required" },
				{
					name: "required",
					category: "required",
					methods: "required",
				},
			),
		).toEqual({ name: "required" });
	});
});

describe("normalizeWebsite", () => {
	it("leaves an empty field empty", () => {
		expect(normalizeWebsite("")).toBe("");
		expect(normalizeWebsite("   ")).toBe("");
	});

	it("keeps an http(s) address as typed, minus surrounding space", () => {
		expect(normalizeWebsite("https://bitcoin.org")).toBe("https://bitcoin.org");
		expect(normalizeWebsite(" http://bitcoin.org/shop ")).toBe(
			"http://bitcoin.org/shop",
		);
		expect(normalizeWebsite("HTTPS://Bitcoin.org")).toBe("HTTPS://Bitcoin.org");
	});

	it("puts https:// in front of a bare domain", () => {
		expect(normalizeWebsite("bitcoin.org")).toBe("https://bitcoin.org");
		expect(normalizeWebsite("www.bitcoin.org/en/")).toBe(
			"https://www.bitcoin.org/en/",
		);
		expect(normalizeWebsite("bitcoin.org:8080/shop")).toBe(
			"https://bitcoin.org:8080/shop",
		);
		expect(normalizeWebsite("//bitcoin.org")).toBe("https://bitcoin.org");
	});

	it("rejects other schemes", () => {
		expect(normalizeWebsite("ftp://bitcoin.org")).toBeNull();
		expect(normalizeWebsite("javascript:alert(1)")).toBeNull();
		expect(normalizeWebsite("mailto:owner@bitcoin.org")).toBeNull();
		expect(normalizeWebsite("data:text/html,hi")).toBeNull();
	});

	it("rejects credentials in the address", () => {
		expect(normalizeWebsite("https://user:pw@bitcoin.org")).toBeNull();
		expect(normalizeWebsite("user@bitcoin.org")).toBeNull();
	});

	it("rejects hosts that aren't a domain", () => {
		expect(normalizeWebsite("bitcoin")).toBeNull();
		expect(normalizeWebsite("https://localhost")).toBeNull();
		expect(normalizeWebsite("bitcoin.")).toBeNull();
		expect(normalizeWebsite(".org")).toBeNull();
		expect(normalizeWebsite("http:/bitcoin.org")).toBeNull();
	});

	it("rejects whitespace inside the address", () => {
		expect(normalizeWebsite("bitcoin org")).toBeNull();
		expect(normalizeWebsite("bitcoin.org/my shop")).toBeNull();
	});
});

describe("isValidEmail", () => {
	it("accepts what the browser's email input accepts", () => {
		expect(isValidEmail("owner@example.com")).toBe(true);
		expect(isValidEmail("first.last+tag@sub.example.co.uk")).toBe(true);
		// The HTML spec's rule needs no dot in the domain.
		expect(isValidEmail("owner@localhost")).toBe(true);
		// Browsers check an internationalized domain in its ASCII form.
		expect(isValidEmail("owner@bücher.de")).toBe(true);
	});

	it("ignores surrounding whitespace, as the email input does", () => {
		expect(isValidEmail("  owner@example.com ")).toBe(true);
	});

	it("rejects what the browser rejects", () => {
		expect(isValidEmail("")).toBe(false);
		expect(isValidEmail("owner")).toBe(false);
		expect(isValidEmail("owner@")).toBe(false);
		expect(isValidEmail("@example.com")).toBe(false);
		expect(isValidEmail("own er@example.com")).toBe(false);
		expect(isValidEmail("owner@exa mple.com")).toBe(false);
		expect(isValidEmail("owner@-example.com")).toBe(false);
		expect(isValidEmail("owner@example..com")).toBe(false);
		expect(isValidEmail("a@b@example.com")).toBe(false);
	});

	it("rejects URL syntax around an internationalized domain", () => {
		// The punycode conversion goes through the URL parser, which would
		// drop a port, path, query or fragment — and decode percent escapes —
		// before the domain rule ever saw them.
		for (const email of [
			"owner@bücher.de:80",
			"owner@bücher.de/path",
			"owner@bücher.de?x",
			"owner@bücher.de#x",
			"owner@bücher.de\\x",
			"owner@bü%63her.de",
		]) {
			expect(isValidEmail(email), email).toBe(false);
		}
	});
});

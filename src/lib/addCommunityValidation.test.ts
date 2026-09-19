import { describe, expect, it } from "vitest";

import type { CommunityInput } from "./addCommunityValidation";
import {
	firstInvalidCommunityField,
	validateCommunity,
} from "./addCommunityValidation";

const valid: CommunityInput = {
	locationSelected: true,
	name: "Bitcoin Sofia",
	icon: "",
	socials: "https://t.me/bitcoinsofia",
	contact: "hello@example.com",
	captcha: "abc123",
};

describe("validateCommunity", () => {
	it("passes a complete form", () => {
		expect(validateCommunity(valid)).toEqual({});
	});

	it("needs a location picked from the search results", () => {
		expect(validateCommunity({ ...valid, locationSelected: false })).toEqual({
			location: "required",
		});
	});

	it("needs a name, a way to join and a contact — whitespace doesn't count", () => {
		expect(validateCommunity({ ...valid, name: " " })).toEqual({
			name: "required",
		});
		expect(validateCommunity({ ...valid, socials: "\n" })).toEqual({
			socials: "required",
		});
		expect(validateCommunity({ ...valid, contact: "" })).toEqual({
			contact: "required",
		});
	});

	it("takes an optional icon only as an https address", () => {
		expect(
			validateCommunity({ ...valid, icon: "https://example.com/icon.png" }),
		).toEqual({});
		expect(
			validateCommunity({ ...valid, icon: " https://example.com/icon.png " }),
		).toEqual({});
		for (const icon of [
			// btcmap.org is served over https: a plain-http image is mixed
			// content, upgraded or blocked by the browser.
			"http://example.com/icon.png",
			"icon.png",
			"ftp://example.com/icon.png",
			"javascript:alert(1)",
		]) {
			expect(validateCommunity({ ...valid, icon }), icon).toEqual({
				icon: "invalid",
			});
		}
	});

	it("needs a captcha answer", () => {
		expect(validateCommunity({ ...valid, captcha: " " })).toEqual({
			captcha: "required",
		});
	});

	it("reports every invalid field at once", () => {
		expect(
			validateCommunity({
				locationSelected: false,
				name: "",
				icon: "nope",
				socials: "",
				contact: "",
				captcha: "",
			}),
		).toEqual({
			location: "required",
			name: "required",
			icon: "invalid",
			socials: "required",
			contact: "required",
			captcha: "required",
		});
	});
});

describe("firstInvalidCommunityField", () => {
	it("follows the form's top-to-bottom order", () => {
		expect(
			firstInvalidCommunityField({ captcha: "required", socials: "required" }),
		).toBe("socials");
		expect(
			firstInvalidCommunityField({ name: "required", location: "required" }),
		).toBe("location");
	});
});

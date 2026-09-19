import { describe, expect, it } from "vitest";

import type { VerifyInput } from "./verifyValidation";
import {
	firstInvalidVerifyField,
	validateVerification,
} from "./verifyValidation";

const ticked: VerifyInput = {
	accurate: true,
	changes: "",
	method: "Visited on Saturday",
	captcha: "abc123",
};

describe("validateVerification", () => {
	it("passes with the box ticked", () => {
		expect(validateVerification(ticked)).toEqual({});
	});

	it("passes with the changes described instead", () => {
		expect(
			validateVerification({
				...ticked,
				accurate: false,
				changes: "Closed on Mondays now",
			}),
		).toEqual({});
	});

	it("needs the box ticked or the changes described", () => {
		expect(
			validateVerification({ ...ticked, accurate: false, changes: "" }),
		).toEqual({ confirmation: "required" });
		// Whitespace describes nothing.
		expect(
			validateVerification({ ...ticked, accurate: false, changes: "  \n" }),
		).toEqual({ confirmation: "required" });
	});

	it("needs to know how it was verified", () => {
		expect(validateVerification({ ...ticked, method: " " })).toEqual({
			method: "required",
		});
	});

	it("needs a captcha answer", () => {
		expect(validateVerification({ ...ticked, captcha: " " })).toEqual({
			captcha: "required",
		});
	});

	it("reports every invalid field at once", () => {
		expect(
			validateVerification({
				accurate: false,
				changes: "",
				method: "",
				captcha: "",
			}),
		).toEqual({
			confirmation: "required",
			method: "required",
			captcha: "required",
		});
	});
});

describe("firstInvalidVerifyField", () => {
	it("follows the form's top-to-bottom order", () => {
		expect(
			firstInvalidVerifyField({ captcha: "required", method: "required" }),
		).toBe("method");
		expect(
			firstInvalidVerifyField({
				method: "required",
				confirmation: "required",
			}),
		).toBe("confirmation");
	});
});

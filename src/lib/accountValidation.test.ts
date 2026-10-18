import { describe, expect, it } from "vitest";

import {
	usernameChanged,
	validatePasswordChange,
	validateUsername,
} from "./accountValidation";

describe("validateUsername", () => {
	it("passes a name", () => {
		expect(validateUsername({ username: "alice" })).toEqual({});
	});

	it("flags a blank name", () => {
		expect(validateUsername({ username: "   " })).toEqual({
			username: "required",
		});
	});
});

describe("usernameChanged", () => {
	it("is false for the current name, also with surrounding spaces", () => {
		expect(usernameChanged(" alice ", "alice")).toBe(false);
	});

	it("is true for a different name", () => {
		expect(usernameChanged("alice2", "alice")).toBe(true);
	});

	// A blank name is a change the rule rejects, so submit stays enabled
	// and the user hears why instead of facing a dead button
	it("is true for a blank name", () => {
		expect(usernameChanged("", "alice")).toBe(true);
	});
});

describe("validatePasswordChange", () => {
	const valid = {
		current: "old password",
		next: "new password",
		confirm: "new password",
	};

	it("passes a complete change", () => {
		expect(validatePasswordChange(valid)).toEqual({});
	});

	it("flags a missing current password", () => {
		expect(validatePasswordChange({ ...valid, current: "" })).toEqual({
			current: "required",
		});
	});

	it("flags a missing new password, without a mismatch on the confirmation", () => {
		expect(
			validatePasswordChange({ ...valid, next: "", confirm: "x" }),
		).toEqual({ next: "required" });
	});

	it("flags a short new password", () => {
		expect(
			validatePasswordChange({ ...valid, next: "short", confirm: "short" }),
		).toEqual({ next: "tooShort" });
	});

	it("counts characters, not UTF-16 units", () => {
		// 7 emoji are 14 UTF-16 units but 7 characters
		const sevenEmoji = "😀".repeat(7);
		expect(
			validatePasswordChange({
				...valid,
				next: sevenEmoji,
				confirm: sevenEmoji,
			}),
		).toEqual({ next: "tooShort" });
	});

	it("flags a confirmation that doesn't match", () => {
		expect(
			validatePasswordChange({ ...valid, confirm: "new passwort" }),
		).toEqual({ confirm: "mismatch" });
	});
});

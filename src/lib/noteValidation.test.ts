import { describe, expect, it } from "vitest";

import { NOTE_TEXT_MAX_LENGTH, validateNote } from "./noteValidation";

describe("validateNote", () => {
	it("accepts text with content", () => {
		expect(validateNote({ text: "ATM is inside, ask at the bar" })).toEqual({});
	});

	it("requires text that is not blank once trimmed", () => {
		expect(validateNote({ text: "" })).toEqual({ text: "required" });
		expect(validateNote({ text: " \n\t " })).toEqual({ text: "required" });
	});

	it("caps the trimmed text at the API's limit, counting characters", () => {
		// The API counts Unicode scalar values, so an emoji counts once.
		expect(validateNote({ text: "🟠".repeat(NOTE_TEXT_MAX_LENGTH) })).toEqual(
			{},
		);
		expect(
			validateNote({ text: `  ${"a".repeat(NOTE_TEXT_MAX_LENGTH)}  ` }),
		).toEqual({});
		expect(
			validateNote({ text: "a".repeat(NOTE_TEXT_MAX_LENGTH + 1) }),
		).toEqual({ text: "tooLong" });
	});
});

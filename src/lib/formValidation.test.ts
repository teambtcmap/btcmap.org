import { describe, expect, it } from "vitest";

import { firstInvalid, recheckFlagged } from "./formValidation";

describe("firstInvalid", () => {
	it("follows the given order, not the errors' insertion order", () => {
		const order = ["name", "email", "captcha"] as const;
		expect(firstInvalid(order, { captcha: "required", email: "invalid" })).toBe(
			"email",
		);
	});

	it("is undefined when nothing is invalid", () => {
		expect(firstInvalid(["name"], {})).toBeUndefined();
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
		// is mid-correction, so the new rule waits for the next submit.
		expect(
			recheckFlagged({ contact: "required" }, { contact: "invalid" }),
		).toEqual({});
		expect(
			recheckFlagged({ contact: "invalid" }, { contact: "required" }),
		).toEqual({});
		// Picking Other fixes "pick a category"; its empty text field isn't
		// an error until the next submit.
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

	it("keeps fields the last submit didn't flag quiet", () => {
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

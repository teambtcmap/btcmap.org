import type { AnyFieldApi, AnyFormApi } from "@tanstack/svelte-form";
import { describe, expect, it, vi } from "vitest";

import { fieldError, inputProps, ruleValidation } from "./ruleValidation";

type Values = { name: string; email: string };
type Errors = { name?: "required"; email?: "required" | "invalid" };

const rules = (value: Values): Errors => {
	const errors: Errors = {};
	if (!value.name.trim()) errors.name = "required";
	if (!value.email) errors.email = "required";
	else if (!value.email.includes("@")) errors.email = "invalid";
	return errors;
};

const submitting = { state: { isSubmitting: true } } as unknown as AnyFormApi;
const editing = { state: { isSubmitting: false } } as unknown as AnyFormApi;

const setup = () => {
	const name = document.createElement("input");
	const email = document.createElement("input");
	document.body.append(name, email);
	name.scrollIntoView = vi.fn();
	email.scrollIntoView = vi.fn();
	const validation = ruleValidation({
		order: ["name", "email"],
		validate: rules,
		controls: { name: () => name, email: () => email },
	});
	const run = (value: Values, formApi: AnyFormApi) =>
		validation.options.validators.onDynamic({ value, formApi });
	return { validation, run, name, email };
};

describe("ruleValidation", () => {
	it("reports every failed rule on submit", () => {
		const { run } = setup();
		expect(run({ name: "", email: "" }, submitting)).toEqual({
			fields: { name: "required", email: "required" },
		});
		expect(run({ name: "Ada", email: "ada@example.com" }, submitting)).toBe(
			undefined,
		);
	});

	it("re-checks only what the last submit flagged while editing", () => {
		const { run } = setup();
		run({ name: "", email: "ada@example.com" }, submitting);
		// The email breaks after the submit: quiet until the next one.
		expect(run({ name: "", email: "" }, editing)).toEqual({
			fields: { name: "required" },
		});
		// The flagged name is fixed: it clears.
		expect(run({ name: "Ada", email: "" }, editing)).toBe(undefined);
		// The next submit reports what's wrong now.
		expect(run({ name: "Ada", email: "" }, submitting)).toEqual({
			fields: { email: "required" },
		});
	});

	it("goes quiet when a flagged field fails a different rule", () => {
		const { run } = setup();
		run({ name: "Ada", email: "" }, submitting);
		// Typing into the empty email: mid-correction, no new message.
		expect(run({ name: "Ada", email: "ada" }, editing)).toBe(undefined);
	});

	it("focuses the first flagged field in form order on an invalid submit", async () => {
		const { validation, run, email } = setup();
		run({ name: "Ada", email: "" }, submitting);
		validation.options.onSubmitInvalid();
		await vi.waitFor(() => expect(document.activeElement).toBe(email));
		expect(email.scrollIntoView).toHaveBeenCalledWith({ block: "center" });
	});

	it("forgets the flagged fields on reset", () => {
		const { validation, run } = setup();
		run({ name: "", email: "" }, submitting);
		validation.reset();
		expect(run({ name: "", email: "" }, editing)).toBe(undefined);
	});
});

describe("fieldError", () => {
	it("is the field's first error, as a string", () => {
		const field = { state: { meta: { errors: ["invalid", "required"] } } };
		expect(fieldError(field as unknown as AnyFieldApi)).toBe("invalid");
		const clean = { state: { meta: { errors: [] } } };
		expect(fieldError(clean as unknown as AnyFieldApi)).toBeUndefined();
	});
});

describe("inputProps", () => {
	it("binds a text control to the field", () => {
		const handleChange = vi.fn();
		const field = { state: { value: "Ada" }, handleChange };
		const props = inputProps(field as unknown as AnyFieldApi);
		expect(props.value).toBe("Ada");
		const input = document.createElement("input");
		input.value = "Ada L";
		input.addEventListener("input", props.oninput);
		input.dispatchEvent(new Event("input"));
		expect(handleChange).toHaveBeenCalledWith("Ada L");
	});
});

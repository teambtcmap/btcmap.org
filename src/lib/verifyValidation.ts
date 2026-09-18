import { firstInvalid } from "$lib/formValidation";

// The verification reports' rules (#1407, #1408). /verify-location and a
// community's Maintain tab ask the same things: confirm the listing is
// accurate or describe what changed (one of the two), say how it was
// verified, and answer the captcha. Kept DOM-free so the rules are
// unit-tested; each form maps the codes to its own messages.
export type VerifyInput = {
	// The "information is correct" box.
	accurate: boolean;
	// What's outdated or needs updating.
	changes: string;
	// How the reporter verified it.
	method: string;
	captcha: string;
};

export type VerifyErrors = {
	confirmation?: "required";
	method?: "required";
	captcha?: "required";
};

export type VerifyField = keyof VerifyErrors;

// Top to bottom as both forms render them.
const FIELD_ORDER: VerifyField[] = ["confirmation", "method", "captcha"];

export const firstInvalidVerifyField = (
	errors: VerifyErrors,
): VerifyField | undefined => firstInvalid(FIELD_ORDER, errors);

export const validateVerification = (input: VerifyInput): VerifyErrors => {
	const errors: VerifyErrors = {};
	if (!input.accurate && !input.changes.trim()) {
		errors.confirmation = "required";
	}
	if (!input.method.trim()) errors.method = "required";
	if (!input.captcha.trim()) errors.captcha = "required";
	return errors;
};

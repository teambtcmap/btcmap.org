import { PASSWORD_MIN_LENGTH } from "#lib/passwordPolicy.js";

// Rules for the account page's forms (#1541). The API checks nothing on
// these calls, so these are the only guard; the rules follow Android's
// AuthValidation so both apps accept the same input.

export type UsernameInput = { username: string };
export type UsernameErrors = { username?: "required" };

export const USERNAME_FIELD_ORDER = ["username"] as const;

export const validateUsername = (input: UsernameInput): UsernameErrors =>
	input.username.trim() ? {} : { username: "required" };

// Submit is disabled only while the field still holds the current name; a
// blank one goes through, so the rule can say why it's refused.
export const usernameChanged = (input: string, current: string): boolean =>
	input.trim() !== current;

export type PasswordChangeInput = {
	current: string;
	next: string;
	confirm: string;
};
export type PasswordChangeErrors = {
	current?: "required";
	next?: "required" | "tooShort";
	confirm?: "mismatch";
};

export const PASSWORD_FIELD_ORDER = ["current", "next", "confirm"] as const;

// Characters, not UTF-16 units, so an emoji counts once
const characterCount = (value: string) => [...value].length;

export const validatePasswordChange = (
	input: PasswordChangeInput,
): PasswordChangeErrors => {
	const errors: PasswordChangeErrors = {};
	if (!input.current) errors.current = "required";
	if (!input.next) errors.next = "required";
	else if (characterCount(input.next) < PASSWORD_MIN_LENGTH)
		errors.next = "tooShort";
	// Nothing to compare against without a new password, so the
	// confirmation isn't flagged as well
	if (input.next && input.next !== input.confirm) errors.confirm = "mismatch";
	return errors;
};

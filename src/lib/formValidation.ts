import { tick } from "svelte";

// The mechanics every form with inline validation repeats (#1404, #1406).
// Each form keeps its own rules — a pure function mapping each invalid
// field to the rule it failed — and uses these for the rest.

export type RuleErrors = Partial<Record<string, string>>;

// The first invalid field in the form's top-to-bottom order: the one that
// takes focus.
export const firstInvalid = <F extends string>(
	order: readonly F[],
	errors: Partial<Record<F, unknown>>,
): F | undefined => order.find((field) => errors[field]);

// As the user corrects the form, what the last submit flagged is
// re-checked: an error stays only while the same rule still fails. It
// clears once the field is valid — and also when a different rule fails
// instead (typing into an empty email, picking Other after a missing
// category): the user is mid-correction, so the new rule waits for the
// next submit, like fields that weren't flagged.
export const recheckFlagged = <E extends RuleErrors>(
	flagged: E,
	current: E,
): E =>
	Object.fromEntries(
		Object.entries(flagged).filter(
			([field, rule]) => rule && current[field] === rule,
		),
	) as E;

// Moves focus to an invalid control once its message is on screen: screen
// readers read the description as focus lands, so Svelte renders it
// first. The browser's own focus scroll would stop with the control at
// the scroller's edge, its label and message above it — under the map
// panel's sticky header — so focus without it and centre the control.
export const focusInvalid = async (
	control: HTMLElement | null | undefined,
): Promise<void> => {
	await tick();
	control?.focus({ preventScroll: true });
	control?.scrollIntoView({ block: "center" });
};

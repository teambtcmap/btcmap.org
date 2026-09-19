import type { RuleErrors } from "$lib/formValidation";
import {
	firstInvalid,
	focusInvalid,
	recheckFlagged,
} from "$lib/formValidation";

// SPIKE: the per-form wiring (#1404–#1411) in one place. A form passes its
// field order, a validate() that reads its current input, and the control
// each field focuses; it gets the errors plus check/recheck/reset.
type Options<F extends string, E extends RuleErrors> = {
	order: readonly F[];
	validate: () => E;
	controls: Record<F, () => HTMLElement | null | undefined>;
};

export const createValidation = <F extends string, E extends RuleErrors>(
	options: Options<F, E>,
) => {
	let errors = $state({} as E);
	return {
		get errors(): E {
			return errors;
		},
		// On submit: mark every invalid field and focus the first. True when
		// the form may go out.
		check(): boolean {
			errors = options.validate();
			const first = firstInvalid(options.order, errors);
			if (!first) return true;
			focusInvalid(options.controls[first]());
			return false;
		},
		// On input: only what the last submit flagged, same-rule semantics.
		recheck(): void {
			if (!firstInvalid(options.order, errors)) return;
			errors = recheckFlagged(errors, options.validate());
		},
		reset(): void {
			errors = {} as E;
		},
	};
};

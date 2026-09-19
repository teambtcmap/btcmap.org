import type { AnyFieldApi, AnyFormApi } from "@tanstack/svelte-form";
import { revalidateLogic } from "@tanstack/svelte-form";

import type { RuleErrors } from "$lib/formValidation";
import {
	firstInvalid,
	focusInvalid,
	recheckFlagged,
} from "$lib/formValidation";

// A form's rules on TanStack Form, with the app's inline validation
// semantics (#1404, #1406):
// - Submit checks every rule, marks each failed field and focuses the
//   first one (after its message renders, centred — focusInvalid).
// - While editing, only what the last submit flagged is re-checked, and an
//   error stays only while the same rule still fails. A different failure
//   waits for the next submit (recheckFlagged).
// The rules stay a pure, unit-tested function returning a rule code per
// failed field; the codes are the field errors, so each form maps them to
// messages in its template and they follow the locale.
type Options<V, F extends string, E extends RuleErrors> = {
	// Top to bottom as the form renders them.
	order: readonly F[];
	validate: (value: V) => E;
	// The control each field's error focuses; it gets the failed rule, for
	// a field whose rules belong to different controls.
	controls: Record<F, (rule: string) => HTMLElement | null | undefined>;
};

// What submit() needs of a form: any createForm() result fits, whatever
// its type parameters.
type SubmittableForm = {
	validate: (cause: "submit") => unknown;
	handleSubmit: () => unknown;
};

export const ruleValidation = <V, F extends string, E extends RuleErrors>(
	options: Options<V, F, E>,
) => {
	let flagged = {} as E;
	// Set while submit() runs its own full check (see there).
	let checkingAll = false;
	return {
		// Spread into createForm's options.
		options: {
			// Validate on submit, then on every change.
			validationLogic: revalidateLogic({
				mode: "submit",
				modeAfterSubmission: "change",
			}),
			validators: {
				onDynamic: ({ value, formApi }: { value: V; formApi: AnyFormApi }) => {
					const current = options.validate(value);
					flagged =
						checkingAll || formApi.state.isSubmitting
							? current
							: recheckFlagged(flagged, current);
					return firstInvalid(options.order, flagged)
						? { fields: flagged }
						: undefined;
				},
			},
			onSubmitInvalid: () => {
				const first = firstInvalid(options.order, flagged);
				if (first) {
					focusInvalid(options.controls[first](String(flagged[first])));
				}
			},
		},
		// The form's submit: use instead of form.handleSubmit(). Every submit
		// checks every rule, but TanStack only re-runs a form-level validator
		// on submit while no field shows an error — with one still showing,
		// it stops at the field check, and a field that went quiet
		// mid-correction would never be flagged again. So run the full check
		// first, then hand over (onSubmit, or onSubmitInvalid and focus).
		submit: (form: SubmittableForm) => {
			checkingAll = true;
			try {
				form.validate("submit");
			} finally {
				checkingAll = false;
			}
			return form.handleSubmit();
		},
		// Alongside form.reset(): nothing is flagged anymore.
		reset: () => {
			flagged = {} as E;
		},
	};
};

// A field's rule code, if it failed one.
export const fieldError = (field: AnyFieldApi): string | undefined => {
	const [error] = field.state.meta.errors;
	return error ? String(error) : undefined;
};

// A text control (TextField, TextArea, CaptchaField) bound to its field:
// spread as {...inputProps(field)}.
export const inputProps = (field: AnyFieldApi) => ({
	value: field.state.value as string,
	oninput: (event: Event) =>
		field.handleChange(
			(event.currentTarget as HTMLInputElement | HTMLTextAreaElement).value,
		),
});

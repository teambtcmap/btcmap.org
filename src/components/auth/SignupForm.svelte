<script lang="ts">
import { createForm } from "@tanstack/svelte-form";

import type { SignupSource } from "#lib/analytics.js";
import { trackEvent, trackFailure } from "#lib/analytics.js";
import { errorStatus } from "#lib/apiError.js";
import { _ } from "#lib/i18n/index.js";
import {
	PASSWORD_MAX_LENGTH,
	PASSWORD_MIN_LENGTH,
} from "#lib/passwordPolicy.js";
import { fieldError, inputProps, ruleValidation } from "#lib/ruleValidation.js";
import type { Session } from "#lib/session.js";
import { isUsernameTaken, SignupTokenError, session } from "#lib/session.js";
import { USERNAME_MAX_LENGTH } from "#lib/usernamePolicy.js";
import { errToast } from "#lib/utils.js";
import TextField from "$components/form/TextField.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";

type Props = {
	// Caller receives the new session after a successful signup, matching the
	// LoginForm / NostrLoginForm contract so this can be reused inside modals.
	onSuccess: (session: Session) => void | Promise<void>;
	// Where the account is made (signup_create_account_success breakdown)
	source: SignupSource;
};

let { onSuccess, source }: Props = $props();

let usernameInput = $state<HTMLInputElement>();
let passwordInput = $state<HTMLInputElement>();
let loading = $state(false);
// Set when the API refused the last name as taken (409); cleared on edit
let usernameTaken = $state(false);

// Signup on TanStack Form (#1406). A too-short password on submit (#1411):
// the rule's own line under the label turns into the error, like
// add-location's payment group (#1397), instead of the browser's minlength
// bubble. It stays while still short and clears once long enough.
type SignupValues = { username: string; password: string };

const validation = ruleValidation({
	order: ["password"],
	validate: (value: SignupValues): { password?: "tooShort" } =>
		value.password.length < PASSWORD_MIN_LENGTH ? { password: "tooShort" } : {},
	controls: { password: () => passwordInput },
});

const form = createForm(() => ({
	defaultValues: { username: "", password: "" } as SignupValues,
	...validation.options,
	onSubmit: async ({ value }) => {
		loading = true;
		// Only this submit's answer counts
		usernameTaken = false;
		const username = value.username.trim();
		let current: Session;
		try {
			current = await session.signUp({ username, password: value.password });
		} catch (err) {
			if (err instanceof SignupTokenError) {
				// The account exists; it is the login part that failed
				trackEvent("signup_create_account_success", { source });
				errToast($_("signup.error"));
			} else if (isUsernameTaken(err)) {
				trackEvent("signup_create_account_failure", {
					source,
					status: "taken",
				});
				// Only for the name still in the field: an edit while the
				// request ran already answered it
				if (form.state.values.username.trim() === username) {
					usernameTaken = true;
					usernameInput?.focus();
				}
			} else {
				trackFailure("signup_create_account_failure", { source }, err);
				errToast($_("signup.error"));
			}
			// The status only: the error carries the request body, password
			// included
			const failed = err instanceof SignupTokenError ? err.cause : err;
			console.error("Signup failed:", errorStatus(failed) ?? "unknown");
			loading = false;
			return;
		}
		trackEvent("signup_create_account_success", { source });
		// The account exists from here on: a failing follow-up must not ask
		// for a retry, which would only answer that the name is taken
		try {
			await onSuccess(current);
		} catch (err) {
			console.error("Signup follow-up failed:", errorStatus(err) ?? "unknown");
		} finally {
			loading = false;
		}
	},
}));
const values = form.useSelector((state) => state.values);

const submitDisabled = $derived(
	loading ||
		values.current.username.trim().length === 0 ||
		values.current.password.length === 0,
);

function handleSubmit(event: SubmitEvent) {
	event.preventDefault();
	if (submitDisabled) return;
	validation.submit(form);
}
</script>

<!-- `novalidate`: the password's length rule is reported inline (#1411),
     not by the browser's bubble. -->
<form onsubmit={handleSubmit} novalidate class="space-y-4">
	<form.Field name="username">
		{#snippet children(field)}
			<TextField
				id="signup-username"
				label={$_("signup.username")}
				autocomplete="username"
				maxlength={USERNAME_MAX_LENGTH}
				error={usernameTaken ? $_("signup.usernameTaken") : undefined}
				{...inputProps(field, { onEdit: () => (usernameTaken = false) })}
				bind:element={usernameInput}
			/>
		{/snippet}
	</form.Field>

	<form.Field name="password">
		{#snippet children(field)}
			{@const tooShort = !!fieldError(field)}
			<TextField
				id="signup-password"
				label={$_("signup.password")}
				type="password"
				autocomplete="new-password"
				minlength={PASSWORD_MIN_LENGTH}
				maxlength={PASSWORD_MAX_LENGTH}
				aria-describedby="signup-password-rule"
				aria-invalid={tooShort ? "true" : undefined}
				{...inputProps(field)}
				bind:element={passwordInput}
			>
				<!-- The rule describes the field from the start and sits where
				     every form's messages sit, under the label; a rejected
				     submit turns the same line into the error. -->
				{#snippet hint()}
					<p
						id="signup-password-rule"
						class="-mt-1 mb-2 text-sm {tooShort
							? 'font-semibold text-error'
							: 'text-body dark:text-white/50'}"
					>
						{tooShort
							? $_("signup.passwordTooShort", { values: { min: PASSWORD_MIN_LENGTH } })
							: $_("signup.passwordHint", { values: { min: PASSWORD_MIN_LENGTH } })}
					</p>
				{/snippet}
			</TextField>
		{/snippet}
	</form.Field>

	<PrimaryButton
		type="submit"
		disabled={submitDisabled}
		busy={loading}
		style="w-full rounded-lg px-4 py-2 disabled:opacity-50 aria-disabled:opacity-50"
	>
		{loading ? $_("signup.creating") : $_("signup.submit")}
	</PrimaryButton>
</form>

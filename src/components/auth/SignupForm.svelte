<script lang="ts">
import { createForm } from "@tanstack/svelte-form";

import TextField from "$components/form/TextField.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import { trackEvent } from "$lib/analytics";
import { _ } from "$lib/i18n";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "$lib/passwordPolicy";
import { fieldError, inputProps, ruleValidation } from "$lib/ruleValidation";
import type { Session } from "$lib/session";
import { session } from "$lib/session";
import { errToast } from "$lib/utils";

type Props = {
	// Caller receives the new session after a successful signup, matching the
	// LoginForm / NostrLoginForm contract so this can be reused inside modals.
	onSuccess: (session: Session) => void | Promise<void>;
};

let { onSuccess }: Props = $props();

let passwordInput = $state<HTMLInputElement>();
let loading = $state(false);

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
		try {
			const current = await session.signUp({
				username: value.username.trim(),
				password: value.password,
			});
			trackEvent("signup_create_account_success");
			await onSuccess(current);
		} catch (err) {
			// The /v4/users endpoint surfaces duplicate-username as a 500 with a
			// generic body (no machine-readable error code), so we treat any
			// non-2xx the same way and let the user try a different name.
			errToast($_("signup.error"));
			console.error("Signup failed:", err);
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
				maxlength="100"
				{...inputProps(field)}
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
		style="w-full rounded-lg px-4 py-2 disabled:opacity-50"
	>
		{loading ? $_("signup.creating") : $_("signup.submit")}
	</PrimaryButton>
</form>

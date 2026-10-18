<script lang="ts">
import { createForm } from "@tanstack/svelte-form";

import { changePassword, errorStatus } from "#lib/account.js";
import type { PasswordChangeInput } from "#lib/accountValidation.js";
import {
	PASSWORD_FIELD_ORDER,
	validatePasswordChange,
} from "#lib/accountValidation.js";
import { trackEvent } from "#lib/analytics.js";
import { _ } from "#lib/i18n/index.js";
import {
	PASSWORD_MAX_LENGTH,
	PASSWORD_MIN_LENGTH,
} from "#lib/passwordPolicy.js";
import { fieldError, inputProps, ruleValidation } from "#lib/ruleValidation.js";
import { session } from "#lib/session.js";
import { errToast, successToast } from "#lib/utils.js";
import TextField from "$components/form/TextField.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";

// Change the account's password (#1541). Accounts created with Nostr have
// none, and the API can't tell us up front, so the form is always shown
// and says so when the API refuses.

let currentInput = $state<HTMLInputElement>();
let nextInput = $state<HTMLInputElement>();
let confirmInput = $state<HTMLInputElement>();
let loading = $state(false);
// The API's refusal of the last submit; cleared on edit
let refusal = $state<"wrongPassword" | "noPassword" | null>(null);

const EMPTY: PasswordChangeInput = { current: "", next: "", confirm: "" };

const validation = ruleValidation({
	order: PASSWORD_FIELD_ORDER,
	validate: validatePasswordChange,
	controls: {
		current: () => currentInput,
		next: () => nextInput,
		confirm: () => confirmInput,
	},
});

const form = createForm(() => ({
	defaultValues: { ...EMPTY },
	...validation.options,
	onSubmit: async ({ value }) => {
		const token = $session?.token;
		if (!token) return;
		loading = true;
		try {
			const result = await changePassword(token, value.current, value.next);
			if (result !== "changed") {
				refusal = result;
				currentInput?.focus();
				return;
			}
			form.reset({ ...EMPTY });
			validation.reset();
			trackEvent("account_password_change_success");
			successToast($_("account.password.success"));
		} catch (err) {
			errToast($_("account.password.error"));
			console.error("Password change failed:", errorStatus(err) ?? "unknown");
		} finally {
			loading = false;
		}
	},
}));

function handleSubmit(event: SubmitEvent) {
	event.preventDefault();
	if (loading) return;
	trackEvent("account_password_change_click");
	validation.submit(form);
}

const NEXT_MESSAGES = {
	required: "account.password.nextRequired",
	tooShort: "account.password.tooShort",
} as const;
</script>

<form onsubmit={handleSubmit} novalidate class="space-y-4">
	<form.Field name="current">
		{#snippet children(field)}
			{@const rule = fieldError(field)}
			<TextField
				id="account-password-current"
				label={$_("account.password.current")}
				type="password"
				autocomplete="current-password"
				maxlength={PASSWORD_MAX_LENGTH}
				error={rule
					? $_("account.password.currentRequired")
					: refusal
						? $_(`account.password.${refusal}`)
						: undefined}
				{...inputProps(field)}
				oninput={(event: Event) => {
					refusal = null;
					field.handleChange((event.currentTarget as HTMLInputElement).value);
				}}
				bind:element={currentInput}
			/>
		{/snippet}
	</form.Field>

	<form.Field name="next">
		{#snippet children(field)}
			{@const rule = fieldError(field) as keyof typeof NEXT_MESSAGES | undefined}
			<TextField
				id="account-password-next"
				label={$_("account.password.next")}
				type="password"
				autocomplete="new-password"
				maxlength={PASSWORD_MAX_LENGTH}
				aria-describedby={rule ? undefined : "account-password-next-hint"}
				error={rule
					? $_(NEXT_MESSAGES[rule], { values: { min: PASSWORD_MIN_LENGTH } })
					: undefined}
				{...inputProps(field)}
				bind:element={nextInput}
			>
				{#snippet hint()}
					{#if !rule}
						<p
							id="account-password-next-hint"
							class="-mt-1 mb-2 text-sm text-body dark:text-white/50"
						>
							{$_("signup.passwordHint", { values: { min: PASSWORD_MIN_LENGTH } })}
						</p>
					{/if}
				{/snippet}
			</TextField>
		{/snippet}
	</form.Field>

	<form.Field name="confirm">
		{#snippet children(field)}
			<TextField
				id="account-password-confirm"
				label={$_("account.password.confirm")}
				type="password"
				autocomplete="new-password"
				maxlength={PASSWORD_MAX_LENGTH}
				error={fieldError(field) ? $_("account.password.mismatch") : undefined}
				{...inputProps(field)}
				bind:element={confirmInput}
			/>
		{/snippet}
	</form.Field>

	<PrimaryButton
		type="submit"
		disabled={loading}
		style="rounded-lg px-4 py-2 disabled:opacity-50"
	>
		{loading ? $_("account.saving") : $_("account.password.submit")}
	</PrimaryButton>
</form>

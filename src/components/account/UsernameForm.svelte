<script lang="ts">
import { createForm } from "@tanstack/svelte-form";

import { changeUsername } from "#lib/account.js";
import { createAccountAction } from "#lib/accountAction.svelte.js";
import type { UsernameInput } from "#lib/accountValidation.js";
import {
	USERNAME_FIELD_ORDER,
	usernameChanged,
	validateUsername,
} from "#lib/accountValidation.js";
import { trackEvent } from "#lib/analytics.js";
import { _ } from "#lib/i18n/index.js";
import { fieldError, inputProps, ruleValidation } from "#lib/ruleValidation.js";
import { session } from "#lib/session.js";
import { USERNAME_MAX_LENGTH } from "#lib/usernamePolicy.js";
import { successToast } from "#lib/utils.js";
import TextField from "$components/form/TextField.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";

// Rename the account (#1541): the name shows on comments, photos and the
// leaderboard, and password logins use it.

let usernameInput = $state<HTMLInputElement>();
const save = createAccountAction("Username change");
// Set when the API refused the last name as taken; cleared on edit
let taken = $state(false);

const validation = ruleValidation({
	order: USERNAME_FIELD_ORDER,
	validate: validateUsername,
	controls: { username: () => usernameInput },
});

const form = createForm(() => ({
	defaultValues: { username: $session?.username ?? "" } as UsernameInput,
	...validation.options,
	onSubmit: async ({ value }) => {
		const token = $session?.token;
		if (!token) return;
		await save.run($_("account.username.error"), async () => {
			const result = await changeUsername(token, value.username.trim());
			if (result.status === "taken") {
				taken = true;
				usernameInput?.focus();
				return;
			}
			session.setUsername(token, result.username);
			form.setFieldValue("username", result.username);
			trackEvent("account_username_save_success");
			successToast($_("account.username.success"));
		});
	},
}));
const values = form.useSelector((state) => state.values);

const submitDisabled = $derived(
	save.pending ||
		!usernameChanged(values.current.username, $session?.username ?? ""),
);

function handleSubmit(event: SubmitEvent) {
	event.preventDefault();
	if (submitDisabled) return;
	trackEvent("account_username_save_click");
	validation.submit(form);
}
</script>

<form onsubmit={handleSubmit} novalidate class="space-y-4">
	<form.Field name="username">
		{#snippet children(field)}
			{@const rule = fieldError(field)}
			<TextField
				id="account-username"
				label={$_("account.username.label")}
				autocomplete="username"
				maxlength={USERNAME_MAX_LENGTH}
				error={rule
					? $_("account.username.required")
					: taken
						? $_("account.username.taken")
						: undefined}
				{...inputProps(field)}
				oninput={(event: Event) => {
					taken = false;
					field.handleChange((event.currentTarget as HTMLInputElement).value);
				}}
				bind:element={usernameInput}
			/>
		{/snippet}
	</form.Field>

	<PrimaryButton
		type="submit"
		disabled={submitDisabled}
		style="rounded-lg px-4 py-2 disabled:opacity-50"
	>
		{save.pending ? $_("account.saving") : $_("account.username.save")}
	</PrimaryButton>
</form>

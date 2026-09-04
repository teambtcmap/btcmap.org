<script lang="ts">
import PrimaryButton from "$components/PrimaryButton.svelte";
import { trackEvent } from "$lib/analytics";
import { _ } from "$lib/i18n";
import type { Session } from "$lib/session";
import { session } from "$lib/session";
import { errToast } from "$lib/utils";

// Client-side password length policy. The REST POST /v4/users endpoint does
// NOT enforce a minimum, so this is purely a UX guard — instant feedback
// before a round-trip.
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 64;

// Caller receives the new session after a successful signup, matching the
// LoginForm / NostrLoginForm contract so this can be reused inside modals.
export let onSuccess: (session: Session) => void | Promise<void>;

let username = "";
let password = "";
let loading = false;

async function handleSubmit() {
	const trimmed = username.trim();
	if (!trimmed || !password) return;
	if (password.length < MIN_PASSWORD_LENGTH) {
		errToast(
			$_("signup.passwordTooShort", { values: { min: MIN_PASSWORD_LENGTH } }),
		);
		return;
	}
	loading = true;

	try {
		const current = await session.signUp(trimmed, password);
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
}
</script>

<form on:submit|preventDefault={handleSubmit} class="space-y-4">
	<div>
		<label
			for="signup-username"
			class="mb-1 block text-sm font-semibold text-primary dark:text-white"
		>
			{$_("signup.username")}
		</label>
		<input
			id="signup-username"
			type="text"
			bind:value={username}
			autocomplete="username"
			maxlength="100"
			class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-primary dark:border-white/20 dark:bg-dark dark:text-white"
		/>
	</div>

	<div>
		<label
			for="signup-password"
			class="mb-1 block text-sm font-semibold text-primary dark:text-white"
		>
			{$_("signup.password")}
		</label>
		<input
			id="signup-password"
			type="password"
			bind:value={password}
			autocomplete="new-password"
			minlength={MIN_PASSWORD_LENGTH}
			maxlength={MAX_PASSWORD_LENGTH}
			class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-primary dark:border-white/20 dark:bg-dark dark:text-white"
		/>
		<p class="mt-1 text-xs text-body dark:text-white/50">
			{$_("signup.passwordHint", { values: { min: MIN_PASSWORD_LENGTH } })}
		</p>
	</div>

	<PrimaryButton
		type="submit"
		disabled={loading || !username.trim() || !password}
		style="w-full rounded-lg px-4 py-2 disabled:opacity-50"
	>
		{loading ? $_("signup.creating") : $_("signup.submit")}
	</PrimaryButton>
</form>

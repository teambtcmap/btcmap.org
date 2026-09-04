<script lang="ts">
import PrimaryButton from "$components/PrimaryButton.svelte";
import { trackEvent } from "$lib/analytics";
import { _ } from "$lib/i18n";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "$lib/passwordPolicy";
import type { Session } from "$lib/session";
import { session } from "$lib/session";
import { errToast } from "$lib/utils";

type Props = {
	// Caller receives the new session after a successful signup, matching the
	// LoginForm / NostrLoginForm contract so this can be reused inside modals.
	onSuccess: (session: Session) => void | Promise<void>;
};

let { onSuccess }: Props = $props();

let username = $state("");
let password = $state("");
let loading = $state(false);

const submitDisabled = $derived(
	loading || username.trim().length === 0 || password.length === 0,
);

async function handleSubmit(event: SubmitEvent) {
	event.preventDefault();
	const trimmed = username.trim();
	if (!trimmed || !password) return;
	loading = true;

	try {
		const current = await session.signUp({ username: trimmed, password });
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

<form onsubmit={handleSubmit} class="space-y-4">
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
			minlength={PASSWORD_MIN_LENGTH}
			maxlength={PASSWORD_MAX_LENGTH}
			class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-primary dark:border-white/20 dark:bg-dark dark:text-white"
		/>
		<p class="mt-1 text-xs text-body dark:text-white/50">
			{$_("signup.passwordHint", { values: { min: PASSWORD_MIN_LENGTH } })}
		</p>
	</div>

	<PrimaryButton
		type="submit"
		disabled={submitDisabled}
		style="w-full rounded-lg px-4 py-2 disabled:opacity-50"
	>
		{loading ? $_("signup.creating") : $_("signup.submit")}
	</PrimaryButton>
</form>

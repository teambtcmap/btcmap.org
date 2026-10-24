<script lang="ts">
import { trackEvent } from "#lib/analytics.js";
import { errorStatus } from "#lib/apiError.js";
import type { Login } from "#lib/auth.js";
import { isLoginRefused, loginWithPassword } from "#lib/auth.js";
import { _ } from "#lib/i18n/index.js";
import { USERNAME_MAX_LENGTH } from "#lib/usernamePolicy.js";
import { errToast } from "#lib/utils.js";
import TextField from "$components/form/TextField.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import TextLink from "$components/TextLink.svelte";

// Caller receives the login (session + saved items loading) after a
// successful login. This keeps the form reusable: /login navigates, the
// save-flow modal completes a pending save, both without baking
// navigation/save logic into the form.
type Props = {
	onSuccess: (login: Login) => void | Promise<void>;
	// When true, render without the "Don't have an account?" link (e.g.
	// inside a modal that already frames the login choice).
	compact?: boolean;
};
let { onSuccess, compact = false }: Props = $props();

let username = $state("");
let password = $state("");
let loading = $state(false);

async function handleSubmit(event: SubmitEvent) {
	event.preventDefault();
	if (!username.trim() || !password) return;
	loading = true;

	let login: Login;
	try {
		login = await loginWithPassword(username, password);
	} catch (err) {
		errToast(isLoginRefused(err) ? $_("login.failed") : $_("login.error"));
		console.error("Login failed:", errorStatus(err) ?? "unknown");
		loading = false;
		return;
	}
	// Logged in from here on: a failing follow-up is the host's, not a
	// login error to retry
	try {
		await onSuccess(login);
	} catch (err) {
		console.error("Login follow-up failed:", errorStatus(err) ?? "unknown");
	} finally {
		loading = false;
	}
}
</script>

<form onsubmit={handleSubmit} class="space-y-4">
	<TextField
		id="login-username"
		label={$_("login.username")}
		bind:value={username}
		autocomplete="username"
		maxlength={USERNAME_MAX_LENGTH}
	/>

	<TextField
		id="login-password"
		label={$_("login.password")}
		type="password"
		bind:value={password}
		autocomplete="current-password"
		maxlength="200"
	/>

	<PrimaryButton
		type="submit"
		disabled={loading || !username.trim() || !password}
		busy={loading}
		style="w-full rounded-lg px-4 py-2 disabled:opacity-50 aria-disabled:opacity-50"
	>
		{loading ? $_("login.loggingIn") : $_("login.submit")}
	</PrimaryButton>
</form>

{#if !compact}
	<p class="mt-4 text-center text-sm text-body dark:text-white/70">
		{$_("login.noAccount")}
		<TextLink link="/signup" onclick={() => trackEvent("login_create_account_click")}>
			{$_("login.createAccount")}
		</TextLink>
	</p>
{/if}

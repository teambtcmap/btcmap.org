<script lang="ts">
import { get } from "svelte/store";

import AuthTextField from "$components/auth/AuthTextField.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import TextLink from "$components/TextLink.svelte";
import { trackEvent } from "$lib/analytics";
import api from "$lib/axios";
import { _ } from "$lib/i18n";
import type { Session } from "$lib/session";
import { session } from "$lib/session";
import { errToast } from "$lib/utils";

// Caller receives the new session after a successful login. This keeps the
// form reusable: /login navigates, the save-flow modal completes a pending
// save, both without baking navigation/save logic into the form.
type Props = {
	onSuccess: (session: Session) => void | Promise<void>;
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

	try {
		const res = await api.post("/api/session/login", {
			username: username.trim(),
			password,
		});

		const token = res.data?.token;
		if (typeof token !== "string") {
			throw new Error("Login did not return a token");
		}

		// Don't store the password — the user already knows their own credentials.
		session.login(username.trim(), "", token);

		// Pull the new session value so callers get a concrete Session object
		// instead of having to subscribe.
		const current = get(session);
		if (!current) throw new Error("session.login did not populate the store");

		await onSuccess(current);
	} catch (err) {
		const status = (err as { response?: { status?: number } })?.response
			?.status;
		errToast(status === 401 ? $_("login.failed") : $_("login.error"));
		console.error("Login failed:", status ?? "unknown");
	} finally {
		loading = false;
	}
}
</script>

<form onsubmit={handleSubmit} class="space-y-4">
	<AuthTextField
		id="login-username"
		label={$_("login.username")}
		bind:value={username}
		autocomplete="username"
		maxlength="100"
	/>

	<AuthTextField
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
		style="w-full rounded-lg px-4 py-2 disabled:opacity-50"
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

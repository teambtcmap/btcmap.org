<script lang="ts">
import api from "$lib/axios";
import { _ } from "$lib/i18n";
import { type Session, session } from "$lib/session";
import { errToast } from "$lib/utils";

// Caller receives the new session after a successful login. This keeps the
// form reusable: /login navigates, the save-flow modal completes a pending
// save, both without baking navigation/save logic into the form.
export let onSuccess: (session: Session) => void | Promise<void>;

// When true, render without the "Don't have an account?" link (e.g. inside
// a modal that already frames the login choice).
export let compact = false;

let username = "";
let password = "";
let loading = false;

async function handleSubmit() {
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
		let current: Session | null = null;
		const unsub = session.subscribe((s) => {
			current = s;
		});
		unsub();
		if (!current) throw new Error("session.login did not populate the store");

		await onSuccess(current);
	} catch (err) {
		const message =
			(err as { response?: { status?: number } })?.response?.status === 401
				? $_("login.failed")
				: $_("login.error");
		errToast(message);
		console.error(
			"Login failed:",
			(err as { response?: { status?: number } })?.response?.status ??
				"unknown",
		);
	} finally {
		loading = false;
	}
}
</script>

<form on:submit|preventDefault={handleSubmit} class="space-y-4">
	<div>
		<label
			for="login-username"
			class="mb-1 block text-sm font-semibold text-primary dark:text-white"
		>
			{$_("login.username")}
		</label>
		<input
			id="login-username"
			type="text"
			bind:value={username}
			autocomplete="username"
			class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-primary dark:border-white/20 dark:bg-dark dark:text-white"
		/>
	</div>

	<div>
		<label
			for="login-password"
			class="mb-1 block text-sm font-semibold text-primary dark:text-white"
		>
			{$_("login.password")}
		</label>
		<input
			id="login-password"
			type="password"
			bind:value={password}
			autocomplete="current-password"
			class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-primary dark:border-white/20 dark:bg-dark dark:text-white"
		/>
	</div>

	<button
		type="submit"
		disabled={loading || !username.trim() || !password}
		class="w-full rounded-lg bg-link px-4 py-2 font-semibold text-white transition-colors hover:bg-hover disabled:opacity-50"
	>
		{loading ? $_("login.loggingIn") : $_("login.submit")}
	</button>
</form>

{#if !compact}
	<p class="mt-4 text-center text-sm text-body dark:text-white/70">
		{$_("login.noAccount")}
		<a
			href="https://developer.btcmap.org"
			target="_blank"
			rel="noopener noreferrer"
			class="text-link transition-colors hover:text-hover"
		>
			{$_("login.createAccount")}
		</a>
	</p>
{/if}

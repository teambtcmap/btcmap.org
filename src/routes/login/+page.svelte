<script lang="ts">
import { onMount } from "svelte";

import api from "$lib/axios";
import { _ } from "$lib/i18n";
import { session } from "$lib/session";
import { errToast } from "$lib/utils";

import { goto } from "$app/navigation";

let username = "";
let password = "";
let loading = false;

onMount(() => {
	session.init();
});

async function handleSubmit() {
	if (!username.trim() || !password.trim()) return;
	loading = true;

	try {
		const res = await api.post("/api/session/login", {
			username: username.trim(),
			password: password.trim(),
		});

		const token = res.data?.token;
		if (typeof token !== "string") {
			throw new Error("Login did not return a token");
		}

		// Replace current session with the logged-in account.
		// Fetch saved items from the server to populate the store.
		session.login(username.trim(), password.trim(), token);

		// Load saved items from server
		const headers = { Authorization: `Bearer ${token}` };
		const [placesRes, areasRes] = await Promise.allSettled([
			api.get("/api/session/saved-places", { headers }),
			api.get("/api/session/saved-areas", { headers }),
		]);

		if (
			placesRes.status === "fulfilled" &&
			Array.isArray(placesRes.value.data)
		) {
			const ids = placesRes.value.data.map((p: { id: number }) => p.id);
			session.setSavedPlaces(ids);
		}
		if (areasRes.status === "fulfilled" && Array.isArray(areasRes.value.data)) {
			const ids = areasRes.value.data.map((a: { id: number }) => a.id);
			session.setSavedAreas(ids);
		}

		goto("/saved");
	} catch (err) {
		const message =
			(err as { response?: { status?: number } })?.response?.status === 401
				? $_("login.failed")
				: $_("login.error");
		errToast(message);
		console.error("Login failed", err);
	} finally {
		loading = false;
	}
}
</script>

<svelte:head>
	<title>{$_("login.title")} | BTC Map</title>
</svelte:head>

<div class="my-10 flex justify-center md:my-20">
	<div class="w-full max-w-sm space-y-6">
		<h1 class="text-center text-3xl font-semibold text-primary dark:text-white">
			{$_("login.title")}
		</h1>

		<form on:submit|preventDefault={handleSubmit} class="space-y-4">
			<div>
				<label
					for="username"
					class="mb-1 block text-sm font-semibold text-primary dark:text-white"
				>
					{$_("login.username")}
				</label>
				<input
					id="username"
					type="text"
					bind:value={username}
					autocomplete="username"
					class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-primary dark:border-white/20 dark:bg-dark dark:text-white"
				/>
			</div>

			<div>
				<label
					for="password"
					class="mb-1 block text-sm font-semibold text-primary dark:text-white"
				>
					{$_("login.password")}
				</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					autocomplete="current-password"
					class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-primary dark:border-white/20 dark:bg-dark dark:text-white"
				/>
			</div>

			<button
				type="submit"
				disabled={loading || !username.trim() || !password.trim()}
				class="w-full rounded-lg bg-link px-4 py-2 font-semibold text-white transition-colors hover:bg-hover disabled:opacity-50"
			>
				{loading ? $_("login.loggingIn") : $_("login.submit")}
			</button>
		</form>
	</div>
</div>

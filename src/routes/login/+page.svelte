<script lang="ts">
import type { VerifiedEvent } from "nostr-tools/pure";
import { onMount } from "svelte";

import api from "$lib/axios";
import { _ } from "$lib/i18n";
import {
	decodeNsec,
	getNostrExtension,
	signAuthWithExtension,
	signAuthWithSecretKey,
} from "$lib/nostr";
import { session } from "$lib/session";
import { errToast } from "$lib/utils";

import { goto } from "$app/navigation";

let username = "";
let password = "";
let loading = false;
let nostrLoading = false;
let hasNostrExtension = false;
let showNsecInput = false;
let nsec = "";
let nsecLoading = false;

onMount(() => {
	session.init();
	// Extensions inject window.nostr before page load, but give them a tick in
	// case of slow injection. Re-check once to avoid a hidden button on first
	// paint when the extension is present.
	hasNostrExtension = getNostrExtension() !== null;
	if (hasNostrExtension) return;
	const t = setTimeout(() => {
		hasNostrExtension = getNostrExtension() !== null;
	}, 300);
	// Svelte runs the returned function on component destroy — prevents a
	// set-after-unmount if the user navigates away within 300ms.
	return () => clearTimeout(t);
});

async function exchangeSignedEvent(signedEvent: VerifiedEvent) {
	const res = await api.post("/api/session/nostr", {
		signed_event: signedEvent,
	});

	const token = res.data?.token;
	const apiUsername = res.data?.username;
	if (typeof token !== "string" || typeof apiUsername !== "string") {
		throw new Error("Nostr auth did not return a token");
	}

	session.login(apiUsername, "", token);
	await session.loadSavedItemsFromServer(token);
	goto("/user/saved");
}

async function loginWithNostr() {
	nostrLoading = true;
	try {
		const signedEvent = await signAuthWithExtension();
		await exchangeSignedEvent(signedEvent);
	} catch (err) {
		const status = (err as { response?: { status?: number } })?.response
			?.status;
		const message =
			status === 401 ? $_("login.nostrFailed") : $_("login.nostrError");
		errToast(message);
		console.error("Nostr login failed:", status ?? "unknown");
	} finally {
		nostrLoading = false;
	}
}

async function loginWithNsec() {
	if (!nsec.trim()) return;
	nsecLoading = true;
	let secretKey: Uint8Array | null = null;

	// Phase 1: decode + sign (sync, only fails on malformed key). A failure
	// here is unambiguous, so the error message can be specific.
	let signedEvent: VerifiedEvent;
	try {
		secretKey = decodeNsec(nsec);
		signedEvent = signAuthWithSecretKey(secretKey);
		nsec = "";
	} catch {
		errToast($_("login.nsecInvalid"));
		console.error("Nsec decode failed");
		if (secretKey) secretKey.fill(0);
		nsecLoading = false;
		return;
	}

	// Phase 2: network exchange. Reuses the same 401-vs-generic classifier as
	// loginWithNostr so transport errors don't get misreported as "invalid nsec".
	try {
		await exchangeSignedEvent(signedEvent);
	} catch (err) {
		const status = (err as { response?: { status?: number } })?.response
			?.status;
		const message =
			status === 401 ? $_("login.nostrFailed") : $_("login.nostrError");
		errToast(message);
		console.error("Nsec login failed:", status ?? "unknown");
	} finally {
		// Best-effort zeroing. V8 may have copies elsewhere, but this covers the
		// primary reference.
		if (secretKey) secretKey.fill(0);
		nsecLoading = false;
	}
}

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

		// Replace current session with the logged-in account.
		// Don't store the password — the user already knows it.
		session.login(username.trim(), "", token);
		await session.loadSavedItemsFromServer(token);
		goto("/user/saved");
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

<svelte:head>
	<title>{$_("login.title")} | BTC Map</title>
</svelte:head>

<div class="my-10 flex justify-center md:my-20">
	<div class="w-full max-w-sm space-y-6">
		<h1 class="text-center text-3xl font-semibold text-primary dark:text-white">
			{$_("login.title")}
		</h1>

		<div class="space-y-3">
			{#if hasNostrExtension}
				<button
					type="button"
					on:click={loginWithNostr}
					disabled={nostrLoading || nsecLoading || loading}
					class="w-full rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
				>
					{nostrLoading ? $_("login.nostrSigning") : $_("login.nostrExtension")}
				</button>
			{/if}

			{#if showNsecInput}
				<form on:submit|preventDefault={loginWithNsec} class="space-y-2">
					<label
						for="nsec"
						class="block text-sm font-semibold text-primary dark:text-white"
					>
						{$_("login.nsecLabel")}
					</label>
					<input
						id="nsec"
						type="password"
						bind:value={nsec}
						placeholder="nsec1..."
						autocomplete="off"
						autocorrect="off"
						autocapitalize="off"
						spellcheck="false"
						class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-primary dark:border-white/20 dark:bg-dark dark:text-white"
					/>
					<p class="text-xs text-body dark:text-white/50">
						{$_("login.nsecWarning")}
					</p>
					<button
						type="submit"
						disabled={nsecLoading || !nsec.trim()}
						class="w-full rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
					>
						{nsecLoading ? $_("login.nostrSigning") : $_("login.nsecSubmit")}
					</button>
				</form>
			{:else}
				<button
					type="button"
					on:click={() => (showNsecInput = true)}
					class="w-full text-center text-sm text-link transition-colors hover:text-hover"
				>
					{$_("login.nsecToggle")}
				</button>
			{/if}

			<div class="flex items-center gap-3">
				<div class="h-px flex-1 bg-gray-300 dark:bg-white/20"></div>
				<span class="text-xs text-body dark:text-white/50">{$_("login.or")}</span>
				<div class="h-px flex-1 bg-gray-300 dark:bg-white/20"></div>
			</div>
		</div>

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
				disabled={loading || !username.trim() || !password}
				class="w-full rounded-lg bg-link px-4 py-2 font-semibold text-white transition-colors hover:bg-hover disabled:opacity-50"
			>
				{loading ? $_("login.loggingIn") : $_("login.submit")}
			</button>
		</form>

		<p class="text-center text-sm text-body dark:text-white/70">
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
	</div>
</div>

<script lang="ts">
import { onMount } from "svelte";

import { fetchLinkedNpub, linkNostr, unlinkNostr } from "#lib/account.js";
import { trackEvent } from "#lib/analytics.js";
import { _ } from "#lib/i18n/index.js";
import type { SignedAuthEvent } from "#lib/nostr.js";
import {
	decodeNsec,
	encodeNip98Event,
	getNostrExtension,
	NOSTR_LINK_URL,
	signNip98WithExtension,
	signNip98WithSecretKey,
} from "#lib/nostr.js";
import { session } from "#lib/session.js";
import { errToast, successToast } from "#lib/utils.js";
import TextField from "$components/form/TextField.svelte";
import NostrAvatar from "$components/NostrAvatar.svelte";

// Link a Nostr key to the account, or unlink it (#1541). Once linked, a
// Nostr login reaches this account (and its saved items) instead of
// creating a new one. Signing follows NostrLoginForm: extension or nsec.

let showNsecInput = $state(false);
let nsec = $state("");
let linking = $state(false);
let confirmingUnlink = $state(false);
let unlinking = $state(false);

const npub = $derived($session?.npub ?? null);
// npub1 + 6 … 6: enough to recognise a key without wrapping
const shortNpub = $derived(
	npub && npub.length > 20 ? `${npub.slice(0, 11)}…${npub.slice(-6)}` : npub,
);

// A link made elsewhere (e.g. the Android app) only reaches the session
// at the next login; read the account's own state instead
onMount(async () => {
	const token = $session?.token;
	if (!token) return;
	try {
		const linked = await fetchLinkedNpub(token);
		if ($session?.token === token && linked !== $session.npub) {
			session.setNpub(linked);
		}
	} catch (err) {
		console.error("Nostr link lookup failed:", err);
	}
});

async function submitProof(signed: SignedAuthEvent) {
	const token = $session?.token;
	if (!token) return;
	const result = await linkNostr(token, encodeNip98Event(signed));
	if (result.status === "taken") {
		errToast($_("account.nostr.taken"));
		return;
	}
	session.setNpub(result.npub);
	showNsecInput = false;
	trackEvent("account_nostr_link_success");
	successToast($_("account.nostr.linkSuccess"));
}

const linkFailed = (err: unknown) => {
	errToast($_("account.nostr.linkError"));
	const status = (err as { response?: { status?: number } })?.response?.status;
	console.error("Nostr link failed:", status ?? "unknown");
};

async function linkWithExtension() {
	// Re-entry guard: disabled lands a tick late (see NostrLoginForm)
	if (linking) return;
	if (getNostrExtension() === null) {
		errToast($_("login.nostrNoExtension"));
		return;
	}
	trackEvent("account_nostr_link_click");
	linking = true;
	try {
		await submitProof(await signNip98WithExtension(NOSTR_LINK_URL, "PUT"));
	} catch (err) {
		linkFailed(err);
	} finally {
		linking = false;
	}
}

async function linkWithNsec(event: SubmitEvent) {
	event.preventDefault();
	if (linking || !nsec.trim()) return;
	trackEvent("account_nostr_link_click");
	linking = true;
	let secretKey: Uint8Array | null = null;
	let signed: SignedAuthEvent;
	try {
		secretKey = decodeNsec(nsec);
		signed = signNip98WithSecretKey(secretKey, NOSTR_LINK_URL, "PUT");
		nsec = "";
	} catch {
		errToast($_("login.nsecInvalid"));
		secretKey?.fill(0);
		linking = false;
		return;
	}
	try {
		await submitProof(signed);
	} catch (err) {
		linkFailed(err);
	} finally {
		// Best-effort zeroing, as on login
		secretKey.fill(0);
		linking = false;
	}
}

async function unlink() {
	const token = $session?.token;
	if (!token || unlinking) return;
	unlinking = true;
	try {
		await unlinkNostr(token);
		session.setNpub(null);
		confirmingUnlink = false;
		trackEvent("account_nostr_unlink_success");
		successToast($_("account.nostr.unlinkSuccess"));
	} catch (err) {
		errToast($_("account.nostr.unlinkError"));
		console.error("Nostr unlink failed:", err);
	} finally {
		unlinking = false;
	}
}
</script>

{#if npub}
	<div class="flex items-center gap-3 rounded-2xl border border-gray-300 p-3 dark:border-white/20">
		<NostrAvatar {npub} size={32} class="h-8 w-8 shrink-0" />
		<div class="min-w-0 flex-1">
			<p class="text-sm text-body dark:text-white/70">{$_("account.nostr.linked")}</p>
			<p class="truncate font-mono text-sm text-primary dark:text-white" title={npub}>
				{shortNpub}
			</p>
		</div>
		{#if !confirmingUnlink}
			<button
				type="button"
				onclick={() => {
					trackEvent("account_nostr_unlink_click");
					confirmingUnlink = true;
				}}
				class="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-white/10"
			>
				{$_("account.nostr.unlink")}
			</button>
		{/if}
	</div>

	{#if confirmingUnlink}
		<div class="space-y-3" role="group" aria-labelledby="account-nostr-unlink-warning">
			<p id="account-nostr-unlink-warning" class="text-sm text-body dark:text-white/70">
				{$_("account.nostr.unlinkWarning")}
			</p>
			<div class="flex justify-end gap-2">
				<button
					type="button"
					onclick={() => (confirmingUnlink = false)}
					class="rounded-lg px-3 py-1.5 text-sm font-semibold text-primary hover:bg-gray-100 dark:text-white dark:hover:bg-white/10"
				>
					{$_("forms.cancel")}
				</button>
				<button
					type="button"
					onclick={unlink}
					disabled={unlinking}
					class="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
				>
					{$_("account.nostr.unlinkConfirm")}
				</button>
			</div>
		</div>
	{/if}
{:else}
	<p class="text-sm text-body dark:text-white/70">{$_("account.nostr.none")}</p>

	<button
		type="button"
		onclick={linkWithExtension}
		disabled={linking}
		class="w-full rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
	>
		{linking && !showNsecInput ? $_("login.nostrSigning") : $_("account.nostr.linkExtension")}
	</button>

	{#if showNsecInput}
		<form onsubmit={linkWithNsec} class="space-y-2">
			<TextField
				id="account-nsec"
				label={$_("login.nsecLabel")}
				type="password"
				bind:value={nsec}
				placeholder="nsec1..."
				autocomplete="new-password"
				autocorrect="off"
				autocapitalize="off"
				spellcheck="false"
				inputClass="font-mono text-sm"
			/>
			<p class="text-xs text-body dark:text-white/50">
				{$_("account.nostr.nsecWarning")}
			</p>
			<button
				type="submit"
				disabled={linking || !nsec.trim()}
				class="w-full rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
			>
				{linking ? $_("login.nostrSigning") : $_("account.nostr.linkNsec")}
			</button>
		</form>
	{:else}
		<button
			type="button"
			onclick={() => (showNsecInput = true)}
			class="w-full text-center text-sm text-link transition-colors hover:text-hover"
		>
			{$_("account.nostr.linkNsec")}
		</button>
	{/if}
{/if}

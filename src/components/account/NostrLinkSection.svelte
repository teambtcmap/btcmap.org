<script lang="ts">
import { onMount } from "svelte";

import {
	errorStatus,
	fetchLinkedNpub,
	linkNostr,
	unlinkNostr,
} from "#lib/account.js";
import { createAccountAction } from "#lib/accountAction.svelte.js";
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
const linkAction = createAccountAction("Nostr link");
let confirmingUnlink = $state(false);
const unlinkAction = createAccountAction("Nostr unlink");
// Set once a link or unlink starts: from then on the session holds newer
// state than the lookup below can return
let changedHere = false;

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
		if (!changedHere) session.setNpub(token, linked);
	} catch (err) {
		console.error("Nostr link lookup failed:", errorStatus(err) ?? "unknown");
	}
});

// `token` is the account the user started linking from. Signing can wait on
// an extension prompt; if the session changed meanwhile (logout, another
// login), the key must not go to whichever account is active now.
async function submitProof(token: string, signed: SignedAuthEvent) {
	if ($session?.token !== token) return;
	changedHere = true;
	const result = await linkNostr(token, encodeNip98Event(signed));
	if (result.status === "taken") {
		errToast($_("account.nostr.taken"));
		return;
	}
	session.setNpub(token, result.npub);
	showNsecInput = false;
	trackEvent("account_nostr_link_success");
	successToast($_("account.nostr.linkSuccess"));
}

async function linkWithExtension() {
	const token = $session?.token;
	if (linkAction.pending || !token) return;
	// Counted before the extension check: a click without one is still a
	// click on the entry point
	trackEvent("account_nostr_link_click");
	if (getNostrExtension() === null) {
		errToast($_("login.nostrNoExtension"));
		return;
	}
	await linkAction.run($_("account.nostr.linkError"), async () => {
		await submitProof(
			token,
			await signNip98WithExtension(NOSTR_LINK_URL, "PUT"),
		);
	});
}

async function linkWithNsec(event: SubmitEvent) {
	event.preventDefault();
	const token = $session?.token;
	if (linkAction.pending || !token || !nsec.trim()) return;
	trackEvent("account_nostr_link_click");
	await linkAction.run($_("account.nostr.linkError"), async () => {
		let secretKey: Uint8Array | null = null;
		let signed: SignedAuthEvent;
		try {
			secretKey = decodeNsec(nsec);
			signed = signNip98WithSecretKey(secretKey, NOSTR_LINK_URL, "PUT");
			nsec = "";
		} catch {
			// A malformed key is the user's input, not a failed request
			errToast($_("login.nsecInvalid"));
			secretKey?.fill(0);
			return;
		}
		try {
			await submitProof(token, signed);
		} finally {
			// Best-effort zeroing, as on login
			secretKey.fill(0);
		}
	});
}

async function unlink() {
	const token = $session?.token;
	if (!token) return;
	await unlinkAction.run($_("account.nostr.unlinkError"), async () => {
		// The confirmed unlink, so the click/success pair counts attempts,
		// not opened confirmations
		trackEvent("account_nostr_unlink_click");
		changedHere = true;
		await unlinkNostr(token);
		session.setNpub(token, null);
		confirmingUnlink = false;
		trackEvent("account_nostr_unlink_success");
		successToast($_("account.nostr.unlinkSuccess"));
	});
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
					trackEvent("account_nostr_unlink_open");
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
					disabled={unlinkAction.pending}
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
		disabled={linkAction.pending}
		class="w-full rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
	>
		{linkAction.pending && !showNsecInput ? $_("login.nostrSigning") : $_("account.nostr.linkExtension")}
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
				disabled={linkAction.pending || !nsec.trim()}
				class="w-full rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
			>
				{linkAction.pending ? $_("login.nostrSigning") : $_("account.nostr.linkNsec")}
			</button>
		</form>
	{:else}
		<button
			type="button"
			onclick={() => {
				trackEvent("account_nostr_nsec_open");
				showNsecInput = true;
			}}
			class="w-full text-center text-sm text-link transition-colors hover:text-hover"
		>
			{$_("account.nostr.linkNsec")}
		</button>
	{/if}
{/if}

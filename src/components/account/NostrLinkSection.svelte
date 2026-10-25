<script lang="ts">
import { onMount } from "svelte";

import { fetchLinkedNpub, linkNostr, unlinkNostr } from "#lib/account.js";
import { createAccountAction } from "#lib/accountAction.svelte.js";
import type { NostrSignMethod } from "#lib/analytics.js";
import { trackEvent } from "#lib/analytics.js";
import { errorStatus } from "#lib/apiError.js";
import type { AuthedClient } from "#lib/authedApi.js";
import { authedClient } from "#lib/authedApi.js";
import { _ } from "#lib/i18n/index.js";
import type { SignedAuthEvent } from "#lib/nostr.js";
import {
	buildNip98Template,
	encodeNip98Event,
	NOSTR_LINK_URL,
} from "#lib/nostr.js";
import { session } from "#lib/session.js";
import { errToast, successToast } from "#lib/utils.js";
import NostrAuthMethods from "$components/auth/NostrAuthMethods.svelte";
import NostrAvatar from "$components/NostrAvatar.svelte";

// Link a Nostr key to the account, or unlink it (#1541). Once linked, a
// Nostr login reaches this account (and its saved items) instead of creating
// a new one. The transports are the login panel's (NostrAuthMethods), signing
// a PUT for /v4/users/me/nostr instead of the login POST.

const unlinkAction = createAccountAction("Nostr unlink");
let confirmingUnlink = $state(false);
// Set once a link or unlink starts: from then on the session holds newer
// state than the lookup below can return
let changedHere = false;
// The account the signature is being made for. Signing can wait on an
// extension prompt or a signer app, so a session that has moved on meanwhile
// must not receive the key.
let linkClient: AuthedClient | null = null;

const linkTemplate = () => buildNip98Template(NOSTR_LINK_URL, "PUT");

const npub = $derived($session?.npub ?? null);
// npub1 + 6 … 6: enough to recognise a key without wrapping
const shortNpub = $derived(
	npub && npub.length > 20 ? `${npub.slice(0, 11)}…${npub.slice(-6)}` : npub,
);

// A link made elsewhere (e.g. the Android app) only reaches the session
// at the next login; read the account's own state instead
onMount(async () => {
	if (!$session) return;
	const client = authedClient();
	try {
		const linked = await fetchLinkedNpub(client);
		if (!changedHere) session.setNpub(client, linked);
	} catch (err) {
		console.error("Nostr link lookup failed:", errorStatus(err) ?? "unknown");
	}
});

// Both credentials: the Bearer token says which account, the signed PUT
// proves the user controls the key.
async function linkKey(
	signed: SignedAuthEvent,
	method: NostrSignMethod,
): Promise<boolean> {
	const client = linkClient;
	if (!client?.stillCurrent()) return false;
	changedHere = true;
	const result = await linkNostr(encodeNip98Event(signed), client);
	if (result.status === "taken") {
		trackEvent("account_nostr_link_failure", { method, status: "taken" });
		errToast($_("account.nostr.taken"));
		return false;
	}
	session.setNpub(client, result.npub);
	successToast($_("account.nostr.linkSuccess"));
	return true;
}

async function unlink() {
	// The busy button still takes clicks (#1548)
	if (!$session || unlinkAction.pending) return;
	const client = authedClient();
	await unlinkAction.run(
		$_("account.nostr.unlinkError"),
		async () => {
			// The confirmed unlink, so the click/success pair counts attempts,
			// not opened confirmations
			trackEvent("account_nostr_unlink_click");
			changedHere = true;
			await unlinkNostr(client);
			session.setNpub(client, null);
			confirmingUnlink = false;
			trackEvent("account_nostr_unlink_success");
			successToast($_("account.nostr.unlinkSuccess"));
		},
		(status) => trackEvent("account_nostr_unlink_failure", { status }),
	);
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
					aria-disabled={unlinkAction.pending ? "true" : undefined}
					class="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 aria-disabled:opacity-60"
				>
					{$_("account.nostr.unlinkConfirm")}
				</button>
			</div>
		</div>
	{/if}
{:else}
	<p class="text-sm text-body dark:text-white/70">{$_("account.nostr.none")}</p>

	<NostrAuthMethods
		mode="link"
		template={linkTemplate}
		submit={linkKey}
		onStart={() => (linkClient = $session ? authedClient() : null)}
	/>
{/if}

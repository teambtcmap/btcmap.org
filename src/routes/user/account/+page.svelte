<script lang="ts">
import { onMount } from "svelte";

import { fetchCurrentUser } from "#lib/currentUser.js";
import { _ } from "#lib/i18n/index.js";
import { session } from "#lib/session.js";
import NostrLinkSection from "$components/account/NostrLinkSection.svelte";
import PasswordForm from "$components/account/PasswordForm.svelte";
import UsernameForm from "$components/account/UsernameForm.svelte";

import { goto } from "$app/navigation";

// Account settings (#1541): rename the account, link or unlink a Nostr
// key, change the password. An account created via Nostr has no password
// and its key is its only login: it only gets the username, and sees its
// key without an unlink.

let ready = $state(false);
// Settled once /me answered (or failed); until then the password section
// waits, so it doesn't flash up for key-only accounts
let lookupDone = $state(false);
let hasPassword = $state<boolean | undefined>();
// Only a definite "no password" hides anything: an API that doesn't send
// the field yet, or a failed lookup, shows the full page
const keyOnly = $derived(lookupDone && hasPassword === false);

onMount(() => {
	// Child onMount runs before the layout's, so hydrate the session here
	session.init();
	if (!$session) {
		goto("/login");
		return;
	}
	ready = true;
	fetchCurrentUser($session.token).then((user) => {
		hasPassword = user?.hasPassword;
		lookupDone = true;
	});
});
</script>

<svelte:head>
	<title>{$_("account.title")} | BTC Map</title>
</svelte:head>

<div class="my-10 flex justify-center md:my-20">
	<div class="w-full max-w-md space-y-10">
		<h1 class="text-center text-3xl font-semibold text-primary dark:text-white">
			{$_("account.title")}
		</h1>

		{#if ready && $session}
			<section aria-labelledby="account-username-heading" class="space-y-4">
				{@render heading("username")}
				<UsernameForm />
			</section>
			<section aria-labelledby="account-nostr-heading" class="space-y-4">
				{@render heading("nostr")}
				<NostrLinkSection canUnlink={lookupDone && !keyOnly} />
			</section>
			{#if lookupDone && !keyOnly}
				<section aria-labelledby="account-password-heading" class="space-y-4">
					{@render heading("password")}
					<PasswordForm />
				</section>
			{/if}
		{/if}
	</div>
</div>

{#snippet heading(section: "username" | "nostr" | "password")}
	<div class="space-y-1">
		<h2 id="account-{section}-heading" class="text-xl font-semibold text-primary dark:text-white">
			{$_(`account.${section}.heading`)}
		</h2>
		<p class="text-sm text-body dark:text-white/70">
			{$_(`account.${section}.description`)}
		</p>
	</div>
{/snippet}

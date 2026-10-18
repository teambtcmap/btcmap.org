<script lang="ts">
import { onMount } from "svelte";

import { _ } from "#lib/i18n/index.js";
import { session } from "#lib/session.js";
import NostrLinkSection from "$components/account/NostrLinkSection.svelte";
import PasswordForm from "$components/account/PasswordForm.svelte";
import UsernameForm from "$components/account/UsernameForm.svelte";

import { goto } from "$app/navigation";

// Account settings (#1541): rename the account, link or unlink a Nostr
// key, change the password.

let ready = $state(false);

onMount(() => {
	// Child onMount runs before the layout's, so hydrate the session here
	session.init();
	if (!$session) {
		goto("/login");
		return;
	}
	ready = true;
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
				<NostrLinkSection />
			</section>
			<section aria-labelledby="account-password-heading" class="space-y-4">
				{@render heading("password")}
				<PasswordForm />
			</section>
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

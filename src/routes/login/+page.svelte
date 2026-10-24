<script lang="ts">
import type { Login } from "#lib/auth.js";
import { _ } from "#lib/i18n/index.js";
import LoginForm from "$components/auth/LoginForm.svelte";
import NostrLoginForm from "$components/auth/NostrLoginForm.svelte";

import { goto } from "$app/navigation";

// /user/activity reads the saved lists on mount: let them land first
async function handleSuccess(login: Login) {
	await login.savedItems;
	goto("/user/activity");
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

		<LoginForm onSuccess={handleSuccess} />

		<!-- Our own username/password auth comes first; secondary methods
		     (Nostr today, OSM later) sit together under one labelled divider. -->
		<div class="flex items-center gap-3">
			<div class="h-px flex-1 bg-gray-300 dark:bg-white/20"></div>
			<span class="text-xs text-body dark:text-white/50">{$_("login.otherMethods")}</span>
			<div class="h-px flex-1 bg-gray-300 dark:bg-white/20"></div>
		</div>

		<div class="space-y-3">
			<NostrLoginForm onSuccess={handleSuccess} />
		</div>
	</div>
</div>

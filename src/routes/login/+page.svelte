<script lang="ts">
import type { Login } from "#lib/auth.js";
import { _ } from "#lib/i18n/index.js";
import LoginMethods from "$components/auth/LoginMethods.svelte";

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

		<!-- Our own username/password auth is the first tab; Nostr (and OSM
		     later) the next. -->
		<LoginMethods id="login-page" onSuccess={handleSuccess} />
	</div>
</div>

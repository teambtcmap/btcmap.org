<script lang="ts">
import { onMount } from "svelte";

import LoginForm from "$components/auth/LoginForm.svelte";
import { _ } from "$lib/i18n";
import { hydrateSavedFromServer } from "$lib/savedItems";
import type { Session } from "$lib/session";
import { session } from "$lib/session";

import { goto } from "$app/navigation";

onMount(() => {
	session.init();
});

async function handleSuccess(current: Session) {
	await hydrateSavedFromServer(current.token);
	goto("/user/saved");
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
	</div>
</div>

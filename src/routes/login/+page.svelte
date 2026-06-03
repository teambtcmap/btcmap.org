<script lang="ts">
import { onMount } from "svelte";

import LoginForm from "$components/auth/LoginForm.svelte";
import NostrLoginForm from "$components/auth/NostrLoginForm.svelte";
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

		<div class="space-y-3">
			<NostrLoginForm onSuccess={handleSuccess} />
		</div>

		<div class="flex items-center gap-3">
			<div class="h-px flex-1 bg-gray-300 dark:bg-white/20"></div>
			<span class="text-xs text-body dark:text-white/50">{$_("login.or")}</span>
			<div class="h-px flex-1 bg-gray-300 dark:bg-white/20"></div>
		</div>

		<LoginForm onSuccess={handleSuccess} />
	</div>
</div>

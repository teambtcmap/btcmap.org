<script lang="ts">
import { onMount } from "svelte";

import SignupForm from "$components/auth/SignupForm.svelte";
import TextLink from "$components/TextLink.svelte";
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
	<title>{$_("signup.title")} | BTC Map</title>
</svelte:head>

<div class="my-10 flex justify-center md:my-20">
	<div class="w-full max-w-sm space-y-6">
		<h1 class="text-center text-3xl font-semibold text-primary dark:text-white">
			{$_("signup.title")}
		</h1>

		<p class="text-center text-sm text-body dark:text-white/70">
			{$_("signup.description")}
		</p>

		<SignupForm onSuccess={handleSuccess} />

		<p class="text-center text-sm text-body dark:text-white/70">
			{$_("signup.haveAccount")}
			<TextLink link="/login">{$_("signup.signIn")}</TextLink>
		</p>
	</div>
</div>

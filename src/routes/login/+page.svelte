<script lang="ts">
import { onMount } from "svelte";

import LoginForm from "$components/auth/LoginForm.svelte";
import api from "$lib/axios";
import { _ } from "$lib/i18n";
import type { Session } from "$lib/session";
import { session } from "$lib/session";

import { goto } from "$app/navigation";

onMount(() => {
	session.init();
});

async function handleSuccess(current: Session) {
	const headers = { Authorization: `Bearer ${current.token}` };
	const [placesRes, areasRes] = await Promise.allSettled([
		api.get("/api/session/saved-places", { headers }),
		api.get("/api/session/saved-areas", { headers }),
	]);

	if (placesRes.status === "fulfilled" && Array.isArray(placesRes.value.data)) {
		const ids = placesRes.value.data.map((p: { id: number }) => p.id);
		session.setSavedPlaces(ids);
	}
	if (areasRes.status === "fulfilled" && Array.isArray(areasRes.value.data)) {
		const ids = areasRes.value.data.map((a: { id: number }) => a.id);
		session.setSavedAreas(ids);
	}

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

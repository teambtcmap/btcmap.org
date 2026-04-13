<script lang="ts">
import { createEventDispatcher } from "svelte";

import BackupCredentials from "$components/auth/BackupCredentials.svelte";
import Icon from "$components/Icon.svelte";
import { _ } from "$lib/i18n";
import { session } from "$lib/session";

const dispatch = createEventDispatcher();
</script>

<svelte:window on:keydown={(e) => e.key === "Escape" && dispatch("close")} />

<div
	role="presentation"
	class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
	on:click|self={() => dispatch("close")}
>
	<div class="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-dark">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-xl font-semibold text-primary dark:text-white">
				{$_("backup.title")}
			</h2>
			<button
				type="button"
				on:click={() => dispatch("close")}
				class="text-body transition-colors hover:text-primary dark:text-white/50 dark:hover:text-white"
			>
				<Icon type="material" icon="close" w="20" h="20" />
			</button>
		</div>

		<p class="mb-4 text-sm text-body dark:text-white/70">
			{$_("backup.description")}
		</p>

		{#if $session}
			<BackupCredentials
				username={$session.username}
				password={$session.password}
			/>
		{/if}
	</div>
</div>

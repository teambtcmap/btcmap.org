<script lang="ts">
import OutClick from "svelte-outclick";

import Icon from "$components/Icon.svelte";
import { _ } from "$lib/i18n";
import { session } from "$lib/session";

import { afterNavigate } from "$app/navigation";

let open = false;

afterNavigate(() => {
	open = false;
});

function handleLogout() {
	session.clear();
	open = false;
}
</script>

<div class="relative">
	<button
		id="user-menu-trigger"
		on:click={() => (open = !open)}
		class="text-white transition-opacity hover:opacity-80"
		aria-label={$_("nav.account")}
		aria-haspopup="true"
		aria-expanded={open}
	>
		<Icon
			type="material"
			icon={$session ? 'account_circle_filled' : 'account_circle'}
			w="24"
			h="24"
		/>
	</button>

	{#if open}
		<OutClick
			excludeQuerySelectorAll="#user-menu-trigger"
			on:outclick={() => (open = false)}
		>
			<div
				class="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-gray-300 bg-white py-1 shadow-lg dark:border-white/20 dark:bg-dark"
			>
				{#if $session}
					<a
						href="/saved"
						class="flex items-center gap-2 px-4 py-2 text-sm text-primary transition-colors hover:bg-gray-100 dark:text-white dark:hover:bg-white/10"
					>
						<Icon type="material" icon="bookmark" w="16" h="16" />
						{$_("nav.mySaved")}
					</a>

					<hr class="my-1 border-gray-200 dark:border-white/10" />

					<button
						on:click={handleLogout}
						class="flex w-full items-center gap-2 px-4 py-2 text-sm text-primary transition-colors hover:bg-gray-100 dark:text-white dark:hover:bg-white/10"
					>
						<Icon type="material" icon="logout" w="16" h="16" />
						{$_("nav.logout")}
					</button>
				{:else}
					<a
						href="/login"
						class="flex items-center gap-2 px-4 py-2 text-sm text-primary transition-colors hover:bg-gray-100 dark:text-white dark:hover:bg-white/10"
					>
						<Icon type="material" icon="login" w="16" h="16" />
						{$_("nav.login")}
					</a>
				{/if}
			</div>
		</OutClick>
	{/if}
</div>

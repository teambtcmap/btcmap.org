<script lang="ts">
import Time from "svelte-time";

import Tip from "$components/Tip.svelte";
import type { EventType, User } from "$lib/types";
import { isValidLightningTip, stripLightningScheme } from "$lib/utils";

import { resolve } from "$app/paths";

export let action: EventType;
export let user_id: number | undefined;
export let user_name: string | undefined;
export let user_tip: string | undefined;
export let time: string;

// The API ships user_tip with its own `lightning:` scheme; strip it so
// Tip.svelte (which re-adds the scheme) can't emit `lightning:lightning:`.
// Skip malformed addresses (e.g. "undefined@zbd.gg") so the Tip button is
// hidden rather than rendering a dead link.
$: tipDestination =
	user_tip && isValidLightningTip(user_tip)
		? stripLightningScheme(user_tip)
		: undefined;
</script>

<div class="py-3 text-left text-base">
	<div class="w-full flex-wrap items-center justify-between space-y-2 lg:flex lg:space-y-0">
		<!-- event information -->
		<div class="space-y-2 lg:space-y-0">
			<span class="text-primary lg:mr-5 dark:text-white">
				<!-- action -->
				<strong>{action.charAt(0).toUpperCase() + action.slice(1, action.length)}d</strong>

				<!-- user -->
				{#if user_id && user_name}
					by <a
						href={resolve(`/tagger/${user_id}`)}
						class="block break-all text-link transition-colors hover:text-hover lg:inline"
						>{user_name}
					</a>
				{/if}
			</span>

			<!-- time ago -->
			<span
				class="block font-semibold text-taggerTime lg:inline dark:text-white/70 {tipDestination
					? 'lg:mr-5'
					: ''}"
			>
				<Time live={3000} relative timestamp={time} />
			</span>
		</div>

		<!-- lightning tip button -->
		{#if tipDestination}
			<Tip destination={tipDestination} class="block lg:inline" />
		{/if}
	</div>
</div>

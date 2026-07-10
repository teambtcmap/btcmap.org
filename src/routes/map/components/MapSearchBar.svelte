<script lang="ts">
import Icon from "$components/Icon.svelte";
import { trackEvent } from "$lib/analytics";
import { _ } from "$lib/i18n";
import { merchantList } from "$lib/merchantListStore";
import { formatNearbyPillCount } from "$lib/utils";

import NearbyCountPill from "./NearbyCountPill.svelte";

// Activating the facade is the page's job: it opens the panel, refreshes the
// list, and moves focus into the panel's real search input.
export let onActivate: (() => void) | undefined = undefined;
export let nearbyCount = 0;

// Store subscriptions
$: isOpen = $merchantList.isOpen;

// Count rides a pill inside the facade while the panel is closed
$: pillCount = formatNearbyPillCount(nearbyCount);

function handleActivate() {
	trackEvent("search_input_focus", { source: "floating_bar" });
	onActivate?.();
}
</script>

<!-- Floating search facade — desktop only, hidden once the panel opens (the panel
     renders the real search input in the same slot). Deliberately a button and not
     an input: opening the panel unmounts this element, so an input here could never
     receive a keystroke. Mirrors the mobile sheet's peek facade. -->
{#if !isOpen}
	<div class="pointer-events-auto w-full md:w-80">
		<button
			type="button"
			on:click={handleActivate}
			aria-expanded="false"
			class="relative flex w-full items-center rounded-lg bg-white py-3 pr-3 pl-10 text-left shadow-lg dark:bg-dark dark:shadow-black/30"
		>
			<Icon
				w="18"
				h="18"
				icon="search"
				type="material"
				class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-600 dark:text-white/70"
			/>
			<span class="flex-1 truncate text-base text-gray-400 dark:text-white/50">
				{$_('search.placeholderPlaces')}
			</span>
			{#if pillCount}
				<NearbyCountPill count={pillCount} />
			{/if}
		</button>
	</div>
{/if}

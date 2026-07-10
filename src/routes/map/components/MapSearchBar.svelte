<script lang="ts">
import { trackEvent } from "$lib/analytics";
import { merchantList } from "$lib/merchantListStore";
import { formatNearbyPillCount } from "$lib/utils";

import SearchFacade from "./SearchFacade.svelte";

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
     renders the real search input in the same slot). Shares its markup with the
     mobile sheet's peek facade. -->
{#if !isOpen}
	<div class="pointer-events-auto w-full md:w-80">
		<SearchFacade
			count={pillCount}
			class="rounded-lg bg-white py-3 pr-3 shadow-lg dark:bg-dark dark:shadow-black/30"
			on:click={handleActivate}
		/>
	</div>
{/if}

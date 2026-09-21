<script lang="ts">
import { trackEvent } from "$lib/analytics";
import { merchantList } from "$lib/merchantListStore";
import { formatNearbyPillCount } from "$lib/utils";

import PaymentRestNote from "./PaymentRestNote.svelte";
import SearchFacade from "./SearchFacade.svelte";

// Activating the facade is the page's job: it opens the panel, refreshes the
// list, and moves focus into the panel's real search input.
export let onActivate: (() => void) | undefined = undefined;
export let nearbyCount = 0;
// The payment filter emptied the view (#1427). At rest the panel isn't
// mounted at all on desktop, so without this the only thing that could
// report it is a count pill that formatNearbyPillCount blanks at zero.
export let showPaymentNote = false;
export let unknownPaymentCount = 0;

// Store subscriptions
$: isOpen = $merchantList.isOpen;

// Count rides a pill inside the facade while the panel is closed
$: pillCount = formatNearbyPillCount(nearbyCount);

function handleActivate() {
	trackEvent("search_bar_tap_expand");
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
		{#if showPaymentNote}
			<PaymentRestNote
				count={unknownPaymentCount}
				class="mt-2 rounded-lg bg-white px-3 py-2 shadow-lg dark:bg-dark dark:shadow-black/30"
			/>
		{/if}
	</div>
{/if}

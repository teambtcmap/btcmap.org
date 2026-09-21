<script lang="ts">
import { trackEvent } from "$lib/analytics";
import type { PaymentMethod } from "$lib/map/paymentMethodFilter";
import { merchantList } from "$lib/merchantListStore";
import { formatNearbyPillCount } from "$lib/utils";

import PaymentRestNote from "./PaymentRestNote.svelte";
import PaymentSwitcher from "./PaymentSwitcher.svelte";
import SearchFacade from "./SearchFacade.svelte";

type Props = {
	// Activating the facade is the page's job: it opens the panel, refreshes
	// the list, and moves focus into the panel's real search input.
	onActivate?: () => void;
	nearbyCount?: number;
	// The payment filter emptied the view (#1427). At rest the panel isn't
	// mounted at all on desktop, so without this the only thing that could
	// report it is a count pill that formatNearbyPillCount blanks at zero.
	showPaymentNote?: boolean;
	unknownPaymentCount?: number;
	// Payment switcher inside the note's card (#1430) — nothing new floats
	// over the map, and the bar grows with its content, so no height
	// plumbing. Required alongside the note: a no-op default would render
	// the switcher as a dead control if the wiring were ever dropped.
	activePaymentMethod: PaymentMethod | null;
	onSwitchPayment: (method: PaymentMethod | null) => void;
};
let {
	onActivate,
	nearbyCount = 0,
	showPaymentNote = false,
	unknownPaymentCount = 0,
	activePaymentMethod,
	onSwitchPayment,
}: Props = $props();

const isOpen = $derived($merchantList.isOpen);
// Count rides a pill inside the facade while the panel is closed
const pillCount = $derived(formatNearbyPillCount(nearbyCount));

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
			<div
				class="mt-2 rounded-lg bg-white px-3 py-2 shadow-lg dark:bg-dark dark:shadow-black/30"
			>
				<PaymentRestNote count={unknownPaymentCount} />
				<PaymentSwitcher
					active={activePaymentMethod}
					onselect={onSwitchPayment}
					class="mt-2"
				/>
			</div>
		{/if}
	</div>
{/if}

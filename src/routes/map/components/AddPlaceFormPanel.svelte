<script lang="ts">
import { fly } from "svelte/transition";

import AddLocationForm from "$components/add-location/AddLocationForm.svelte";
import CloseButton from "$components/CloseButton.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import { MAP_PANEL_MARGIN, MERCHANT_DRAWER_WIDTH } from "$lib/constants";
import { _ } from "$lib/i18n";

// In-map host for the add-location form (#1134). Desktop wears the
// merchant drawer's exact dialect — left-docked card, same sizing and
// chrome — so the map keeps one panel language; the map and its
// crosshair pin stay live beside it, and the host refreshes `coords` on
// every settled move. Mobile is a full-screen sheet: a long form wants
// full height and native scroll, not the peek-drawer's drag gestures.
// (The drawers themselves stay merchant-specific — reusing their shell
// literally would pull the #1208 hand-conversion hotspots in here.)
type Props = {
	coords: { lat: number; long: number };
	// Back to the placement sheet (the close button and Escape).
	onclose: () => void;
	// Success-screen actions: restart placement, or leave add mode.
	onaddanother: () => void;
	onexit: () => void;
};
let { coords, onclose, onaddanother, onexit }: Props = $props();

let submitted = $state(false);

// Mount-time is fine: a mid-session viewport-class change would only
// soften the entry animation, nothing else.
const desktop = window.matchMedia("(min-width: 768px)").matches;

const onKeydown = (event: KeyboardEvent) => {
	if (event.key === "Escape") {
		event.preventDefault();
		onclose();
	}
};
</script>

<svelte:window onkeydown={onKeydown} />

<!-- Card classes and max-height mirror MerchantDrawerDesktop verbatim,
     attribution corner left uncovered. -->
<section
	aria-label={$_('addLocation.title')}
	in:fly={desktop ? { x: -MERCHANT_DRAWER_WIDTH, duration: 300 } : { y: 200, duration: 300 }}
	class="absolute inset-0 z-[1002] overflow-y-auto bg-white md:inset-auto md:top-3 md:left-(--drawer-left) md:max-h-[calc(100%-0.75rem-max(3rem,env(safe-area-inset-bottom)))] md:w-full md:max-w-(--drawer-w) md:rounded-lg md:shadow-lg dark:bg-dark"
	style="--drawer-left: {MAP_PANEL_MARGIN}px; --drawer-w: {MERCHANT_DRAWER_WIDTH}px"
>
	<div
		class="sticky top-0 z-10 flex items-center justify-between rounded-t-lg bg-white p-2 dark:bg-dark"
	>
		<h2 class="pl-2 text-lg font-semibold text-primary dark:text-white">
			{$_('addLocation.title')}
		</h2>
		<CloseButton on:click={onclose} ariaLabel={$_('map.placement.cancel')} />
	</div>

	{#if !submitted}
		<div class="px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] md:pb-4">
			<p class="mb-4 text-sm text-body dark:text-offwhite">
				{$_('addLocation.pinConfirmedHint')}
			</p>
			<AddLocationForm {coords} showPinPreview={false} onsuccess={() => (submitted = true)} />
		</div>
	{:else}
		<div class="flex flex-col items-center gap-4 px-4 py-16 text-center">
			<div
				class="flex h-16 w-16 items-center justify-center rounded-full bg-green-600 text-3xl text-white"
				aria-hidden="true"
			>
				✓
			</div>
			<h2 class="text-2xl font-semibold text-primary dark:text-white">
				{$_('formSuccess.submittedTitle', {
					values: { type: $_('addLocation.formSuccessType') }
				})}
			</h2>
			<p class="text-body dark:text-offwhite">
				{$_('addLocation.formSuccessText')}
			</p>
			<PrimaryButton on:click={onaddanother} style="w-full py-3 rounded-xl">
				{$_('formSuccess.submitAnother', {
					values: { type: $_('addLocation.formSuccessType') }
				})}
			</PrimaryButton>
			<button
				type="button"
				onclick={onexit}
				class="h-12 w-full rounded-xl border border-input font-semibold text-body focus:outline-link dark:text-offwhite"
			>
				{$_('map.placement.backToMap')}
			</button>
		</div>
	{/if}
</section>

<script lang="ts">
import AddLocationForm from "$components/add-location/AddLocationForm.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import { MERCHANT_DRAWER_WIDTH } from "$lib/constants";
import { _ } from "$lib/i18n";

// In-map host for the add-location form (#1134): full-screen sheet on
// mobile, right-side panel on desktop — there the map and its crosshair
// pin stay visible and live beside the form, so fine-tuning the pin is a
// drag away and the host refreshes `coords` on every settled move.
type Props = {
	coords: { lat: number; long: number };
	// Back to the placement sheet (the × button and Escape).
	onclose: () => void;
	// Success-screen actions: restart placement, or leave add mode.
	onaddanother: () => void;
	onexit: () => void;
};
let { coords, onclose, onaddanother, onexit }: Props = $props();

let submitted = $state(false);

const onKeydown = (event: KeyboardEvent) => {
	if (event.key === "Escape" && !submitted) {
		event.preventDefault();
		onclose();
	}
};
</script>

<svelte:window onkeydown={onKeydown} />

<!-- Desktop max-height mirrors MerchantDrawerDesktop's recipe, leaving the
     bottom-right attribution corner uncovered. -->
<section
	aria-label={$_('addLocation.title')}
	class="absolute inset-0 z-[1002] overflow-y-auto bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] md:inset-auto md:top-3 md:right-3 md:max-h-[calc(100%-0.75rem-max(3rem,env(safe-area-inset-bottom)))] md:w-full md:max-w-(--drawer-w) md:rounded-lg md:border md:border-input md:shadow-lg dark:bg-dark"
	style="--drawer-w: {MERCHANT_DRAWER_WIDTH}px"
>
	{#if !submitted}
		<div class="mb-2 flex items-center justify-between gap-3">
			<h2 class="text-xl font-semibold text-primary dark:text-white">
				{$_('addLocation.title')}
			</h2>
			<button
				type="button"
				onclick={onclose}
				aria-label={$_('map.placement.cancel')}
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-input text-xl font-semibold text-body transition-colors hover:bg-link/10 focus:outline-link dark:text-offwhite"
			>
				×
			</button>
		</div>
		<p class="mb-4 text-sm text-body dark:text-offwhite">
			{$_('addLocation.pinConfirmedHint')}
		</p>
		<AddLocationForm {coords} showPinPreview={false} onsuccess={() => (submitted = true)} />
	{:else}
		<div class="flex flex-col items-center gap-4 py-16 text-center">
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

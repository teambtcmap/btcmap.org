<script lang="ts">
import AddLocationForm from "$components/add-location/AddLocationForm.svelte";
import CloseButton from "$components/CloseButton.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import { _ } from "$lib/i18n";

import MapPanelShell from "./MapPanelShell.svelte";

// In-map host for the add-location form (#1134), wearing the shared
// MapPanelShell: left-docked drawer card on desktop — the map and its
// crosshair pin stay live beside it, and the host refreshes `coords` on
// every settled move — and a full-screen sheet on mobile, since a long
// form wants full height and native scroll, not peek-drawer gestures.
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

const onKeydown = (event: KeyboardEvent) => {
	if (event.key === "Escape") {
		event.preventDefault();
		onclose();
	}
};
</script>

<svelte:window onkeydown={onKeydown} />

<MapPanelShell label={$_('addLocation.title')}>
	{#snippet header()}
		<h2 class="pl-2 text-lg font-semibold text-primary dark:text-white">
			{$_('addLocation.title')}
		</h2>
		<CloseButton on:click={onclose} ariaLabel={$_('map.placement.cancel')} />
	{/snippet}

	{#if !submitted}
		<div class="px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] md:pb-4">
			<p class="mb-4 text-sm text-body dark:text-offwhite">
				{$_('addLocation.pinConfirmedHint')}
			</p>
			<AddLocationForm {coords} onsuccess={() => (submitted = true)} />
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
</MapPanelShell>

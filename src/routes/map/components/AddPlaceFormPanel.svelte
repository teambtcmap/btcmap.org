<script lang="ts">
import AddLocationForm from "$components/add-location/AddLocationForm.svelte";
import CloseButton from "$components/CloseButton.svelte";
import Icon from "$components/Icon.svelte";
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
// True when the submission went out without a verified account — the
// success screen then nudges toward creating one (#1334).
let submittedAnonymously = $state(false);
// The form's review step (#1341): the pin hint disappears — the summary
// froze the coords, so "fine-tune the pin" would be a lie there.
let inReview = $state(false);

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
			{#if !inReview}
				<p class="mb-4 text-sm text-body dark:text-offwhite">
					{$_('addLocation.pinConfirmedHint')}
				</p>
			{/if}
			<AddLocationForm
				{coords}
				onstepchange={(step) => {
					inReview = step === 'review';
				}}
				onsuccess={(attributed) => {
					submitted = true;
					submittedAnonymously = !attributed;
				}}
			/>
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
			<!-- The honest status track (#1342): what actually happens next,
			     with no notification promises — nothing emails submitters
			     when a place goes live today. -->
			<ol class="w-full space-y-4 text-left">
				<li class="flex items-start gap-3">
					<span
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-600 text-white"
						aria-hidden="true"
					>
						✓
					</span>
					<div>
						<p class="font-semibold">{$_('addLocation.trackSubmittedTitle')}</p>
						<p class="text-sm text-body dark:text-offwhite">
							{$_('addLocation.trackSubmittedSub')}
						</p>
					</div>
				</li>
				<li class="flex items-start gap-3">
					<span
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-input text-body dark:text-offwhite"
						aria-hidden="true"
					>
						<Icon type="material" icon="schedule" w="18" h="18" />
					</span>
					<div>
						<p class="font-semibold">{$_('addLocation.trackReviewTitle')}</p>
						<p class="text-sm text-body dark:text-offwhite">
							{$_('addLocation.trackReviewSub')}
						</p>
					</div>
				</li>
				<li class="flex items-start gap-3">
					<span
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-input text-body dark:text-offwhite"
						aria-hidden="true"
					>
						<Icon type="material" icon="map" w="18" h="18" />
					</span>
					<div>
						<p class="font-semibold">{$_('addLocation.trackLiveTitle')}</p>
						<p class="text-sm text-body dark:text-offwhite">
							{$_('addLocation.trackLiveSub')}
						</p>
					</div>
				</li>
			</ol>
			{#if submittedAnonymously}
				<!-- The moment of investment: nudge anonymous submitters
				     toward an account and a track record (#1334). -->
				<div
					class="flex w-full items-start gap-2 rounded-lg border border-gray-300 px-3 py-2.5 text-left dark:border-white/20"
				>
					<Icon
						type="material"
						icon="info_outline"
						w="18"
						h="18"
						class="mt-0.5 shrink-0 text-body dark:text-white/70"
					/>
					<p class="text-sm text-body dark:text-offwhite">
						{$_('addLocation.successAccountNudge')}
						<a href="/signup" class="font-semibold text-link hover:text-hover">
							{$_('addLocation.successAccountCta')}
						</a>
					</p>
				</div>
			{/if}
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

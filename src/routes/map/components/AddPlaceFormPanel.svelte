<script lang="ts">
import AddLocationForm from "$components/add-location/AddLocationForm.svelte";
import CloseButton from "$components/CloseButton.svelte";
import Icon from "$components/Icon.svelte";
import PlacementPinIcon from "$components/PlacementPinIcon.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import { trackEvent } from "$lib/analytics";
import { _ } from "$lib/i18n";
import { formatPinCoords } from "$lib/placementMode";
import { osmEditUrl } from "$lib/placeSubmission";

import MapPanelShell from "./MapPanelShell.svelte";

// In-map host for the add-location form (#1134), wearing the shared
// MapPanelShell: left-docked drawer card on desktop — the map stays
// pannable beside it while the pin stays frozen (#1396) — and a
// full-screen sheet on mobile, since a long form wants full height and
// native scroll, not peek-drawer gestures.
type Props = {
	coords: { lat: number; long: number };
	// True while the host re-places the pin: the panel is hidden, not
	// unmounted, so the form keeps its fields.
	hidden?: boolean;
	// Back to the placement sheet (the close button and Escape).
	onclose: () => void;
	// The pin chip's Move pin: hand the pin back to placement mode.
	onmovepin: () => void;
	// Success-screen actions: restart placement, or leave add mode.
	onaddanother: () => void;
	onexit: () => void;
};
let {
	coords,
	hidden = false,
	onclose,
	onmovepin,
	onaddanother,
	onexit,
}: Props = $props();

let submitted = $state(false);
// True when the submission went out without a verified account — the
// success screen then nudges toward creating one (#1334).
let submittedAnonymously = $state(false);
// The form's review step (#1341): the pin chip and the OSM card are
// edit-only — the summary froze the coords, so Move pin would diverge
// from what it shows.
let inReview = $state(false);

// Returning from Move pin puts focus back on the control that started it.
let movePinButton = $state<HTMLButtonElement>();
let wasHidden = false;
$effect(() => {
	if (wasHidden && !hidden) movePinButton?.focus();
	wasHidden = hidden;
});

const onKeydown = (event: KeyboardEvent) => {
	// While the host re-places the pin, Escape belongs to its sheet.
	if (hidden || event.defaultPrevented) return;
	if (event.key === "Escape") {
		event.preventDefault();
		onclose();
	}
};
</script>

<svelte:window onkeydown={onKeydown} />

<MapPanelShell label={$_('addLocation.title')}>
	{#snippet header()}
		<div class="w-full">
			<div class="flex items-center justify-between">
				<h2 class="pl-2 text-lg font-semibold text-primary dark:text-white">
					{$_('addLocation.title')}
				</h2>
				<CloseButton on:click={onclose} ariaLabel={$_('map.placement.cancel')} />
			</div>
			{#if !submitted}
				<!-- Progress lives in the header: the step label plus a
				     two-segment bar (link = reached, input = ahead — the
				     filter chips' active/inactive pair). Announced on change
				     so the edit↔review swap isn't silent. The success screen
				     gets no counter: "step N of 2" belongs to the form. -->
				<p
					aria-live="polite"
					class="px-2 pt-0.5 pb-2 text-xs font-bold tracking-[0.6px] text-body uppercase dark:text-offwhite"
				>
					{$_('addLocation.stepIndicator', {
						values: {
							current: inReview ? 2 : 1,
							total: 2,
							name: inReview ? $_('addLocation.stepReview') : $_('addLocation.stepDetails')
						}
					})}
				</p>
				<div class="flex gap-[5px] px-2 pb-1" aria-hidden="true">
					<span class="h-1 flex-1 rounded-sm bg-link"></span>
					<span
						class="h-1 flex-1 rounded-sm {inReview ? 'bg-link' : 'bg-input dark:bg-white/20'}"
					></span>
				</div>
			{/if}
		</div>
	{/snippet}

	{#if !submitted}
		<div class="px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] md:pb-4">
			{#if !inReview}
				<!-- The pin as a stated value (#1396): the host froze it when the
				     form opened, and Move pin is the one way to change it. -->
				<div
					class="mb-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border border-input bg-offwhite px-3 py-2.5 dark:border-white/20 dark:bg-white/5"
				>
					<PlacementPinIcon width={16} class="shrink-0" />
					<div class="min-w-0">
						<p
							class="text-xs font-bold tracking-[0.5px] text-body uppercase dark:text-offwhite"
						>
							{$_('addLocation.pinChipLabel')}
						</p>
						<p class="mt-0.5 text-sm text-primary tabular-nums dark:text-white">
							{formatPinCoords(coords.lat, coords.long)}
						</p>
					</div>
					<button
						bind:this={movePinButton}
						type="button"
						onclick={onmovepin}
						class="ml-auto inline-flex items-center gap-1 text-sm font-semibold whitespace-nowrap text-link hover:text-hover focus:outline-link"
					>
						<Icon type="material" icon="my_location" w="16" h="16" />
						{$_('addLocation.movePin')}
					</button>
				</div>
				<!-- Path fork for OSM-capable users (#1344): a deep link into the
				     iD editor at the chosen pin, in a new tab so the form state
				     survives. Hidden with the hint during review (#1341) — the
				     summary is no place to invite leaving. When OSM OAuth lands
				     it replaces this card in the same slot. The official OSM
				     logo is vendored unmodified — the OSMF trademark policy
				     (§3.3.4) allows it to identify a hyperlink to OSM but
				     forbids altering it. The CTA sits on its own line as an
				     outlined pill: a visible action, still a step below the
				     form's filled primary buttons (review on #1397). -->
				<div
					class="mb-4 flex items-start gap-2 rounded-lg border border-gray-300 px-3 py-2.5 dark:border-white/20"
				>
					<img
						src="/icons/osm-logo.svg"
						alt=""
						class="mt-0.5 h-5 w-5 shrink-0"
					/>
					<div>
						<p class="text-sm text-body dark:text-offwhite">
							{$_('addLocation.osmForkPrompt')}
						</p>
						<a
							href={osmEditUrl(coords.lat, coords.long)}
							target="_blank"
							rel="noopener noreferrer"
							class="mt-2 inline-block rounded-full border border-link px-4 py-1.5 text-sm font-semibold text-link transition-colors hover:bg-link hover:text-white focus:outline-link"
							onclick={() => trackEvent('add_place_osm_edit_click')}
						>
							{$_('addLocation.osmForkCta')}
						</a>
					</div>
				</div>
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
						<p class="font-semibold text-primary dark:text-white">{$_('addLocation.trackSubmittedTitle')}</p>
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
						<p class="font-semibold text-primary dark:text-white">{$_('addLocation.trackReviewTitle')}</p>
						<p class="text-sm text-body dark:text-offwhite">
							{$_('addLocation.trackReviewSub')}
						</p>
						<!-- Temporary stand-in (#1374): the per-submission issue id
						     is created asynchronously by the API now, so link the
						     public queue instead — replaced by in-app issue links
						     once those are surfaced (separate PR). -->
						<a
							href="https://gitea.btcmap.org/teambtcmap/btcmap-data/issues"
							target="_blank"
							rel="noopener noreferrer"
							class="text-sm font-semibold text-link hover:text-hover"
							onclick={() => trackEvent('add_place_review_queue_click')}
						>
							{$_('addLocation.trackReviewQueueLink')}
						</a>
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
						<p class="font-semibold text-primary dark:text-white">{$_('addLocation.trackLiveTitle')}</p>
						<p class="text-sm text-body dark:text-offwhite">
							{$_('addLocation.trackLiveSub')}
						</p>
					</div>
				</li>
			</ol>
			<!-- The track names the volunteer review — answer the question it
			     raises and recruit at the moment of investment (#1368). -->
			<p class="w-full text-left text-sm text-body dark:text-offwhite">
				{$_('addLocation.successVolunteerPrompt')}
				<a
					href="https://join.btcmap.org/"
					target="_blank"
					rel="noopener noreferrer"
					class="font-semibold text-link hover:text-hover"
					onclick={() => trackEvent('add_place_tagger_guide_click')}
				>
					{$_('addLocation.successVolunteerCta')}
				</a>
			</p>
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

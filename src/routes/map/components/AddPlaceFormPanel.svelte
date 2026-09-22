<script lang="ts">
import AddLocationForm from "$components/add-location/AddLocationForm.svelte";
import CloseButton from "$components/CloseButton.svelte";
import Icon from "$components/Icon.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import { trackEvent } from "$lib/analytics";
import { _ } from "$lib/i18n";
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
	// The address field's Move pin: hand the pin back to placement mode.
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
// The form's review step (#1341): the OSM card is edit-only — the
// summary is no place to invite leaving. The pin itself is stated by the
// form, beside the Move pin button under the address (#1425).
let inReview = $state(false);

const onKeydown = (event: KeyboardEvent) => {
	// While the host re-places the pin, Escape belongs to its sheet.
	if (hidden || event.defaultPrevented) return;
	if (event.key === "Escape") {
		event.preventDefault();
		onclose();
	}
};

// The success screen's title names the submitted place.
let submittedName = $state("");
// The review step can leave the panel scrolled down; the success screen
// leads with its title (scroll-mt clears the sticky header).
let successElement = $state<HTMLElement>();
$effect(() => {
	successElement?.scrollIntoView({ block: "start" });
});
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
				{hidden}
				{onmovepin}
				onstepchange={(step) => {
					inReview = step === 'review';
				}}
				onsuccess={({ attributed, name }) => {
					submitted = true;
					submittedName = name;
					submittedAnonymously = !attributed;
				}}
			/>
		</div>
	{:else}
		<!-- Success states the current stage only (#1395): the track keeps
		     its three stages, but only the one the submission is in explains
		     itself, and a single ask — picked by attribution — sits below
		     the actions behind a rule, so it reads as an aside. -->
		<div
			bind:this={successElement}
			class="scroll-mt-16 px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] md:pb-6"
		>
			<h2 class="text-2xl font-semibold text-primary dark:text-white">
				{$_('addLocation.successTitle', { values: { name: submittedName } })}
			</h2>
			<p class="mt-1 text-sm text-body dark:text-offwhite">
				{$_('addLocation.successStatus')}
			</p>
			<!-- The honest status track (#1342): what actually happens next,
			     with no notification promises — nothing emails submitters
			     when a place goes live today. Done = statPositive, current =
			     link with a soft ring, ahead = outlined. -->
			<ol class="mt-6">
				<li class="flex gap-3.5">
					<div class="flex shrink-0 flex-col items-center" aria-hidden="true">
						<span
							class="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-statPositive text-white"
						>
							<Icon type="material" icon="check" w="14" h="14" />
						</span>
						<span class="min-h-[30px] w-0.5 flex-1 bg-input dark:bg-white/20"></span>
					</div>
					<p class="pb-[22px] font-semibold text-primary dark:text-white">
						{$_('addLocation.trackSubmittedTitle')}
					</p>
				</li>
				<li class="flex gap-3.5" aria-current="step">
					<div class="flex shrink-0 flex-col items-center" aria-hidden="true">
						<span
							class="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-link ring-4 ring-link/15"
						>
							<span class="h-2 w-2 rounded-full bg-white"></span>
						</span>
						<span class="min-h-[30px] w-0.5 flex-1 bg-lightBlue dark:bg-white/10"></span>
					</div>
					<div class="pb-[22px]">
						<p class="font-semibold text-primary dark:text-white">
							{$_('addLocation.trackReviewTitle')}
						</p>
						<p class="mt-1.5 max-w-[30ch] text-sm text-body dark:text-offwhite">
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
							class="mt-2 inline-block text-sm font-semibold text-link hover:text-hover"
							onclick={() => trackEvent('add_place_review_queue_click')}
						>
							{$_('addLocation.trackReviewQueueLink')}
						</a>
					</div>
				</li>
				<li class="flex gap-3.5">
					<div class="flex shrink-0 flex-col items-center" aria-hidden="true">
						<span
							class="h-[22px] w-[22px] rounded-full border-2 border-input bg-white dark:bg-dark"
						></span>
					</div>
					<p class="font-medium text-body dark:text-offwhite">
						{$_('addLocation.trackLiveTitle')}
					</p>
				</li>
			</ol>
			<div class="mt-5 space-y-3">
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
			<div
				class="mt-5 flex items-start gap-2.5 border-t border-input pt-4 dark:border-white/20"
			>
				<Icon
					type="material"
					icon="info_outline"
					w="20"
					h="20"
					class="mt-0.5 shrink-0 text-body dark:text-white/70"
				/>
				{#if submittedAnonymously}
					<!-- Anonymous (including a detached account): nudge toward an
					     account and a track record (#1334). -->
					<div>
						<p class="text-sm font-semibold text-primary dark:text-white">
							{$_('addLocation.successAccountTitle')}
						</p>
						<p class="mt-0.5 text-[13px] leading-[19px] text-body dark:text-offwhite">
							{$_('addLocation.successAccountNudge')}
							<a
								href="/signup"
								class="font-semibold text-link hover:text-hover"
								onclick={() => trackEvent('signup_button_click')}
							>
								{$_('addLocation.successAccountCta')}
							</a>
						</p>
					</div>
				{:else}
					<!-- Attributed: they have an account, so the slot recruits
					     reviewers instead (#1368). -->
					<div>
						<p class="text-sm font-semibold text-primary dark:text-white">
							{$_('addLocation.successVolunteerPrompt')}
						</p>
						<!-- The native guide (#1376), not the join.btcmap.org proof of
						     concept it replaced. Still a new tab so the success panel —
						     and its "Submit another" — survives the detour; same-origin
						     now, so the rel goes: noreferrer would hide the hop from our
						     own analytics. -->
						<a
							href="/join-us"
							target="_blank"
							class="mt-0.5 inline-block text-[13px] leading-[19px] font-semibold text-link hover:text-hover"
							onclick={() => trackEvent('add_place_tagger_guide_click')}
						>
							{$_('addLocation.successVolunteerCta')}
						</a>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</MapPanelShell>

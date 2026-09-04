<script lang="ts">
import AddLocationForm from "$components/add-location/AddLocationForm.svelte";
import FormHelperText from "$components/FormHelperText.svelte";
import FormSuccess from "$components/FormSuccess.svelte";
import HeaderPlaceholder from "$components/layout/HeaderPlaceholder.svelte";
import PlacementPinIcon from "$components/PlacementPinIcon.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import { _ } from "$lib/i18n";
import { placementEntryUrl } from "$lib/placementMode";
import { theme } from "$lib/theme";

import type { PageData } from "./$types";
import { goto } from "$app/navigation";

// Thin host around AddLocationForm: page chrome, the supertagger column
// and the success screen. The pin always comes from the map's placement
// mode — the route's load guard redirects anything without valid
// ?lat&long there — so the form is details-first by construction (SSR
// included, no hydration flash).
export let data: PageData;
$: coords = data.coords;

let submitted = false;
</script>

<svelte:head>
	<title>BTC Map - {$_('addLocation.title')}</title>
	<meta property="og:image" content="https://btcmap.org/images/og/add.png" />
	<meta property="og:title" content="BTC Map - {$_('addLocation.title')}" />
	<meta name="twitter:title" content="BTC Map - {$_('addLocation.title')}" />
	<meta name="twitter:image" content="https://btcmap.org/images/og/add.png" />
</svelte:head>

{#if !submitted}
	{#if typeof window !== 'undefined'}
		<h1
			class="{$theme === 'dark'
				? 'text-white'
				: 'gradient'} mt-10 text-center text-4xl font-semibold md:text-5xl"
		>
			{$_('addLocation.title')}
		</h1>
	{:else}
		<HeaderPlaceholder />
	{/if}

	<!-- Same pin glyph as the map's placement crosshair — the visual cue
	     that the pin the user just confirmed is the one this page holds. -->
	<div
		class="mx-auto mt-10 flex max-w-xl items-center gap-3 rounded-2xl border-2 border-bitcoin/40 bg-bitcoin/10 px-4 py-3"
	>
		<PlacementPinIcon width={24} class="shrink-0" />
		<div>
			<p class="font-semibold text-primary dark:text-white">
				{$_('addLocation.pinConfirmedTitle')}
			</p>
			<p class="text-sm text-body dark:text-offwhite">
				{$_('addLocation.pinConfirmedHint')}
			</p>
		</div>
	</div>

	<div class="mt-16 pb-20 md:pb-32 lg:flex lg:justify-between lg:gap-10">
		<section id="form" class="mx-auto w-full lg:w-1/2 lg:border-r lg:border-input lg:pr-10">
			<div class="mx-auto max-w-xl">
				<h2
					class="mb-5 text-center text-3xl font-semibold text-primary md:text-left dark:text-white"
				>
					{$_('addLocation.heading')}
				</h2>

				<div class="mb-10 w-full text-justify text-primary dark:text-white">
					<p>
						{$_('addLocation.description')}
					</p>
					<FormHelperText text={$_('addLocation.tooltip')} />
				</div>
				<AddLocationForm {coords} onsuccess={() => (submitted = true)} />
			</div>
		</section>

		<section
			id="supertagger"
			class="mx-auto mt-14 w-full border-t border-input pt-14 lg:mt-0 lg:w-1/2 lg:border-t-0 lg:pt-0 lg:pl-10"
		>
			<div class="lg:flex lg:justify-start">
				<div class="mx-auto max-w-xl text-primary dark:text-white">
					<h2 class="mb-5 text-center text-3xl font-semibold md:text-left">
						{$_('addLocation.supertaggerHeading')}
					</h2>
					<p class="mb-10 w-full text-justify md:text-left">
						{$_('addLocation.supertaggerDescription')}
					</p>
					<img
						src="/images/supertagger.svg"
						alt={$_('addLocation.supertaggerImageAlt')}
						class="mx-auto mb-10 h-[220px] w-[220px]"
					/>
					<PrimaryButton
						style="w-full py-3 rounded-xl"
						link="https://wiki.btcmap.org/Tagging-Merchants#shadowy-supertaggers-"
						external={true}
					>
						{$_('addLocation.supertaggerWikiButton')}
					</PrimaryButton>
				</div>
			</div>
		</section>
	</div>
{:else}
	<FormSuccess
		type={$_('addLocation.formSuccessType')}
		text={$_('addLocation.formSuccessText')}
		showIssueLink={false}
		on:click={() => goto(placementEntryUrl('another'))}
	/>
{/if}

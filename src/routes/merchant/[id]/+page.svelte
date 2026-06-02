<script lang="ts">
export let data: MerchantPageData;

import { onMount } from "svelte";
import Time from "svelte-time";
import tippy from "tippy.js";

import Boost from "$components/Boost.svelte";
import BoostButton from "$components/BoostButton.svelte";
import Card from "$components/Card.svelte";
import CompanionAppPill from "$components/CompanionAppPill.svelte";
import Icon from "$components/Icon.svelte";
import PaymentMethodPills from "$components/PaymentMethodPills.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import ShowTags from "$components/ShowTags.svelte";
import TaggingIssues from "$components/TaggingIssues.svelte";
import { _, getDisplayLang, locale } from "$lib/i18n";
import { placesById } from "$lib/store";
import type { MerchantActivityEvent, MerchantPageData } from "$lib/types";
import { formatVerifiedHuman, isBoosted } from "$lib/utils";
import { isRecentlyVerified } from "$lib/verification";

import CommentAddButton from "./components/CommentAddButton.svelte";
import MerchantActionChips from "./components/MerchantActionChips.svelte";
import MerchantComment from "./components/MerchantComment.svelte";
import MerchantDetailsPanel from "./components/MerchantDetailsPanel.svelte";
import MerchantEvent from "./components/MerchantEvent.svelte";
import MerchantHero from "./components/MerchantHero.svelte";
import MerchantTabs from "./components/MerchantTabs.svelte";
import { browser } from "$app/environment";

// Server data is consumed directly; only the fields the page itself renders
// (hero, payment indicator, action chips, activity) are mirrored here.
let icon: string | undefined;
let address: string | undefined;
let description: string | undefined;
let phone: string | undefined;
let paymentMethod: string | undefined;
let lat: number;
let long: number;
let merchantEvents: MerchantActivityEvent[] = [];
let name: string | undefined;
let localizedName: string | undefined;

$: localizedName = data.localizedName?.[getDisplayLang($locale)];
$: icon = data.icon;
$: address = data.address;
$: description = data.description;
$: phone = data.phone;
$: companionAppUrl =
	data.osmTags?.["payment:lightning:companion_app_url"] ||
	data.placeData.required_app_url;
$: paymentMethod = data.paymentMethod;
$: lat = data.lat;
$: long = data.lon;
$: merchantEvents = data.activity;
$: name = data.name;

$: displayName = localizedName || name || "BTC Map Merchant";
$: deletedAt = data.placeData.deleted_at;
$: heroIcon = deletedAt
	? "skull"
	: icon && icon !== "question_mark"
		? icon
		: "currency_bitcoin";

// Make comments reactive to server data updates (from invalidateAll() after adding comment)
let comments: typeof data.comments;
$: comments = data.comments;

$: verifiedAt = data.placeData?.verified_at;

// Boost reflects both server data and store updates, but only while active.
let boosted: string | undefined;
$: {
	const placeInStore = $placesById.get(Number(data.id));
	const mergedPlace = placeInStore || data.placeData;
	boosted =
		mergedPlace && isBoosted(mergedPlace)
			? mergedPlace.boosted_until
			: undefined;
}

let verifiedTooltip: HTMLSpanElement;
let outdatedTooltip: HTMLSpanElement;

$: verifiedTooltip &&
	tippy([verifiedTooltip], {
		content: $_("verification.verifiedTooltip"),
	});

$: outdatedTooltip &&
	tippy([outdatedTooltip], {
		content: $_("verification.outdatedTooltip"),
	});

let eventCount = 50;
$: eventsPaginated = merchantEvents.slice(0, eventCount);

onMount(async () => {
	if (browser) {
		// Refresh localforage so the main map / saved lists reflect current data.
		try {
			const { updatePlaceInCache } = await import("$lib/sync/places");
			await updatePlaceInCache(data.placeData);
		} catch (error) {
			console.error("Could not update place in localforage:", error);
		}
	}
});

const ogImage = `https://api.btcmap.org/og/element/${data.id}`;
</script>

<svelte:head>
	<title>{localizedName || name ? (localizedName || name) + ' - ' : ''}BTC Map - {$_('meta.merchant')}</title>
	<meta property="og:image" content={ogImage} />
	<meta property="og:title" content="{localizedName || name ? (localizedName || name) + ' - ' : ''}BTC Map - {$_('meta.merchant')}" />
	<meta name="twitter:title" content="{localizedName || name ? (localizedName || name) + ' - ' : ''}BTC Map - {$_('meta.merchant')}" />
	<meta name="twitter:image" content={ogImage} />
</svelte:head>

{#if data.placeData.deleted_at}
	<div class="bg-red-600 py-4 text-center text-white">
		<p class="text-lg font-semibold">
			<Icon w="20" h="20" class="mr-2 inline-block text-white" icon="skull" type="material" />
			{$_('merchant.deletedNotice')}
		</p>
		<p class="mt-1 text-sm">{$_('merchant.deletedDetail')}</p>
	</div>
{/if}

<div class="mx-auto my-10 max-w-5xl px-4 text-left md:my-16">
	<div
		class="space-y-4 lg:grid lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start lg:gap-8 lg:space-y-0"
	>
		<!-- identity + primary actions -->
		<div class="space-y-4">
			<MerchantHero
				id={data.id}
				name={displayName}
				{address}
				icon={heroIcon}
				{lat}
				{long}
				boosted={!!boosted}
				deleted={!!deletedAt}
			/>

			{#if paymentMethod || companionAppUrl}
				<div class="rounded-2xl border border-gray-300 p-4 dark:border-white/20 dark:bg-white/5">
					<div class="flex flex-wrap items-center gap-2">
						{#if paymentMethod}
							<PaymentMethodPills
								onchain={data.osmTags?.['payment:onchain']}
								lightning={data.osmTags?.['payment:lightning']}
								contactless={data.osmTags?.['payment:lightning_contactless']}
							/>
						{/if}
						{#if companionAppUrl}
							<CompanionAppPill url={companionAppUrl} />
						{/if}
					</div>
				</div>
			{/if}

			<MerchantActionChips
				merchantId={data.id}
				{lat}
				{long}
				{phone}
				osmEditUrl={data.osmEditUrl}
			/>

			{#if description}
				<p class="text-primary dark:text-white">{description}</p>
			{/if}

			<!-- Last surveyed / verify -->
			<Card headerAlign="center">
				<h3 slot="header" class="text-2xl font-semibold">{$_('verification.lastSurveyed')}</h3>

				<div slot="body" class="p-4">
					{#if verifiedAt}
						<div class="flex items-center justify-center dark:text-white">
							{#if isRecentlyVerified(verifiedAt)}
								<span bind:this={verifiedTooltip}>
									<Icon w="30" h="30" class="mr-2 text-primary dark:text-white" icon="verified" type="material" />
								</span>
							{:else}
								<span bind:this={outdatedTooltip}>
									<Icon w="30" h="30" class="mr-2 text-primary dark:text-white" icon="error_outline" type="material" />
								</span>
							{/if}
							<strong>{formatVerifiedHuman(verifiedAt)}</strong>
						</div>
					{:else}
						<p class="font-semibold dark:text-white">{$_('verification.notSurveyed')}</p>
					{/if}
				</div>

				<PrimaryButton slot="footer" link={`/verify-location?id=${data.id}`} style="rounded-xl p-3 w-40">
					{$_('verification.verifyLocation')}
				</PrimaryButton>
			</Card>

			<!-- Boost -->
			<div
				class="flex w-full flex-col rounded-3xl border border-amber-200 bg-amber-50/50 dark:border-amber-700/30 dark:bg-amber-900/10"
			>
				<div
					class="flex items-center justify-center gap-2 border-b border-amber-200 p-5 dark:border-amber-700/30"
				>
					<Icon
						w="20"
						h="20"
						class="text-amber-800 dark:text-amber-300"
						icon={boosted ? 'auto_awesome' : 'rocket_launch'}
						type="material"
					/>
					<h3 class="text-2xl font-semibold text-amber-800 dark:text-amber-300">
						{$_('boost.title')}
					</h3>
				</div>

				<div class="flex flex-1 flex-col justify-between gap-4">
					<div class="flex flex-col items-center gap-4 p-4">
						<p class="font-semibold text-amber-800 dark:text-amber-300">
							{boosted ? $_('boost.isBoosted') : $_('boost.getVisibility')}
						</p>
						{#if !boosted}
							<p class="text-sm text-amber-700 dark:text-amber-400/80">
								{$_('boost.boostPromo')}
							</p>
						{/if}

						{#if boosted}
							<p class="text-amber-700 dark:text-amber-400/80">
								{$_('boost.expires')}:
								<span class="font-semibold">
									<Time live={3000} relative={true} timestamp={boosted} />
								</span>
							</p>
						{/if}
					</div>

					<div class="flex justify-center pb-4">
						<BoostButton merchant={data.placeData} {boosted} />
					</div>
				</div>
			</div>
		</div>

		<!-- content: comments / activity / details -->
		<div>
			<MerchantTabs commentsCount={comments.length} activityCount={merchantEvents.length}>
				<svelte:fragment slot="comments">
					<div class="mb-4 flex justify-center lg:justify-start">
						<CommentAddButton elementId={data.id} />
					</div>
					{#if comments && comments.length}
						<div class="divide-y divide-gray-200 dark:divide-white/10">
							{#each [...comments].reverse() as comment (comment.id)}
								<MerchantComment text={comment.text} time={comment['created_at']} compact />
							{/each}
						</div>
					{:else}
						<p class="text-body dark:text-white">{$_('comments.none')}</p>
					{/if}
				</svelte:fragment>

				<svelte:fragment slot="activity">
					{#if merchantEvents && merchantEvents.length}
						<div class="divide-y divide-gray-200 dark:divide-white/10">
							{#each eventsPaginated as event (event['created_at'])}
								<MerchantEvent
									action={event.type}
									user_id={event.user_id}
									user_name={event.user_name}
									user_tip={event.user_tip}
									time={event['created_at']}
									latest={event === merchantEvents[0]}
								/>
							{/each}
						</div>

						{#if eventsPaginated.length !== merchantEvents.length}
							<button
								class="mx-auto mt-4 block text-xl font-semibold text-link transition-colors hover:text-hover"
								on:click={() => (eventCount = eventCount + 50)}>{$_('info.loadMore')}</button
							>
						{/if}
					{:else}
						<p class="text-body dark:text-white">{$_('info.noActivity')}</p>
					{/if}
				</svelte:fragment>

				<svelte:fragment slot="details">
					<MerchantDetailsPanel {data} />
				</svelte:fragment>
			</MerchantTabs>
		</div>
	</div>
</div>

{#if browser}
	<Boost />
{/if}

<ShowTags />
<TaggingIssues />

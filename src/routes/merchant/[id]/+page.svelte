<script lang="ts">
export let data: MerchantPageData;

import { onMount } from "svelte";

import Boost from "$components/Boost.svelte";
import BoostCard from "$components/BoostCard.svelte";
import CompanionAppPill from "$components/CompanionAppPill.svelte";
import Icon from "$components/Icon.svelte";
import OpenStatusPill from "$components/OpenStatusPill.svelte";
import PaymentMethodPills from "$components/PaymentMethodPills.svelte";
import ShowTags from "$components/ShowTags.svelte";
import TaggingIssues from "$components/TaggingIssues.svelte";
import { _, getDisplayLang, locale } from "$lib/i18n";
import { boost, placesById, resetBoost } from "$lib/store";
import type { MerchantActivityEvent, MerchantPageData } from "$lib/types";
import { isBoosted } from "$lib/utils";

import CommentAddButton from "./components/CommentAddButton.svelte";
import MerchantActionChips from "./components/MerchantActionChips.svelte";
import MerchantComment from "./components/MerchantComment.svelte";
import MerchantDetailsPanel from "./components/MerchantDetailsPanel.svelte";
import MerchantEvent from "./components/MerchantEvent.svelte";
import MerchantHero from "./components/MerchantHero.svelte";
import MerchantTabs from "./components/MerchantTabs.svelte";
import MerchantVerifyRow from "./components/MerchantVerifyRow.svelte";
import { browser } from "$app/environment";

// Server data is consumed directly; only the fields the page itself renders
// (hero, payment indicator, action chips, activity) are mirrored here.
let icon: string | undefined;
let address: string | undefined;
let description: string | undefined;
let phone: string | undefined;
let hours: string | undefined;
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
$: hours = data.hours;
$: companionAppUrl =
	data.osmTags?.["payment:lightning:companion_app_url"] ||
	data.placeData.required_app_url;
// Only "yes" payment tags render a pill; gate the box on that (not on
// getPaymentMethod() truthiness, which is also true for payment:*=no).
$: hasPaymentPill =
	data.osmTags?.["payment:onchain"] === "yes" ||
	data.osmTags?.["payment:lightning"] === "yes" ||
	data.osmTags?.["payment:lightning_contactless"] === "yes";
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

// Open the boost modal via the $boost store (same trigger BoostButton uses);
// $resetBoost clears the loading state when the modal flow finishes.
let boostLoading = false;
const resetBoostLoading = () => {
	boostLoading = false;
};
$: $resetBoost && resetBoostLoading();
const handleBoost = () => {
	boostLoading = true;
	$boost = {
		id: data.placeData.id,
		name: data.placeData.name || "",
		boost: boosted || "",
	};
};

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

			{#if hasPaymentPill || companionAppUrl}
				<div class="rounded-2xl border border-gray-300 p-4 dark:border-white/20 dark:bg-white/5">
					<div class="flex flex-wrap items-center gap-2">
						{#if hasPaymentPill}
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

			{#if hours}
				<div><OpenStatusPill {hours} {lat} {long} /></div>
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
			<MerchantVerifyRow id={data.id} verifiedAt={verifiedAt} />

			<!-- Boost -->
			<BoostCard
				boosted={!!boosted}
				boostedUntil={boosted}
				loading={boostLoading}
				onClick={handleBoost}
			/>
		</div>

		<!-- content: static details (pinned) + comments / activity feed -->
		<div class="space-y-6">
			<!-- Semi-static reference info pinned above the feed so it never
			     scrolls away behind dynamic comments/activity. -->
			<section>
				<h3 class="mb-4 text-lg font-semibold text-primary dark:text-white">
					{$_('merchant.details')}
				</h3>
				<MerchantDetailsPanel {data} />
			</section>

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
							{#each eventsPaginated as event (event.id)}
								<MerchantEvent
									action={event.type}
									user_id={event.user_id}
									user_name={event.user_name}
									user_tip={event.user_tip}
									time={event['created_at']}
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
			</MerchantTabs>
		</div>
	</div>
</div>

{#if browser}
	<Boost />
{/if}

<ShowTags />
<TaggingIssues />

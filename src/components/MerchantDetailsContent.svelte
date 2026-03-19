<script lang="ts">
import axios from "axios";
import Time from "svelte-time";

import Icon from "$components/Icon.svelte";
import MerchantComment from "$components/MerchantComment.svelte";
import PaymentMethodIcon from "$components/PaymentMethodIcon.svelte";
import {
	CATEGORY_COLOR_CLASSES,
	getIconColorWithFallback,
} from "$lib/categoryMapping";
import { _, getDisplayLang, locale } from "$lib/i18n";
import { getOpenStatus } from "$lib/openingHoursStatus";
import type { Place } from "$lib/types";
import { formatVerifiedHuman } from "$lib/utils";

import { resolve } from "$app/paths";

export let merchant: Place;
export let isUpToDate: boolean;
export let isBoosted: boolean;
export let boostLoading: boolean;
export let onBoostClick: () => void;
export let isLoading: boolean = false;

$: displayName =
	merchant.localized_name?.[getDisplayLang($locale)] || merchant.name;

$: openStatus = getOpenStatus(merchant.opening_hours, {
	lat: merchant.lat,
	lon: merchant.lon,
});

// Comments state
let comments: { id: number; text: string; created_at: string }[] = [];
let commentsLoading = false;
let commentsError = false;
let lastFetchedId: number | null = null;
let abortController: AbortController | null = null;

// Non-retrying axios instance for fast fail
const fastApi = axios.create({ timeout: 5000 });

// Fetch comments when merchant changes (with proper guards)
$: if (
	merchant?.id &&
	merchant.id !== lastFetchedId &&
	(merchant.comments || 0) > 0
) {
	fetchComments(merchant.id);
} else if (merchant?.id && (merchant.comments || 0) === 0) {
	// Skip fetch if no comments exist
	comments = [];
	commentsLoading = false;
	commentsError = false;
	lastFetchedId = null;
}

async function fetchComments(placeId: number) {
	// Cancel any pending request
	if (abortController) {
		abortController.abort();
	}
	abortController = new AbortController();

	commentsLoading = true;
	commentsError = false;
	lastFetchedId = placeId;

	try {
		const response = await fastApi.get(
			`https://api.btcmap.org/v4/places/${placeId}/comments`,
			{ signal: abortController.signal },
		);
		// Validate response is an array
		if (Array.isArray(response.data)) {
			comments = response.data;
		} else {
			comments = [];
			commentsError = true;
		}
	} catch (err) {
		if (axios.isCancel(err)) return;
		console.error("Error fetching comments:", err);
		commentsError = true;
	} finally {
		commentsLoading = false;
		abortController = null;
	}
}
</script>

<div class="space-y-4">
	{#if merchant.deleted_at}
		<div class="rounded-lg bg-red-600 p-3 text-center text-sm text-white">
			<p class="font-semibold">
				<Icon w="16" h="16" class="mr-1 inline-block text-white" icon="skull" type="material" />
				{$_('merchant.deletedBanner')}
			</p>
		</div>
	{/if}

	<a
		href={resolve(`/merchant/${merchant.id}`)}
		class="flex items-start gap-3 rounded-xl p-2 -m-2 transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
	>
		<!-- Category icon -->
		<div
			class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl {CATEGORY_COLOR_CLASSES[
				getIconColorWithFallback(merchant.icon)
			] || 'bg-primary/10 text-primary dark:bg-white/10 dark:text-white'}"
		>
			<Icon w="26" h="26" icon={merchant.icon || 'currency_bitcoin'} type="material" />
		</div>

		<div class="min-w-0 flex-1">
			{#if displayName}
				<span class="inline-block text-[22px] leading-snug font-semibold text-link transition-colors hover:text-hover">
					{displayName}
				</span>
			{:else if isLoading}
				<div class="h-7 w-3/4 animate-pulse rounded-lg bg-link/50"></div>
			{/if}

			{#if merchant.address}
				<p class="mt-0.5 text-sm text-body dark:text-white">
					{merchant.address}
				</p>
			{:else if isLoading}
				<div class="mt-1 h-5 w-1/2 animate-pulse rounded bg-link/50"></div>
			{/if}

			{#if openStatus}
				<span
					class="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {openStatus.isOpen
						? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
						: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}"
				>
					{openStatus.isOpen ? $_('merchant.openNow') : $_('merchant.closed')}
					{#if openStatus.nextChange}
						<span class="ml-1">· {openStatus.nextChange}</span>
					{/if}
				</span>
			{/if}
		</div>
	</a>

	{#if merchant.opening_hours}
		<div class="flex items-start gap-2" title={$_('merchant.openingHours')}>
			<Icon
				w="16"
				h="16"
				class="mt-0.5 shrink-0 text-body dark:text-white/70"
				icon="schedule"
				type="material"
			/>
			<span class="text-sm text-body dark:text-white">{merchant.opening_hours}</span>
		</div>
	{/if}

	<div class="grid grid-cols-2 gap-2">
		<a
			href="geo:{merchant.lat},{merchant.lon}"
			class="flex flex-col items-center rounded-lg border border-gray-300 py-3 text-primary transition-colors hover:border-link hover:text-link dark:border-white/95 dark:text-white dark:hover:text-link"
		>
			<Icon w="24" h="24" icon="explore" type="material" />
			<span class="mt-1 text-xs">{$_('merchant.navigate')}</span>
		</a>

		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<!-- External link to OpenStreetMap -->
		<a
			href={merchant.osm_url || `https://www.openstreetmap.org/node/${merchant.id}`}
			target="_blank"
			rel="noreferrer"
			class="flex flex-col items-center rounded-lg border border-gray-300 py-3 text-primary transition-colors hover:border-link hover:text-link dark:border-white/95 dark:text-white dark:hover:text-link"
		>
			<Icon w="24" h="24" icon="edit" type="material" />
			<span class="mt-1 text-xs">{$_('merchant.edit')}</span>
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->

		<a
			href={resolve(`/merchant/${merchant.id}`)}
			class="flex flex-col items-center rounded-lg border border-gray-300 py-3 text-primary transition-colors hover:border-link hover:text-link dark:border-white/95 dark:text-white dark:hover:text-link"
		>
			<Icon w="24" h="24" icon="share" type="material" />
			<span class="mt-1 text-xs">{$_('merchant.share')}</span>
		</a>

		<a
			href={resolve(`/merchant/${merchant.id}#comments`)}
			class="flex flex-col items-center rounded-lg border border-gray-300 py-3 text-primary transition-colors hover:border-link hover:text-link dark:border-white/95 dark:text-white dark:hover:text-link"
		>
			<div class="text-lg font-bold">
				{merchant.comments || 0}
			</div>
			<span class="mt-1 text-xs">{$_('merchant.comments')}</span>
		</a>
	</div>

	<div class="border-t border-gray-300 pt-4 dark:border-white/95">
		{#if merchant['osm:payment:onchain'] || merchant['osm:payment:lightning'] || merchant['osm:payment:lightning_contactless'] || merchant['osm:payment:bitcoin']}
			<div class="mb-4">
				<span class="block text-xs text-mapLabel dark:text-white/70">{$_('payment.methods')}</span>
				<div class="mt-1 flex space-x-2">
					<PaymentMethodIcon
						status={merchant['osm:payment:onchain']}
						method="btc"
						label={$_('payment.onchain')}
					/>
					<PaymentMethodIcon
						status={merchant['osm:payment:lightning']}
						method="ln"
						label={$_('payment.lightning')}
					/>
					<PaymentMethodIcon
						status={merchant['osm:payment:lightning_contactless']}
						method="nfc"
						label={$_('payment.lightningContactless')}
					/>
				</div>
			</div>
		{:else if isLoading}
			<div class="mb-4">
				<div class="h-3 w-24 animate-pulse rounded bg-link/50"></div>
				<div class="mt-1 flex space-x-2">
					<div class="h-8 w-16 animate-pulse rounded bg-link/50"></div>
					<div class="h-8 w-16 animate-pulse rounded bg-link/50"></div>
					<div class="h-8 w-16 animate-pulse rounded bg-link/50"></div>
				</div>
			</div>
		{/if}

		<div class="mb-4">
			<span
				class="block text-xs text-mapLabel dark:text-white/70"
				title={$_('verification.surveyedBy')}>{$_('verification.lastSurveyed')}</span
			>
			{#if merchant.verified_at}
				<span class="block text-body dark:text-white">
					{#if isUpToDate}
						<Icon
							w="16"
							h="16"
							class="mr-1 inline text-primary dark:text-white"
							icon="verified"
							type="material"
						/>
					{:else}
						<Icon
							w="16"
							h="16"
							class="mr-1 inline text-primary dark:text-white"
							icon="error_outline"
							type="material"
						/>
					{/if}
					{formatVerifiedHuman(merchant.verified_at)}
				</span>
			{:else if isLoading}
				<div class="mt-1 h-5 w-32 animate-pulse rounded bg-link/50"></div>
			{:else}
				<span class="block text-body dark:text-white" title={$_('verification.outdatedTooltip')}
					>---</span
				>
			{/if}
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				href={`${resolve('/verify-location')}?id=${merchant.id}`}
				class="text-xs text-link transition-colors hover:text-hover"
				title={$_('verification.helpImprove')}
			>
				{$_('verification.verifyLocation')}
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</div>

		<div>
			{#if isBoosted && merchant.boosted_until}
				<span class="block text-xs text-mapLabel dark:text-white/70" title={$_('boost.isBoosted')}
					>{$_('boost.expires')}</span
				>
				<span class="block text-body dark:text-white">
					<Time live={3000} relative={true} timestamp={merchant.boosted_until} />
				</span>
			{/if}

			<button
				title={isBoosted ? $_('boost.extend') : $_('boost.title')}
				on:click={onBoostClick}
				disabled={boostLoading}
				class="mt-2 flex h-[32px] items-center justify-center space-x-2 rounded-lg border border-gray-300 px-3 text-primary transition-colors hover:border-link hover:text-link dark:border-white/95 dark:text-white dark:hover:text-link"
			>
				{#if !boostLoading}
					<Icon w="16" h="16" icon="arrow_circle_up" type="material" />
				{/if}
				<span class="text-xs"
					>{boostLoading
						? $_('boost.boosting')
						: isBoosted
							? $_('boost.extend')
							: $_('boost.boostAction')}</span
				>
			</button>
		</div>
	</div>

	<a
		href={resolve(`/merchant/${merchant.id}`)}
		class="block rounded-lg bg-link py-3 text-center text-white transition-colors hover:bg-hover"
	>
		{$_('merchant.viewDetails')}
	</a>

	<!-- Comments Section -->
	{#if commentsLoading}
		<div class="space-y-2">
			<div class="h-4 w-24 animate-pulse rounded bg-link/50"></div>
			<div class="space-y-2">
				<div class="h-12 w-full animate-pulse rounded bg-link/50"></div>
				<div class="h-12 w-full animate-pulse rounded bg-link/50"></div>
			</div>
		</div>
	{:else if commentsError}
		<div class="rounded-lg bg-red-100 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
			{$_('errors.loadFailed')}
		</div>
	{:else if comments.length > 0}
		<div class="border-t border-gray-300 pt-4 dark:border-white/95">
			<span class="block text-xs text-mapLabel dark:text-white/70">{$_('merchant.comments')}</span>
			<div class="mt-2 space-y-2">
				{#each comments as comment (comment.id)}
					<MerchantComment text={comment.text} time={comment.created_at} compact={true} />
				{/each}
			</div>
		</div>
	{/if}
</div>

<script lang="ts">
import axios from "axios";
import { onDestroy, onMount } from "svelte";
import Time from "svelte-time";

import CompanionAppPill from "$components/CompanionAppPill.svelte";
import Icon from "$components/Icon.svelte";
import MerchantComment from "$components/MerchantComment.svelte";
import PaymentMethodPills from "$components/PaymentMethodPills.svelte";
import { trackEvent } from "$lib/analytics";
import {
	CATEGORY_COLOR_CLASSES,
	getIconColorWithFallback,
} from "$lib/categoryMapping";
import { _, getDisplayLang, locale } from "$lib/i18n";
import { getOpenStatus } from "$lib/openingHoursStatus";
import type { Place } from "$lib/types";
import { formatVerifiedHuman, sanitizeUrl, shareMerchant } from "$lib/utils";

import { resolve } from "$app/paths";

export let merchant: Place;
export let isUpToDate: boolean;
export let isBoosted: boolean;
export let boostLoading: boolean;
export let onBoostClick: () => void;
export let isLoading: boolean = false;

$: displayName =
	merchant.localized_name?.[getDisplayLang($locale)] || merchant.name;

$: merchantCoords = { lat: merchant.lat, lon: merchant.lon };
$: openStatus = getOpenStatus(merchant.opening_hours, merchantCoords);

$: companionAppUrl =
	merchant["osm:payment:lightning:companion_app_url"] ||
	merchant.required_app_url;

$: phone = merchant.phone || merchant["osm:contact:phone"];
$: websiteRaw = merchant.website || merchant["osm:contact:website"];
$: websiteUrl = sanitizeUrl(websiteRaw);
$: websiteDisplay = (() => {
	if (!websiteUrl) return null;
	try {
		const hostname = new URL(websiteUrl).hostname.replace(/^www\./, "");
		return hostname || null;
	} catch {
		return null;
	}
})();

// Sanitize and resolve OSM edit URL with fallback chain:
// 1. osm_edit_url (preferred — actual edit link)
// 2. osm_url (view link)
// 3. Constructed from osm_id (type:id)
// 4. Fallback to /node/{id}
$: osmEditUrl = (() => {
	const isValidOsmUrl = (url: string | undefined): string | undefined => {
		if (!url) return undefined;
		try {
			const parsed = new URL(url);
			const host = parsed.hostname.toLowerCase();
			if (
				["https:", "http:"].includes(parsed.protocol) &&
				(host === "openstreetmap.org" || host.endsWith(".openstreetmap.org"))
			)
				return url;
		} catch {}
		return undefined;
	};

	const editUrl = isValidOsmUrl(merchant.osm_edit_url);
	if (editUrl) return editUrl;

	const viewUrl = isValidOsmUrl(merchant.osm_url);
	if (viewUrl) return viewUrl;

	if (merchant.osm_id) {
		const [osmType, osmId] = merchant.osm_id.split(":");
		if (
			["node", "way", "relation"].includes(osmType) &&
			/^\d+$/.test(osmId ?? "")
		) {
			return `https://www.openstreetmap.org/${osmType}/${osmId}`;
		}
	}
	return `https://www.openstreetmap.org/node/${merchant.id}`;
})();

// Refresh open/closed status every 60s so the badge stays accurate
let openStatusInterval: ReturnType<typeof setInterval>;
onMount(() => {
	openStatusInterval = setInterval(() => {
		openStatus = getOpenStatus(merchant.opening_hours, merchantCoords);
	}, 60_000);
});
onDestroy(() => {
	clearInterval(openStatusInterval);
	clearTimeout(shareTimeout);
});

let shareConfirm = false;
let shareTimeout: ReturnType<typeof setTimeout>;

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

	<div class="flex items-start gap-3">
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
				<a
					href={resolve(`/merchant/${merchant.id}`)}
					on:click={() => trackEvent('merchant_name_click')}
					class="inline-block text-[22px] leading-snug font-semibold text-link transition-colors hover:text-hover"
					title={$_('merchant.merchantName')}
				>
					{displayName}
				</a>
			{:else if isLoading}
				<div class="h-7 w-3/4 animate-pulse rounded-lg bg-link/50"></div>
			{/if}

			{#if merchant.address}
				<p class="mt-0.5 text-sm text-body dark:text-white" title={$_('merchant.address')}>
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
						<span class="ml-1"
							>· {openStatus.isOpen
								? $_('merchant.closesAt', {
										values: {
											time: openStatus.nextChange.toLocaleTimeString($locale || undefined, {
												hour: 'numeric',
												minute: '2-digit',
											}),
										},
									})
								: $_('merchant.opensAt', {
										values: {
											time: openStatus.nextChange.toLocaleTimeString($locale || undefined, {
												hour: 'numeric',
												minute: '2-digit',
											}),
										},
									})}</span
						>
					{/if}
				</span>
			{/if}
		</div>
	</div>

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

	{#if phone}
		<div class="flex items-center gap-2">
			<Icon
				w="16"
				h="16"
				class="shrink-0 text-body dark:text-white/70"
				icon="phone"
				type="material"
			/>
			<a href="tel:{phone}" class="text-sm text-link transition-colors hover:text-hover">
				{phone}
			</a>
		</div>
	{/if}

	{#if websiteUrl && websiteDisplay}
		<div class="flex items-center gap-2">
			<Icon
				w="16"
				h="16"
				class="shrink-0 text-body dark:text-white/70"
				icon="language"
				type="material"
			/>
			<a
				href={websiteUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="truncate text-sm text-link transition-colors hover:text-hover"
			>
				{websiteDisplay}
			</a>
		</div>
	{/if}

	<div class="flex justify-around border-t border-b border-gray-200 py-3 dark:border-white/10">
		<a
			href="geo:{merchant.lat},{merchant.lon}"
			class="flex flex-col items-center gap-1 text-primary dark:text-white"
		>
			<span
				class="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white dark:bg-primary"
			>
				<Icon w="18" h="18" icon="explore" type="material" />
			</span>
			<span class="text-[11px]">{$_('merchant.navigate')}</span>
		</a>

		<a
			href={osmEditUrl}
			target="_blank"
			rel="noopener noreferrer"
			class="flex flex-col items-center gap-1 text-primary dark:text-white"
		>
			<span
				class="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 transition-colors hover:bg-gray-50 dark:border-white/20 dark:hover:bg-white/10"
			>
				<Icon w="18" h="18" icon="edit" type="material" />
			</span>
			<span class="text-[11px]">{$_('merchant.edit')}</span>
		</a>

		<button
			on:click={() => {
				shareMerchant(merchant.id);
				clearTimeout(shareTimeout);
				shareConfirm = true;
				shareTimeout = setTimeout(() => (shareConfirm = false), 2000);
			}}
			class="flex flex-col items-center gap-1 text-primary dark:text-white"
		>
			<span
				class="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 transition-colors hover:bg-gray-50 dark:border-white/20 dark:hover:bg-white/10"
			>
				<Icon w="18" h="18" icon={shareConfirm ? 'check_circle' : 'share'} type="material" />
			</span>
			<span class="text-[11px]">{$_('merchant.share')}</span>
		</button>

		<a
			href={resolve(`/merchant/${merchant.id}#comments`)}
			class="flex flex-col items-center gap-1 text-primary dark:text-white"
		>
			<span
				class="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 transition-colors hover:bg-gray-50 dark:border-white/20 dark:hover:bg-white/10"
			>
				<span class="text-sm font-bold">{merchant.comments || 0}</span>
			</span>
			<span class="text-[11px]">{$_('merchant.comments')}</span>
		</a>
	</div>

	<div class="divide-y divide-gray-200 dark:divide-white/10">
		{#if merchant['osm:payment:lightning'] === 'yes' || merchant['osm:payment:onchain'] === 'yes' || merchant['osm:payment:lightning_contactless'] === 'yes' || companionAppUrl}
			<div class="flex items-center gap-2 py-2.5">
				<PaymentMethodPills
					onchain={merchant['osm:payment:onchain']}
					lightning={merchant['osm:payment:lightning']}
					contactless={merchant['osm:payment:lightning_contactless']}
				/>
				{#if companionAppUrl}
					<CompanionAppPill url={companionAppUrl} />
				{/if}
			</div>
		{:else if isLoading}
			<div class="flex gap-2 py-2.5">
				<div class="h-7 w-20 animate-pulse rounded-full bg-link/50"></div>
				<div class="h-7 w-20 animate-pulse rounded-full bg-link/50"></div>
			</div>
		{/if}

		<div class="flex items-center gap-2 py-2.5">
			{#if merchant.verified_at}
				<Icon
					w="16"
					h="16"
					class="shrink-0 text-primary dark:text-white"
					icon={isUpToDate ? 'verified' : 'error_outline'}
					type="material"
				/>
				<span class="text-sm text-body dark:text-white">
					{formatVerifiedHuman(merchant.verified_at)}
				</span>
			{:else if isLoading}
				<div class="h-5 w-32 animate-pulse rounded bg-link/50"></div>
			{:else}
				<Icon
					w="16"
					h="16"
					class="shrink-0 text-body dark:text-white/70"
					icon="error_outline"
					type="material"
				/>
				<span class="text-sm text-body dark:text-white" title={$_('verification.outdatedTooltip')}
					>---</span
				>
			{/if}

			{#if !isLoading}
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<span class="text-body dark:text-white/50">·</span>
				<a
					href={`${resolve('/verify-location')}?id=${merchant.id}`}
					class="text-xs text-link transition-colors hover:text-hover"
					title={$_('verification.helpImprove')}
				>
					{$_('verification.verifyLocation')}
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}
		</div>

		{#if isBoosted && merchant.boosted_until}
			<div class="flex items-center gap-2 py-2.5">
				<Icon
					w="16"
					h="16"
					class="shrink-0 text-primary dark:text-white"
					icon="arrow_circle_up"
					type="material"
				/>
				<span class="text-sm text-body dark:text-white">
					<Time live={3000} relative={true} timestamp={merchant.boosted_until} />
				</span>
				<span class="text-body dark:text-white/50">·</span>
				<button
					title={$_('boost.extend')}
					on:click={onBoostClick}
					disabled={boostLoading}
					class="text-xs text-link transition-colors hover:text-hover disabled:opacity-50"
				>
					{boostLoading ? $_('boost.boosting') : $_('boost.extend')}
				</button>
			</div>
		{:else}
			<div class="flex items-center gap-2 py-2.5">
				<button
					title={$_('boost.title')}
					on:click={onBoostClick}
					disabled={boostLoading}
					class="flex items-center gap-1.5 text-xs text-link transition-colors hover:text-hover disabled:opacity-50"
				>
					<Icon w="16" h="16" icon="arrow_circle_up" type="material" />
					<span>{boostLoading ? $_('boost.boosting') : $_('boost.boostAction')}</span>
				</button>
			</div>
		{/if}
	</div>

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
				{#each [...comments].reverse() as comment (comment.id)}
					<MerchantComment text={comment.text} time={comment.created_at} compact={true} />
				{/each}
			</div>
		</div>
	{/if}

	<div class="pt-2 text-center">
		<a
			href={resolve(`/merchant/${merchant.id}`)}
			on:click={() => trackEvent('merchant_profile_click')}
			class="inline-flex items-center gap-1 text-sm text-link transition-colors hover:text-hover"
		>
			{$_('merchant.seeFullProfile')}
			<Icon w="14" h="14" icon="arrow_forward" type="material" />
		</a>
	</div>
</div>

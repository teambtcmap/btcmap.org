<script lang="ts">
	import { BoostButton, Icon } from '$lib/comp';
	import { calcVerifiedDate } from '$lib/map/setup';
	import type { Place } from '$lib/types';
	import { isBoosted, formatOpeningHours, fetchEnhancedPlace } from '$lib/utils';
	import Time from 'svelte-time';
	import tippy from 'tippy.js';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';

	export let merchant: Place;

	// Enhanced merchant data (fetched on-demand if basic data is missing)
	let enhancedMerchant: Place | null = null;
	let isEnhancing = false;

	// Check if we need to fetch enhanced data
	$: needsEnhancement = !merchant.name || !merchant.address;

	// Fetch enhanced data when needed
	async function enhanceMerchantData() {
		if (!needsEnhancement || isEnhancing) return;

		isEnhancing = true;
		try {
			const enhanced = await fetchEnhancedPlace(merchant.id.toString());
			if (enhanced) {
				enhancedMerchant = enhanced;
			}
		} catch (error) {
			console.error('Failed to enhance merchant data:', error);
		} finally {
			isEnhancing = false;
		}
	}

	// Auto-enhance on mount if needed
	onMount(() => {
		if (needsEnhancement) {
			enhanceMerchantData();
		}
	});

	// Use enhanced data if available, otherwise fall back to original
	$: displayMerchant = enhancedMerchant || merchant;

	const boosted = isBoosted(displayMerchant);
	const icon = displayMerchant.icon;
	const address = displayMerchant.address;
	const website = displayMerchant.website;
	const openingHours = displayMerchant.opening_hours;
	const phone = displayMerchant.phone;
	const email = displayMerchant.email;
	const twitter = displayMerchant.twitter;
	const instagram = displayMerchant.instagram;
	const facebook = displayMerchant.facebook;
	const verified = displayMerchant.verified_at ? [displayMerchant.verified_at] : [];
	const verifiedDate = calcVerifiedDate();

	let outdatedTooltip: HTMLDivElement;

	$: outdatedTooltip &&
		tippy([outdatedTooltip], {
			content: 'Outdated please re-verify'
		});
</script>

<div
	class="flex flex-col justify-between rounded-2xl border bg-white/50 p-4 text-left transition-shadow hover:shadow-lg dark:bg-white/5 sm:p-6 {boosted
		? 'border-bitcoin'
		: 'border-statBorder'}"
>
	<div>
		<div class="mb-3 flex w-full flex-col items-center justify-between gap-2 sm:flex-row">
			<a
				href={resolve(`/merchant/${merchant.id}`)}
				class="inline-flex w-full flex-col items-center gap-2 font-bold transition-colors sm:w-auto sm:flex-row {boosted
					? 'text-bitcoin hover:text-bitcoinHover'
					: 'text-link hover:text-hover'}"
			>
				<Icon
					w="24"
					h="24"
					icon={icon !== 'question_mark' ? icon : 'currency_bitcoin'}
					type="material"
					style="shrink-0"
				/>
				<p class="break-all text-lg">{displayMerchant.name || 'BTC Map Merchant'}</p>
			</a>

			<!-- Description/note tooltips not available in Place API -->
		</div>

		<div class="mb-3 w-full space-y-2 break-all text-primary dark:text-white">
			{#if address}
				<div class="flex items-center space-x-2 font-medium">
					<Icon w="16" h="16" icon="location_on" type="material" style="shrink-0" />
					<a
						href="geo:{merchant.lat},{merchant.lon}"
						class="text-sm underline decoration-primary decoration-1 underline-offset-4 dark:decoration-white"
					>
						{address}
					</a>
				</div>
			{/if}

			{#if website}
				<div class="flex items-center space-x-2">
					<Icon w="16" h="16" icon="globe" type="popup" style="shrink-0" />
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						href={website.startsWith('http') ? website : `https://${website}`}
						target="_blank"
						rel="noreferrer"
						class="text-sm underline decoration-primary decoration-1 underline-offset-4 dark:decoration-white"
					>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
						{website}
					</a>
				</div>
			{/if}

			{#if openingHours}
				<div class="flex items-center space-x-2">
					<Icon w="16" h="16" icon="clock" type="popup" style="shrink-0" />
					<div class="text-sm">
						<time class="flex flex-col items-start">
							<!-- eslint-disable-next-line svelte/no-at-html-tags - we sanitize the content in formatOpeningHours -->
							{@html formatOpeningHours(openingHours)}
						</time>
					</div>
				</div>
			{/if}

			{#if phone}
				<div class="flex items-center space-x-2">
					<Icon w="16" h="16" icon="phone" type="popup" style="shrink-0" />
					<a
						href="tel:{phone}"
						class="text-sm underline decoration-primary decoration-1 underline-offset-4 dark:decoration-white"
					>
						{phone}
					</a>
				</div>
			{/if}

			{#if email}
				<div class="flex items-center space-x-2">
					<Icon w="16" h="16" icon="email" type="popup" style="shrink-0" />
					<a
						href="mailto:{email}"
						class="text-sm underline decoration-primary decoration-1 underline-offset-4 dark:decoration-white"
					>
						{email}
					</a>
				</div>
			{/if}

			<div class="flex items-center space-x-2">
				{#if twitter}
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						href={twitter.startsWith('http') ? twitter : `https://twitter.com/${twitter}`}
						target="_blank"
						rel="noreferrer"
					>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->

						<Icon w="16" h="16" icon="twitter" type="popup" />
					</a>
				{/if}

				{#if instagram}
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						href={instagram.startsWith('http') ? instagram : `https://instagram.com/${instagram}`}
						target="_blank"
						rel="noreferrer"
					>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->

						<Icon w="16" h="16" icon="instagram" type="popup" />
					</a>
				{/if}

				{#if facebook}
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						href={facebook.startsWith('http') ? facebook : `https://facebook.com/${facebook}`}
						target="_blank"
						rel="noreferrer"
					>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->

						<Icon w="16" h="16" icon="facebook" type="popup" />
					</a>
				{/if}
			</div>
		</div>
	</div>

	<div class="w-full space-y-2 border-t border-gray-200 pt-3 dark:border-gray-200/25">
		{#if verified.length}
			<div class="flex items-center space-x-1">
				<p class="text-sm font-semibold text-gray-500 dark:text-gray-400">
					Last Surveyed: <span class="text-primary dark:text-white">{verified[0]}</span>
				</p>

				{#if !(Date.parse(verified[0]) > verifiedDate)}
					<div bind:this={outdatedTooltip} class="text-primary dark:text-white">
						<Icon w="16" h="16" icon="outdated" type="popup" style="shrink-0" />
					</div>
				{/if}
			</div>
		{:else}
			<div class="flex items-center space-x-1 text-gray-500 dark:text-gray-400">
				<Icon w="16" h="16" icon="sentiment_dissatisfied" type="material" style="shrink-0" />
				<p class="text-sm font-semibold">Not Verified</p>
			</div>
		{/if}

		{#if boosted}
			<div class="flex items-center space-x-1">
				<p class="text-sm font-semibold text-gray-500 dark:text-gray-400">
					Boost Expires: <span class="text-primary dark:text-white"
						><Time live={3000} relative={true} timestamp={merchant.boosted_until} /></span
					>
				</p>
			</div>
		{/if}

		<div class="flex justify-between space-x-2 sm:justify-start">
			<a
				href={resolve(`/merchant/${merchant.id}`)}
				class="inline-flex items-center space-x-1 font-semibold text-link transition-colors hover:text-hover"
				title="Help improve the data for everyone"
			>
				<Icon w="16" h="16" icon="verified" type="popup" style="shrink-0" />
				<p class="text-sm">Verify</p>
			</a>

			<BoostButton {merchant} boosted={boosted ? merchant.boosted_until : undefined} style="link" />
		</div>
	</div>
</div>

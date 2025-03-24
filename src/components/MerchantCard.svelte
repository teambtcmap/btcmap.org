<script lang="ts">
	import { BoostButton, Icon, InfoTooltip } from '$lib/comp';
	import { calcVerifiedDate, checkAddress, verifiedArr } from '$lib/map/setup';
	import type { Element } from '$lib/types';
	import { isBoosted } from '$lib/utils';
	import Time from 'svelte-time';
	import tippy from 'tippy.js';

	export let merchant: Element;

	const boosted = isBoosted(merchant);
	const icon = merchant.tags['icon:android'];
	const { tags } = merchant.osm_json;
	const description = tags?.description;
	const note = tags?.note;
	const address = tags ? checkAddress(tags) : undefined;
	const website = tags?.website || tags?.['contact:website'];
	const openingHours = tags?.['opening_hours'];
	const phone = tags?.phone || tags?.['contact:phone'];
	const email = tags?.email || tags?.['contact:email'];
	const twitter = tags?.twitter || tags?.['contact:twitter'];
	const instagram = tags?.instagram || tags?.['contact:instagram'];
	const facebook = tags?.facebook || tags?.['contact:facebook'];
	const verified = verifiedArr(merchant.osm_json);
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
				href="/merchant/{merchant.id}"
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
				<p class="break-all text-lg">{merchant.osm_json.tags?.name || 'BTC Map Merchant'}</p>
			</a>

			{#if description || note}
				<InfoTooltip tooltip={description || note} />
			{/if}
		</div>

		<div class="mb-3 w-full space-y-2 break-all text-primary dark:text-white">
			{#if address}
				<div class="flex items-center space-x-2 font-medium">
					<Icon w="16" h="16" icon="location_on" type="material" style="shrink-0" />
					<a
						href="geo:{merchant.osm_json.lat},{merchant.osm_json.lon}"
						class="text-sm underline decoration-primary decoration-1 underline-offset-4 dark:decoration-white"
					>
						{address}
					</a>
				</div>
			{/if}

			{#if website}
				<div class="flex items-center space-x-2">
					<Icon w="16" h="16" icon="globe" type="popup" style="shrink-0" />
					<a
						href={website.startsWith('http') ? website : `https://${website}`}
						target="_blank"
						rel="noreferrer"
						class="text-sm underline decoration-primary decoration-1 underline-offset-4 dark:decoration-white"
					>
						{website}
					</a>
				</div>
			{/if}

			{#if openingHours}
				<div class="flex items-center space-x-2">
					<Icon w="16" h="16" icon="clock" type="popup" style="shrink-0" />
					<p class="text-sm">{openingHours}</p>
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
					<Icon w="16" h="16" icon="email-outline" type="popup" style="shrink-0" />
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
					<a
						href={twitter.startsWith('http') ? twitter : `https://twitter.com/${twitter}`}
						target="_blank"
						rel="noreferrer"
					>
						<Icon w="16" h="16" icon="twitter" type="popup" />
					</a>
				{/if}

				{#if instagram}
					<a
						href={instagram.startsWith('http') ? instagram : `https://instagram.com/${instagram}`}
						target="_blank"
						rel="noreferrer"
					>
						<Icon w="16" h="16" icon="instagram" type="popup" />
					</a>
				{/if}

				{#if facebook}
					<a
						href={facebook.startsWith('http') ? facebook : `https://facebook.com/${facebook}`}
						target="_blank"
						rel="noreferrer"
					>
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
						><Time live={3000} relative={true} timestamp={merchant.tags['boost:expires']} /></span
					>
				</p>
			</div>
		{/if}

		<div class="flex justify-between space-x-2 sm:justify-start">
			<a
				href="/verify-location?id={merchant.id}"
				class="inline-flex items-center space-x-1 font-semibold text-link transition-colors hover:text-hover"
				title="Help improve the data for everyone"
			>
				<Icon w="16" h="16" icon="verified" type="popup" style="shrink-0" />
				<p class="text-sm">Verify</p>
			</a>

			<BoostButton
				{merchant}
				boosted={boosted ? merchant.tags['boost:expires'] : undefined}
				style="link"
			/>
		</div>
	</div>
</div>

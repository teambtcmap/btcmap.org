<script lang="ts">
	import { Icon } from '$lib/comp';
	import { formatVerifiedHuman, detectTheme } from '$lib/utils';
	import Time from 'svelte-time';
	import type { Place } from '$lib/types';

	export let merchant: Place;
	export let isUpToDate: boolean;
	export let isBoosted: boolean;
	export let boostLoading: boolean;
	export let onBoostClick: () => void;

	const getTheme = detectTheme;
</script>

<div class="space-y-4">
	{#if merchant.name}
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<a
			href="/merchant/{merchant.id}"
			class="inline-block text-xl leading-snug font-bold text-link transition-colors hover:text-hover"
			title="Merchant name"
		>
			{merchant.name}
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{/if}

	{#if merchant.address}
		<p class="text-body dark:text-white" title="Address">
			{merchant.address}
		</p>
	{/if}

	{#if merchant.opening_hours}
		<div class="flex items-start space-x-2" title="Opening hours">
			<Icon w="16" h="16" style="mt-1 text-primary dark:text-white" icon="clock" type="popup" />
			<span class="text-body dark:text-white">{merchant.opening_hours}</span>
		</div>
	{/if}

	<div class="grid grid-cols-2 gap-2">
		<a
			href="geo:{merchant.lat},{merchant.lon}"
			class="flex flex-col items-center rounded-lg border border-gray-300 py-3 text-primary transition-colors hover:border-link hover:text-link dark:border-white/95 dark:text-white dark:hover:text-link"
		>
			<Icon w="24" h="24" icon="compass" type="popup" />
			<span class="mt-1 text-xs">Navigate</span>
		</a>

		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<a
			href={merchant.osm_url || `https://www.openstreetmap.org/node/${merchant.id}`}
			target="_blank"
			rel="noreferrer"
			class="flex flex-col items-center rounded-lg border border-gray-300 py-3 text-primary transition-colors hover:border-link hover:text-link dark:border-white/95 dark:text-white dark:hover:text-link"
		>
			<Icon w="24" h="24" icon="pencil" type="popup" />
			<span class="mt-1 text-xs">Edit</span>
		</a>

		<a
			href="/merchant/{merchant.id}"
			class="flex flex-col items-center rounded-lg border border-gray-300 py-3 text-primary transition-colors hover:border-link hover:text-link dark:border-white/95 dark:text-white dark:hover:text-link"
		>
			<Icon w="24" h="24" icon="share" type="popup" />
			<span class="mt-1 text-xs">Share</span>
		</a>

		<a
			href="/merchant/{merchant.id}#comments"
			class="flex flex-col items-center rounded-lg border border-gray-300 py-3 text-primary transition-colors hover:border-link hover:text-link dark:border-white/95 dark:text-white dark:hover:text-link"
		>
			<div class="text-lg font-bold">
				{merchant.comments || 0}
			</div>
			<span class="mt-1 text-xs">Comments</span>
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	</div>

	<div class="border-t border-gray-300 pt-4 dark:border-white/95">
		{#if merchant['osm:payment:onchain'] || merchant['osm:payment:lightning'] || merchant['osm:payment:lightning_contactless'] || merchant['osm:payment:bitcoin']}
			<div class="mb-4">
				<span class="text-mapLabel block text-xs dark:text-white/70">Payment Methods</span>
				<div class="mt-1 flex space-x-2">
					<img
						src={merchant['osm:payment:onchain'] === 'yes'
							? getTheme() === 'dark'
								? '/icons/btc-highlight-dark.svg'
								: '/icons/btc-highlight.svg'
							: merchant['osm:payment:onchain'] === 'no'
								? getTheme() === 'dark'
									? '/icons/btc-no-dark.svg'
									: '/icons/btc-no.svg'
								: getTheme() === 'dark'
									? '/icons/btc-dark.svg'
									: '/icons/btc.svg'}
						alt="bitcoin"
						class="h-6 w-6"
						title={merchant['osm:payment:onchain'] === 'yes'
							? 'On-chain accepted'
							: merchant['osm:payment:onchain'] === 'no'
								? 'On-chain not accepted'
								: 'On-chain unknown'}
					/>
					<img
						src={merchant['osm:payment:lightning'] === 'yes'
							? getTheme() === 'dark'
								? '/icons/ln-highlight-dark.svg'
								: '/icons/ln-highlight.svg'
							: merchant['osm:payment:lightning'] === 'no'
								? getTheme() === 'dark'
									? '/icons/ln-no-dark.svg'
									: '/icons/ln-no.svg'
								: getTheme() === 'dark'
									? '/icons/ln-dark.svg'
									: '/icons/ln.svg'}
						alt="lightning"
						class="h-6 w-6"
						title={merchant['osm:payment:lightning'] === 'yes'
							? 'Lightning accepted'
							: merchant['osm:payment:lightning'] === 'no'
								? 'Lightning not accepted'
								: 'Lightning unknown'}
					/>
					<img
						src={merchant['osm:payment:lightning_contactless'] === 'yes'
							? getTheme() === 'dark'
								? '/icons/nfc-highlight-dark.svg'
								: '/icons/nfc-highlight.svg'
							: merchant['osm:payment:lightning_contactless'] === 'no'
								? getTheme() === 'dark'
									? '/icons/nfc-no-dark.svg'
									: '/icons/nfc-no.svg'
								: getTheme() === 'dark'
									? '/icons/nfc-dark.svg'
									: '/icons/nfc.svg'}
						alt="nfc"
						class="h-6 w-6"
						title={merchant['osm:payment:lightning_contactless'] === 'yes'
							? 'Lightning Contactless accepted'
							: merchant['osm:payment:lightning_contactless'] === 'no'
								? 'Lightning contactless not accepted'
								: 'Lightning contactless unknown'}
					/>
				</div>
			</div>
		{/if}

		<div class="mb-4">
			<span
				class="text-mapLabel block text-xs dark:text-white/70"
				title="Completed by BTC Map community members">Last Surveyed</span
			>
			<span class="block text-body dark:text-white">
				{#if merchant.verified_at}
					{formatVerifiedHuman(merchant.verified_at)}
					{#if isUpToDate}
						<Icon w="16" h="16" style="inline text-primary dark:text-white" icon="verified" type="popup" />
					{:else}
						<Icon w="16" h="16" style="inline text-primary dark:text-white" icon="outdated" type="popup" />
					{/if}
				{:else}
					<span title="Not verified">---</span>
				{/if}
			</span>
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				href="/verify-location?id={merchant.id}"
				class="text-xs text-link transition-colors hover:text-hover"
				title="Help improve the data for everyone"
			>
				Verify Location
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</div>

		<div>
			{#if isBoosted && merchant.boosted_until}
				<span class="text-mapLabel block text-xs dark:text-white/70" title="This location is boosted!"
					>Boost Expires</span
				>
				<span class="block text-body dark:text-white">
					<Time live={3000} relative={true} timestamp={merchant.boosted_until} />
				</span>
			{/if}

			<button
				title={isBoosted ? 'Extend Boost' : 'Boost'}
				on:click={onBoostClick}
				disabled={boostLoading}
				class="mt-2 flex h-[32px] items-center justify-center space-x-2 rounded-lg border border-gray-300 px-3 text-primary transition-colors hover:border-link hover:text-link dark:border-white/95 dark:text-white dark:hover:text-link"
			>
				{#if !boostLoading}
					<Icon w="16" h="16" icon={isBoosted ? 'boost-solid' : 'boost'} type="popup" />
				{/if}
				<span class="text-xs">{boostLoading ? 'Boosting...' : isBoosted ? 'Extend' : 'Boost'}</span
				>
			</button>
		</div>
	</div>

	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<a
		href="/merchant/{merchant.id}"
		class="mt-4 block rounded-lg bg-link py-3 text-center text-white transition-colors hover:bg-hover"
	>
		View Full Details
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
</div>

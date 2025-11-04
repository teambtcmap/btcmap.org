<script lang="ts">
	import { browser } from '$app/environment';
	import { places, boost, exchangeRate, resetBoost } from '$lib/store';
	import { CloseButton, Icon } from '$lib/comp';
	import { fly } from 'svelte/transition';
	import { formatVerifiedHuman, detectTheme } from '$lib/utils';
	import Time from 'svelte-time';
	import axios from 'axios';
	import { errToast } from '$lib/utils';
	import BoostContent from './drawer/BoostContent.svelte';
	import TagsContent from './drawer/TagsContent.svelte';
	import IssuesContent from './drawer/IssuesContent.svelte';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { Place } from '$lib/types';
	import { PLACE_FIELD_SETS, buildFieldsParam } from '$lib/api-fields';

	let merchantId: number | null = null;
	let drawerView: 'details' | 'boost' | 'tags' | 'issues' = 'details';
	let isOpen = false;
	let merchant: Place | null = null;
	let fetchingMerchant = false;
	let lastFetchedId: number | null = null;

	$: currentTheme = detectTheme();

	// Fetch merchant from API if not in store
	async function fetchMerchantDetails(id: number) {
		if (fetchingMerchant || lastFetchedId === id) return;

		lastFetchedId = id;
		fetchingMerchant = true;
		merchant = null; // Clear old data to show loading state

		try {
			const response = await axios.get(
				`https://api.btcmap.org/v4/places/${id}?fields=${buildFieldsParam(PLACE_FIELD_SETS.COMPLETE_PLACE)}`
			);
			if (merchantId === id) {
				// eslint-disable-next-line svelte/infinite-reactive-loop
				merchant = response.data;
			}
		} catch (error) {
			console.error('Error fetching merchant details:', error);
			errToast('Error loading merchant details. Please try again.');
		} finally {
			fetchingMerchant = false;
		}
	}

	// Watch for merchant ID changes and load data
	$: if (merchantId && isOpen) {
		const foundInStore = $places.find((p) => p.id === merchantId);

		// Only use store data if it has complete fields (name, address, etc.)
		// Store may have basic data (MAP_SYNC) but drawer needs COMPLETE_PLACE
		if (foundInStore && foundInStore.name !== undefined && merchant?.id !== foundInStore.id) {
			// Found complete data in store, use it
			merchant = foundInStore;
			lastFetchedId = merchantId;
		} else if (lastFetchedId !== merchantId) {
			// Not in store or incomplete data, or different merchant, fetch from API
			// Safe: lastFetchedId prevents infinite loop
			// eslint-disable-next-line svelte/infinite-reactive-loop
			fetchMerchantDetails(merchantId);
		}
	}

	// Parse hash to get drawer state
	function parseHash() {
		if (!browser) return;

		const hash = window.location.hash.substring(1); // Remove leading #

		// Check if there are parameters after the map coordinates
		const ampIndex = hash.indexOf('&');

		if (ampIndex !== -1) {
			// Has drawer params
			const params = new URLSearchParams(hash.substring(ampIndex + 1));
			const merchantParam = params.get('merchant');
			const viewParam = params.get('view') as typeof drawerView | null;

			merchantId = merchantParam ? Number(merchantParam) : null;
			drawerView = viewParam || 'details';
			isOpen = Boolean(merchantId);
		} else {
			// No drawer params
			merchantId = null;
			drawerView = 'details';
			isOpen = false;
		}
	}

	// Update hash with drawer state
	function updateHash(newMerchantId: number | null, newView: typeof drawerView = 'details') {
		if (!browser) return;

		const hash = window.location.hash.substring(1); // Remove leading #
		const ampIndex = hash.indexOf('&');
		const mapPart = ampIndex !== -1 ? hash.substring(0, ampIndex) : hash; // Keep map position

		if (newMerchantId) {
			const params = new URLSearchParams();
			params.set('merchant', String(newMerchantId));
			if (newView !== 'details') {
				params.set('view', newView);
			}

			// If there's a map part, join with &, otherwise just use params
			if (mapPart) {
				window.location.hash = `${mapPart}&${params.toString()}`;
			} else {
				window.location.hash = params.toString();
			}
		} else {
			window.location.hash = mapPart || '';
		}
	}

	// Calculate verification status
	const calcVerifiedDate = () => {
		const verifiedDate = new Date();
		const previousYear = verifiedDate.getFullYear() - 1;
		return verifiedDate.setFullYear(previousYear);
	};

	const verifiedDate = calcVerifiedDate();
	$: isUpToDate = merchant?.verified_at && Date.parse(merchant.verified_at) > verifiedDate;
	$: isBoosted = merchant?.boosted_until && Date.parse(merchant.boosted_until) > Date.now();

	let boostLoading = false;

	const closeDrawer = () => {
		// Reset all state when closing
		$boost = undefined;
		$exchangeRate = undefined;
		boostLoading = false;
		updateHash(null);
	};

	const goBack = () => {
		// Always reset boost state when going back
		// (safe to reset even if not in boost view)
		$boost = undefined;
		$exchangeRate = undefined;
		boostLoading = false;

		if (merchantId) {
			updateHash(merchantId, 'details');
		}
	};

	// Watch for view changes and reset boost state if leaving boost view
	$: if (drawerView !== 'boost' && $boost !== undefined) {
		$boost = undefined;
		$exchangeRate = undefined;
		boostLoading = false;
	}

	const handleBoost = async () => {
		if (!merchant) return;

		boostLoading = true;

		boost.set({
			id: merchant.id,
			name: merchant.name || '',
			boost: isBoosted ? merchant.boosted_until || '' : ''
		});

		try {
			const response = await axios.get('https://blockchain.info/ticker');
			exchangeRate.set(response.data['USD']['15m']);
			updateHash(merchantId, 'boost');
			boostLoading = false;
		} catch (error) {
			console.error('Error fetching exchange rate:', error);
			boost.set(undefined);
			boostLoading = false;
			errToast('Could not fetch bitcoin exchange rate, please try again or contact BTC Map.');
		}
	};

	const handleBoostComplete = async () => {
		await invalidateAll();
		$boost = undefined;
		$exchangeRate = undefined;
		$resetBoost = $resetBoost + 1;

		if (merchantId) {
			updateHash(merchantId, 'details');
		}
	};

	const showTags = () => {
		if (merchantId) {
			updateHash(merchantId, 'tags');
		}
	};

	const showIssues = () => {
		if (merchantId) {
			updateHash(merchantId, 'issues');
		}
	};

	// Listen for escape key globally when drawer is open
	function handleKeydown(event: KeyboardEvent) {
		if (!isOpen) return;

		if (event.key === 'Escape') {
			event.preventDefault();
			if (drawerView !== 'details') {
				goBack();
			} else {
				closeDrawer();
			}
		}
	}

	// Listen for hash changes (back/forward navigation)
	onMount(() => {
		parseHash();
		window.addEventListener('hashchange', parseHash);
		window.addEventListener('keydown', handleKeydown);
		return () => {
			window.removeEventListener('hashchange', parseHash);
			window.removeEventListener('keydown', handleKeydown);
		};
	});

	// Fetch exchange rate when boost view is active and rate is not set
	$: if (drawerView === 'boost' && !$exchangeRate && merchant) {
		// Set boost store if not already set
		if (!$boost) {
			boost.set({
				id: merchant.id,
				name: merchant.name || '',
				boost: isBoosted ? merchant.boosted_until || '' : ''
			});
		}

		// Fetch exchange rate
		axios
			.get('https://blockchain.info/ticker')
			.then((response) => {
				exchangeRate.set(response.data['USD']['15m']);
			})
			.catch((error) => {
				console.error('Error fetching exchange rate:', error);
				errToast('Could not fetch bitcoin exchange rate, please try again or contact BTC Map.');
			});
	}

	// Export function to open drawer from outside
	export function openDrawer(id: number) {
		updateHash(id, 'details');
	}
</script>

{#if isOpen}
	<!-- Drawer - no backdrop, keep map interactive -->
	<div
		transition:fly={{ x: -400, duration: 300 }}
		class="fixed top-0 left-0 z-[1002] h-full w-[85vw] overflow-y-auto bg-white shadow-2xl md:w-[400px] dark:bg-dark"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="sticky top-0 z-10 flex items-center justify-between border-b border-gray-300 bg-white p-4 dark:border-white/95 dark:bg-dark"
		>
			{#if drawerView !== 'details'}
				<!-- Back button for nested views -->
				<button
					on:click={goBack}
					class="flex items-center space-x-2 text-primary transition-colors hover:text-link dark:text-white dark:hover:text-link"
				>
					<Icon w="20" h="20" icon="arrow_back" type="material" />
					<span class="text-sm font-semibold">Back</span>
				</button>
				<span class="text-sm font-semibold text-primary capitalize dark:text-white"
					>{drawerView}</span
				>
			{:else}
				<span class="text-sm font-semibold text-primary dark:text-white">Merchant Details</span>
			{/if}
			<CloseButton on:click={closeDrawer} />
		</div>

		{#if !merchant && fetchingMerchant}
			<!-- Loading skeleton -->
			<div class="space-y-4 p-6">
				<!-- Title skeleton -->
				<div class="h-7 w-3/4 animate-pulse rounded-lg bg-link/50"></div>
				<!-- Address skeleton -->
				<div class="h-5 w-1/2 animate-pulse rounded bg-link/50"></div>
				<!-- Payment methods skeleton -->
				<div class="flex space-x-2">
					<div class="h-8 w-16 animate-pulse rounded bg-link/50"></div>
					<div class="h-8 w-16 animate-pulse rounded bg-link/50"></div>
					<div class="h-8 w-16 animate-pulse rounded bg-link/50"></div>
				</div>
				<!-- Stats grid skeleton -->
				<div class="grid grid-cols-2 gap-2">
					<div class="h-20 animate-pulse rounded-lg bg-link/50"></div>
					<div class="h-20 animate-pulse rounded-lg bg-link/50"></div>
				</div>
				<!-- Large content skeleton -->
				<div class="h-32 animate-pulse rounded-lg bg-link/50"></div>
			</div>
		{:else if merchant}
			<!-- Merchant content -->
			<div class="p-6">
				{#if drawerView === 'boost'}
					<BoostContent merchantId={merchant.id} onComplete={handleBoostComplete} />
				{:else if drawerView === 'tags'}
					<div class="space-y-4">
						<h2 class="text-xl font-bold text-primary dark:text-white">All OSM Tags</h2>
						<TagsContent tags={merchant.tags || {}} />
					</div>
				{:else if drawerView === 'issues'}
					<div class="space-y-4">
						<h2 class="text-xl font-bold text-primary dark:text-white">Tagging Issues</h2>
						<IssuesContent issues={merchant.tags?.issues || []} />
					</div>
				{:else}
					<!-- Merchant Details -->
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
								<Icon
									w="16"
									h="16"
									style="mt-1 text-primary dark:text-white"
									icon="clock"
									type="popup"
								/>
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
									<span class="block text-xs text-mapLabel dark:text-white/70">Payment Methods</span>
									<div class="mt-1 flex space-x-2">
										<img
											src={merchant['osm:payment:onchain'] === 'yes'
												? currentTheme === 'dark'
													? '/icons/btc-highlight-dark.svg'
													: '/icons/btc-highlight.svg'
												: merchant['osm:payment:onchain'] === 'no'
													? currentTheme === 'dark'
														? '/icons/btc-no-dark.svg'
														: '/icons/btc-no.svg'
													: currentTheme === 'dark'
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
												? currentTheme === 'dark'
													? '/icons/ln-highlight-dark.svg'
													: '/icons/ln-highlight.svg'
												: merchant['osm:payment:lightning'] === 'no'
													? currentTheme === 'dark'
														? '/icons/ln-no-dark.svg'
														: '/icons/ln-no.svg'
													: currentTheme === 'dark'
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
												? currentTheme === 'dark'
													? '/icons/nfc-highlight-dark.svg'
													: '/icons/nfc-highlight.svg'
												: merchant['osm:payment:lightning_contactless'] === 'no'
													? currentTheme === 'dark'
														? '/icons/nfc-no-dark.svg'
														: '/icons/nfc-no.svg'
													: currentTheme === 'dark'
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
									class="block text-xs text-mapLabel dark:text-white/70"
									title="Completed by BTC Map community members">Last Surveyed</span
								>
								<span class="block text-body dark:text-white">
									{#if merchant.verified_at}
										{formatVerifiedHuman(merchant.verified_at)}
										{#if isUpToDate}
											<Icon
												w="16"
												h="16"
												style="inline text-primary dark:text-white"
												icon="verified"
												type="popup"
											/>
										{:else}
											<Icon
												w="16"
												h="16"
												style="inline text-primary dark:text-white"
												icon="outdated"
												type="popup"
											/>
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
									<span class="block text-xs text-mapLabel dark:text-white/70" title="This location is boosted!"
										>Boost Expires</span
									>
									<span class="block text-body dark:text-white">
										<Time live={3000} relative={true} timestamp={merchant.boosted_until} />
									</span>
								{/if}

								<button
									title={isBoosted ? 'Extend Boost' : 'Boost'}
									on:click={handleBoost}
									disabled={boostLoading}
									class="mt-2 flex h-[32px] items-center justify-center space-x-2 rounded-lg border border-gray-300 px-3 text-primary transition-colors hover:border-link hover:text-link dark:border-white/95 dark:text-white dark:hover:text-link"
								>
									{#if !boostLoading}
										<Icon w="16" h="16" icon={isBoosted ? 'boost-solid' : 'boost'} type="popup" />
									{/if}
									<span class="text-xs"
										>{boostLoading ? 'Boosting...' : isBoosted ? 'Extend' : 'Boost'}</span
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
				{/if}
			</div>
		{/if}
	</div>
{/if}

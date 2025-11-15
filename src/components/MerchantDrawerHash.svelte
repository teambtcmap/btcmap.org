<script lang="ts">
	import { browser } from '$app/environment';
	import { places, boost, exchangeRate, resetBoost } from '$lib/store';
	import CloseButton from '$lib/components/CloseButton.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { fly } from 'svelte/transition';
	import axios from 'axios';
	import { errToast, fetchExchangeRate } from '$lib/utils';
	import BoostContent from './BoostContent.svelte';
	import MerchantDetailsContent from './MerchantDetailsContent.svelte';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { Place } from '$lib/types';
	import { PLACE_FIELD_SETS, buildFieldsParam } from '$lib/api-fields';

	let merchantId: number | null = null;
	let drawerView: 'details' | 'boost' = 'details';
	let isOpen = false;
	let merchant: Place | null = null;
	let fetchingMerchant = false;
	let lastFetchedId: number | null = null;

	async function fetchMerchantDetails(id: number) {
		if (fetchingMerchant || lastFetchedId === id) return;

		lastFetchedId = id;
		fetchingMerchant = true;
		merchant = null;

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

	$: if (merchantId && isOpen) {
		const foundInStore = $places.find((p) => p.id === merchantId);

		const hasCompleteData = (place: Place | undefined): place is Place => {
			if (!place) return false;
			return (
				place.name !== undefined && place.address !== undefined && place.verified_at !== undefined
			);
		};

		if (hasCompleteData(foundInStore) && merchant?.id !== foundInStore.id) {
			merchant = foundInStore;
			lastFetchedId = merchantId;
		} else if (lastFetchedId !== merchantId) {
			// eslint-disable-next-line svelte/infinite-reactive-loop
			fetchMerchantDetails(merchantId);
		}
	}

	function parseHash() {
		if (!browser) return;

		const hash = window.location.hash.substring(1);

		const ampIndex = hash.indexOf('&');

		if (ampIndex !== -1) {
			const params = new URLSearchParams(hash.substring(ampIndex + 1));
			const merchantParam = params.get('merchant');
			const viewParam = params.get('view') as typeof drawerView | null;

			merchantId = merchantParam ? Number(merchantParam) : null;
			drawerView = viewParam || 'details';
			isOpen = Boolean(merchantId);
		} else {
			merchantId = null;
			drawerView = 'details';
			isOpen = false;
		}
	}

	function updateHash(newMerchantId: number | null, newView: typeof drawerView = 'details') {
		if (!browser) return;

		const hash = window.location.hash.substring(1);
		const ampIndex = hash.indexOf('&');
		const mapPart = ampIndex !== -1 ? hash.substring(0, ampIndex) : hash;

		if (newMerchantId) {
			const params = new URLSearchParams();
			params.set('merchant', String(newMerchantId));
			if (newView !== 'details') {
				params.set('view', newView);
			}

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
	$: isUpToDate = !!(merchant?.verified_at && Date.parse(merchant.verified_at) > verifiedDate);
	$: isBoosted = !!(merchant?.boosted_until && Date.parse(merchant.boosted_until) > Date.now());

	let boostLoading = false;

	const closeDrawer = () => {
		$boost = undefined;
		$exchangeRate = undefined;
		boostLoading = false;
		updateHash(null);
	};

	const goBack = () => {
		$boost = undefined;
		$exchangeRate = undefined;
		boostLoading = false;

		if (merchantId) {
			updateHash(merchantId, 'details');
		}
	};

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
			const rate = await fetchExchangeRate();
			exchangeRate.set(rate);
			updateHash(merchantId, 'boost');
			boostLoading = false;
		} catch {
			boost.set(undefined);
			boostLoading = false;
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

	onMount(() => {
		parseHash();
		window.addEventListener('hashchange', parseHash);
		window.addEventListener('keydown', handleKeydown);
		return () => {
			window.removeEventListener('hashchange', parseHash);
			window.removeEventListener('keydown', handleKeydown);
		};
	});

	$: if (drawerView === 'boost' && !$exchangeRate && merchant) {
		if (!$boost) {
			boost.set({
				id: merchant.id,
				name: merchant.name || '',
				boost: isBoosted ? merchant.boosted_until || '' : ''
			});
		}

		fetchExchangeRate()
			.then((rate) => {
				exchangeRate.set(rate);
			})
			.catch(() => {
				// Error already handled by fetchExchangeRate
			});
	}

	export function openDrawer(id: number) {
		updateHash(id, 'details');
	}
</script>

{#if isOpen}
	<!-- Drawer - no backdrop, keep map interactive -->
	<div
		transition:fly={{ x: -400, duration: 300 }}
		class="fixed top-0 left-0 z-[1002] h-full w-full overflow-y-auto bg-white shadow-2xl md:w-[400px] dark:bg-dark"
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
			<div class="p-6">
				{#if drawerView === 'boost'}
					<BoostContent merchantId={merchant.id} onComplete={handleBoostComplete} />
				{:else}
					<MerchantDetailsContent
						{merchant}
						{isUpToDate}
						{isBoosted}
						{boostLoading}
						onBoostClick={handleBoost}
					/>
				{/if}
			</div>
		{/if}
	</div>
{/if}

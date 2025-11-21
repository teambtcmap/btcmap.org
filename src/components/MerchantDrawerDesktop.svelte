<script lang="ts">
	import { places, boost, exchangeRate, resetBoost } from '$lib/store';
	import CloseButton from '$components/CloseButton.svelte';
	import Icon from '$components/Icon.svelte';
	import { fly } from 'svelte/transition';
	import BoostContent from './BoostContent.svelte';
	import MerchantDetailsContent from './MerchantDetailsContent.svelte';
	import { invalidateAll } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import type { Place } from '$lib/types';
	import { parseMerchantHash, updateMerchantHash, type DrawerView } from '$lib/merchantDrawerHash';
	import { debounce } from '$lib/utils';
	import {
		calcVerifiedDate,
		isUpToDate as checkUpToDate,
		isBoosted as checkBoosted,
		handleBoost as boostMerchant,
		handleBoostComplete as completeBoost,
		handleCloseDrawer as closeDrawerUtil,
		handleGoBack as goBackUtil,
		ensureBoostData,
		fetchMerchantDetails as fetchMerchant,
		hasCompleteData,
		clearBoostState
	} from '$lib/merchantDrawerLogic';

	let merchantId: number | null = null;
	let drawerView: DrawerView = 'details';
	let isOpen = false;
	let merchant: Place | null = null;
	let fetchingMerchant = false;
	let lastFetchedId: number | null = null;
	let abortController: AbortController | null = null;

	// Settling guard to prevent rapid state transitions
	let isSettling = false;
	let settlingTimeout: ReturnType<typeof setTimeout> | null = null;

	function setSettling(duration = 150) {
		isSettling = true;
		if (settlingTimeout) clearTimeout(settlingTimeout);
		settlingTimeout = setTimeout(() => {
			isSettling = false;
		}, duration);
	}

	async function fetchMerchantDetails(id: number) {
		if (fetchingMerchant || lastFetchedId === id) return;

		// Cancel previous request if still pending
		if (abortController) {
			abortController.abort();
		}

		// Create new abort controller for this request
		abortController = new AbortController();

		await fetchMerchant(
			id,
			merchantId,
			(m) => {
				merchant = m;
			},
			(f) => {
				fetchingMerchant = f;
			},
			(id) => {
				lastFetchedId = id;
			},
			abortController.signal
		);
	}

	onDestroy(() => {
		// Cancel any pending requests when component unmounts
		if (abortController) {
			abortController.abort();
		}
		// Clean up settling timeout
		if (settlingTimeout) {
			clearTimeout(settlingTimeout);
		}
		// Cancel pending debounced calls
		if (parseHash?.cancel) {
			parseHash.cancel();
		}
	});

	$: if (merchantId && isOpen) {
		const foundInStore = $places.find((p) => p.id === merchantId);

		if (hasCompleteData(foundInStore) && merchant?.id !== foundInStore.id) {
			merchant = foundInStore;
			lastFetchedId = merchantId;
		} else if (lastFetchedId !== merchantId) {
			fetchMerchantDetails(merchantId);
		}
	}

	function parseHashImmediate() {
		// Skip if we're in the middle of a transition
		if (isSettling) return;

		const state = parseMerchantHash();
		const wasOpen = isOpen;
		const previousMerchantId = merchantId;

		merchantId = state.merchantId;
		drawerView = state.drawerView;
		isOpen = state.isOpen;

		// Set settling guard on state change to prevent rapid transitions
		if (wasOpen !== isOpen || previousMerchantId !== merchantId) {
			setSettling();
		}

		// Cancel pending API request when drawer closes
		if (wasOpen && !isOpen && abortController) {
			abortController.abort();
			abortController = null;
		}
	}

	// Debounced version to prevent rapid hash changes from overwhelming the UI
	const parseHash = debounce(parseHashImmediate, 50);

	const verifiedDate = calcVerifiedDate();
	$: isUpToDate = checkUpToDate(merchant, verifiedDate);
	$: isBoosted = checkBoosted(merchant);

	let boostLoading = false;
	const setBoostLoading = (loading: boolean) => {
		boostLoading = loading;
	};

	const closeDrawer = () => closeDrawerUtil(setBoostLoading);
	const goBack = () => goBackUtil(merchantId, setBoostLoading);

	$: if (drawerView !== 'boost' && $boost !== undefined) {
		clearBoostState();
		boostLoading = false;
	}

	const handleBoost = () => boostMerchant(merchant, merchantId, setBoostLoading);
	const handleBoostComplete = () => completeBoost(merchantId, invalidateAll, resetBoost);

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
		// Use immediate version for initial load, debounced for subsequent changes
		parseHashImmediate();
		window.addEventListener('hashchange', parseHash);
		window.addEventListener('keydown', handleKeydown);
		return () => {
			window.removeEventListener('hashchange', parseHash);
			window.removeEventListener('keydown', handleKeydown);
		};
	});

	$: if (drawerView === 'boost' && merchant) {
		ensureBoostData(merchant, $exchangeRate, $boost);
	}

	export function openDrawer(id: number) {
		updateMerchantHash(id, 'details');
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

<script lang="ts">
	import { browser } from '$app/environment';
	import { pan } from 'svelte-gestures';
	import { spring } from 'svelte/motion';
	import { places, boost, exchangeRate } from '$lib/store';
	import CloseButton from '$components/CloseButton.svelte';
	import Icon from '$components/Icon.svelte';
	import axios from 'axios';
	import { errToast, fetchExchangeRate } from '$lib/utils';
	import BoostContent from './BoostContent.svelte';
	import MerchantDetailsContent from './MerchantDetailsContent.svelte';
	import MerchantPeekContent from './MerchantPeekContent.svelte';
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

	// Bottom sheet heights
	const PEEK_HEIGHT = 200;
	let EXPANDED_HEIGHT = 500;
	let expanded = false;
	let drawerHeight = spring(PEEK_HEIGHT, { stiffness: 0.3, damping: 0.8 });
	let isDragging = false;

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

			// Reset to peek state when opening
			if (isOpen && !viewParam) {
				expanded = false;
				drawerHeight.set(PEEK_HEIGHT, { hard: true });
			}
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
		expanded = false;
		drawerHeight.set(PEEK_HEIGHT);
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

		// Calculate expanded height based on window size
		// Use 96% to leave small gap at top for status bar/notch
		if (browser) {
			EXPANDED_HEIGHT = window.innerHeight * 0.96;
		}

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
				// Error already handled
			});
	}

	// Gesture handlers for dragging
	let panStartY = 0;
	let initialHeight = PEEK_HEIGHT;

	function handlePanDown() {
		// Pan started - record initial state
		isDragging = false; // Will be set true on first pan
		initialHeight = $drawerHeight;
		panStartY = 0; // Will be set on first pan
	}

	function handlePan(event: CustomEvent) {
		const currentY = event.detail.y;

		if (!isDragging) {
			// First pan event, record start
			isDragging = true;
			panStartY = currentY;
			initialHeight = $drawerHeight;
			return;
		}

		// Calculate delta: INVERTED LOGIC
		// When dragging UP (y decreases), we want to EXPAND (increase height) - like Google Maps
		// When dragging DOWN (y increases), we want to COLLAPSE (decrease height)
		const deltaY = panStartY - currentY; // Positive when dragging UP
		const newHeight = Math.max(PEEK_HEIGHT, Math.min(EXPANDED_HEIGHT, initialHeight + deltaY));

		drawerHeight.set(newHeight, { hard: true });
	}

	function handlePanUp() {
		if (!isDragging) return;
		isDragging = false;

		// Snap based on final position and direction of movement
		const currentHeight = $drawerHeight;
		const totalDelta = currentHeight - initialHeight;

		// Determine snap based on how far we moved
		const SNAP_THRESHOLD = 30; // Lowered from 50px to 30px for easier triggering

		if (totalDelta > SNAP_THRESHOLD) {
			// Swiped up enough → EXPAND
			expanded = true;
			drawerHeight.set(EXPANDED_HEIGHT);
		} else if (totalDelta < -SNAP_THRESHOLD) {
			// Swiped down enough → COLLAPSE to peek
			expanded = false;
			drawerHeight.set(PEEK_HEIGHT);
		} else {
			// Small movement - stay in current state or snap to nearest
			const midPoint = (PEEK_HEIGHT + EXPANDED_HEIGHT) / 2;
			if (currentHeight > midPoint) {
				expanded = true;
				drawerHeight.set(EXPANDED_HEIGHT);
			} else {
				expanded = false;
				drawerHeight.set(PEEK_HEIGHT);
			}
		}
	}

	export function openDrawer(id: number) {
		updateHash(id, 'details');
	}
</script>

{#if isOpen}
	<!-- Backdrop - clickable to close drawer -->
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="fixed inset-0 z-[1001]"
		on:click={closeDrawer}
	></div>

	<!-- Bottom sheet drawer -->
	<div
		class="fixed right-0 bottom-0 left-0 z-[1002] flex flex-col rounded-t-[10px] bg-white shadow-2xl transition-shadow dark:bg-dark"
		style="height: {$drawerHeight}px;"
		use:pan={{ delay: 0, touchAction: 'none' }}
		on:pan={handlePan}
		on:pandown={handlePanDown}
		on:panup={handlePanUp}
		on:click|stopPropagation
		role="dialog"
		aria-modal="false"
	>
		<!-- Drag handle -->
		<div
			class="mx-auto mt-4 h-1.5 w-12 flex-shrink-0 rounded-full bg-gray-300 dark:bg-white/30"
		></div>

		<!-- Header - sticky at top -->
		<div
			class="flex flex-shrink-0 items-center justify-between border-b border-gray-300 bg-white px-4 py-3 dark:border-white/95 dark:bg-dark"
		>
			{#if drawerView !== 'details'}
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

		<!-- Scrollable content area -->
		<div class="min-h-0 flex-1 overflow-y-auto">
			{#if !merchant && fetchingMerchant}
				<!-- Loading skeleton -->
				<div class="space-y-4 p-4">
					<div class="h-6 w-3/4 animate-pulse rounded-lg bg-link/50"></div>
					<div class="h-4 w-1/2 animate-pulse rounded bg-link/50"></div>
					<div class="flex space-x-2">
						<div class="h-8 w-16 animate-pulse rounded bg-link/50"></div>
						<div class="h-8 w-16 animate-pulse rounded bg-link/50"></div>
					</div>
				</div>
			{:else if merchant}
				<!-- Show peek content when collapsed -->
				{#if !expanded}
					<div class="p-4">
						<MerchantPeekContent {merchant} {isUpToDate} {isBoosted} />
					</div>
				{:else}
					<!-- Show full content when expanded -->
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
			{/if}
		</div>
	</div>
{/if}

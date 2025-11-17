<script lang="ts">
	import { browser } from '$app/environment';
	import { pan } from 'svelte-gestures';
	import { spring } from 'svelte/motion';
	import { places, boost, exchangeRate } from '$lib/store';
	import Icon from '$components/Icon.svelte';
	import BoostContent from './BoostContent.svelte';
	import MerchantDetailsContent from './MerchantDetailsContent.svelte';
	import MerchantPeekContentMobile from './MerchantPeekContentMobile.svelte';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { Place } from '$lib/types';
	import { parseMerchantHash, updateMerchantHash, type DrawerView } from '$lib/merchantDrawerHash';
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
		hasCompleteData
	} from '$lib/merchantDrawerLogic';

	let merchantId: number | null = null;
	let drawerView: DrawerView = 'details';
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
			}
		);
	}

	$: if (merchantId && isOpen) {
		const foundInStore = $places.find((p) => p.id === merchantId);

		if (hasCompleteData(foundInStore) && merchant?.id !== foundInStore.id) {
			merchant = foundInStore;
			lastFetchedId = merchantId;
		} else if (lastFetchedId !== merchantId) {
			fetchMerchantDetails(merchantId);
		}
	}

	function parseHash() {
		const state = parseMerchantHash();
		const previousMerchantId = merchantId;

		merchantId = state.merchantId;
		drawerView = state.drawerView;
		isOpen = state.isOpen;

		// Only reset to peek state when initially opening a merchant (not when switching views)
		if (isOpen && state.drawerView === 'details' && previousMerchantId !== merchantId) {
			expanded = false;
			drawerHeight.set(PEEK_HEIGHT, { hard: true });
		}
	}

	const verifiedDate = calcVerifiedDate();
	$: isUpToDate = checkUpToDate(merchant, verifiedDate);
	$: isBoosted = checkBoosted(merchant);

	let boostLoading = false;
	const setBoostLoading = (loading: boolean) => {
		boostLoading = loading;
	};

	const closeDrawer = () =>
		closeDrawerUtil(setBoostLoading, () => {
			expanded = false;
			drawerHeight.set(PEEK_HEIGHT);
		});

	const goBack = () => goBackUtil(merchantId, setBoostLoading);

	$: if (drawerView !== 'boost' && $boost !== undefined) {
		boost.set(undefined);
		exchangeRate.set(undefined);
		boostLoading = false;
	}

	const handleBoost = () => boostMerchant(merchant, merchantId, setBoostLoading);
	const handleBoostComplete = () => completeBoost(merchantId, invalidateAll);

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
		// Use full screen height to match Google Maps behavior
		if (browser) {
			EXPANDED_HEIGHT = window.innerHeight;
		}

		return () => {
			window.removeEventListener('hashchange', parseHash);
			window.removeEventListener('keydown', handleKeydown);
		};
	});

	$: if (drawerView === 'boost' && merchant) {
		ensureBoostData(merchant, $exchangeRate, $boost);
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
		updateMerchantHash(id, 'details');
	}
</script>

{#if isOpen}
	<!-- Bottom sheet drawer: gestures for touch/mouse, keyboard uses ESC + Close button -->
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="fixed right-0 bottom-0 left-0 z-[1002] flex flex-col bg-white shadow-2xl transition-shadow dark:bg-dark"
		class:rounded-t-[10px]={!expanded}
		style="height: {$drawerHeight}px;"
		on:click|stopPropagation
		role="dialog"
		aria-modal="false"
		aria-label="Merchant details"
	>
		<!-- Drag handle and header area - draggable -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div
			class="flex-shrink-0"
			use:pan={{ delay: 0, touchAction: 'pan-y' }}
			on:pan={handlePan}
			on:pandown={handlePanDown}
			on:panup={handlePanUp}
		>
			<!-- Drag handle -->
			<div
				class="mx-auto mt-4 h-1.5 w-12 rounded-full bg-gray-300 dark:bg-white/30"
			></div>

			<!-- Header - sticky at top -->
			<div
				class="flex items-center justify-between border-b border-gray-300 bg-white px-4 py-3 dark:border-white/95 dark:bg-dark"
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

			<!-- Only show close/collapse button when expanded -->
			{#if expanded}
				<button
					on:click={() => {
						expanded = false;
						drawerHeight.set(PEEK_HEIGHT);
					}}
					class="rounded-full p-2 text-primary transition-colors hover:bg-gray-100 dark:text-white dark:hover:bg-white/10"
					aria-label="Collapse drawer"
				>
					<Icon w="20" h="20" icon="keyboard_arrow_down" type="material" />
				</button>
			{:else}
				<!-- Empty space to maintain layout when minimized -->
				<div class="w-9"></div>
			{/if}
			</div>
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
						<MerchantPeekContentMobile {merchant} {isUpToDate} {isBoosted} />
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

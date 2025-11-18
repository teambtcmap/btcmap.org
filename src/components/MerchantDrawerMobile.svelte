<script lang="ts">
	import { browser } from '$app/environment';
	import { spring } from 'svelte/motion';
	import { places, boost, exchangeRate } from '$lib/store';
	import Icon from '$components/Icon.svelte';
	import BoostContent from './BoostContent.svelte';
	import MerchantDetailsContent from './MerchantDetailsContent.svelte';
	import MerchantPeekContentMobile from './MerchantPeekContentMobile.svelte';
	import { invalidateAll } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
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
		hasCompleteData,
		clearBoostState
	} from '$lib/merchantDrawerLogic';

	// Gesture constants
	const PEEK_HEIGHT = 200;
	const VELOCITY_THRESHOLD = 0.5; // px/ms - fast flick detection
	const DISTANCE_THRESHOLD = 80; // px - significant drag
	const POSITION_THRESHOLD_PERCENT = 0.3; // 30% of travel for snap decision
	const VELOCITY_SAMPLE_COUNT = 5;
	const SPRING_CONFIG = { stiffness: 0.2, damping: 0.75 };

	// Helper function to determine snap state based on gesture
	function determineSnapState(
		velocity: number,
		totalDelta: number,
		finalHeight: number,
		EXPANDED_HEIGHT: number
	): { expanded: boolean; height: number } {
		// Snap decision based on velocity first, then distance
		if (Math.abs(velocity) > VELOCITY_THRESHOLD) {
			if (velocity > 0) {
				return { expanded: true, height: EXPANDED_HEIGHT };
			} else {
				return { expanded: false, height: PEEK_HEIGHT };
			}
		} else if (totalDelta > DISTANCE_THRESHOLD) {
			return { expanded: true, height: EXPANDED_HEIGHT };
		} else if (totalDelta < -DISTANCE_THRESHOLD) {
			return { expanded: false, height: PEEK_HEIGHT };
		} else {
			// Small movement - snap to nearest based on current position
			const threshold = PEEK_HEIGHT + (EXPANDED_HEIGHT - PEEK_HEIGHT) * POSITION_THRESHOLD_PERCENT;
			if (finalHeight > threshold) {
				return { expanded: true, height: EXPANDED_HEIGHT };
			} else {
				return { expanded: false, height: PEEK_HEIGHT };
			}
		}
	}

	// Component state
	let merchantId: number | null = null;
	let drawerView: DrawerView = 'details';
	let isOpen = false;
	let merchant: Place | null = null;
	let fetchingMerchant = false;
	let lastFetchedId: number | null = null;
	let abortController: AbortController | null = null;

	// Bottom sheet state
	let EXPANDED_HEIGHT = 500;
	let expanded = false;
	let drawerHeight = spring(PEEK_HEIGHT, SPRING_CONFIG);
	let isDragging = false;

	// Pointer tracking state
	let activePointerId: number | null = null;
	let startY = 0;
	let initialHeight = PEEK_HEIGHT;
	let lastY = 0;
	let lastTime = 0;
	let velocitySamples: number[] = [];
	let velocity = 0;

	// DOM reference
	let handleElement: HTMLDivElement;

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
			(fetchedId) => {
				lastFetchedId = fetchedId;
			},
			abortController.signal
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
		clearBoostState();
		boostLoading = false;
	}

	const handleBoost = () => boostMerchant(merchant, merchantId, setBoostLoading);
	const handleBoostComplete = () => completeBoost(merchantId, invalidateAll);

	function handleKeydown(event: KeyboardEvent) {
		if (!isOpen) return;

		switch (event.key) {
			case 'Escape':
				event.preventDefault();
				if (drawerView !== 'details') {
					goBack();
				} else if (expanded) {
					expanded = false;
					drawerHeight.set(PEEK_HEIGHT);
				} else {
					closeDrawer();
				}
				break;
			case 'ArrowUp':
				event.preventDefault();
				if (!expanded) {
					expanded = true;
					drawerHeight.set(EXPANDED_HEIGHT);
				}
				break;
			case 'ArrowDown':
				event.preventDefault();
				if (expanded) {
					expanded = false;
					drawerHeight.set(PEEK_HEIGHT);
				}
				break;
			case 'Enter':
			case ' ':
				// Only toggle if focus is on the handle element
				if (document.activeElement === handleElement) {
					event.preventDefault();
					if (expanded) {
						expanded = false;
						drawerHeight.set(PEEK_HEIGHT);
					} else {
						expanded = true;
						drawerHeight.set(EXPANDED_HEIGHT);
					}
				}
				break;
		}
	}

	onMount(() => {
		parseHash();
		window.addEventListener('hashchange', parseHash);
		window.addEventListener('keydown', handleKeydown);

		let updateHeight: (() => void) | null = null;

		if (browser) {
			updateHeight = () => {
				EXPANDED_HEIGHT = window.innerHeight;
				if (expanded) {
					drawerHeight.set(EXPANDED_HEIGHT);
				}
			};

			updateHeight();
			window.addEventListener('resize', updateHeight);
		}

		return () => {
			window.removeEventListener('hashchange', parseHash);
			window.removeEventListener('keydown', handleKeydown);
			if (updateHeight) {
				window.removeEventListener('resize', updateHeight);
			}
		};
	});

	onDestroy(() => {
		// Cancel any pending requests when component unmounts
		if (abortController) {
			abortController.abort();
		}
	});

	$: if (drawerView === 'boost' && merchant) {
		ensureBoostData(merchant, $exchangeRate, $boost);
	}

	// Pointer event handlers for dragging
	function handlePointerDown(event: PointerEvent) {
		if (activePointerId !== null) return;

		activePointerId = event.pointerId;
		isDragging = true;
		startY = event.clientY;
		initialHeight = $drawerHeight;
		lastY = event.clientY;
		lastTime = Date.now();
		velocitySamples = [];
		velocity = 0;

		if (handleElement) {
			try {
				handleElement.setPointerCapture(event.pointerId);
			} catch {
				// Pointer capture not supported or failed
			}
		}
	}

	function handlePointerMove(event: PointerEvent) {
		if (event.pointerId !== activePointerId || !isDragging) return;

		const currentY = event.clientY;
		const currentTime = Date.now();

		// Calculate instantaneous velocity
		const timeDelta = currentTime - lastTime;
		if (timeDelta > 0) {
			const yDelta = lastY - currentY; // positive = moving up
			const instantVelocity = yDelta / timeDelta;

			velocitySamples.push(instantVelocity);
			if (velocitySamples.length > VELOCITY_SAMPLE_COUNT) {
				velocitySamples.shift();
			}
			velocity = velocitySamples.reduce((a, b) => a + b, 0) / velocitySamples.length;
		}

		lastY = currentY;
		lastTime = currentTime;

		// Calculate new height - 1:1 tracking with finger
		const deltaY = startY - currentY;
		const newHeight = Math.max(PEEK_HEIGHT, Math.min(EXPANDED_HEIGHT, initialHeight + deltaY));

		drawerHeight.set(newHeight, { hard: true });
	}

	function handlePointerUp(event: PointerEvent) {
		if (event.pointerId !== activePointerId) return;

		const finalHeight = $drawerHeight;
		const totalDelta = finalHeight - initialHeight;

		// Release pointer capture safely
		if (handleElement) {
			try {
				handleElement.releasePointerCapture(event.pointerId);
			} catch {
				// Already released or invalid
			}
		}
		activePointerId = null;
		isDragging = false;

		// Determine snap state using helper function
		const snapState = determineSnapState(velocity, totalDelta, finalHeight, EXPANDED_HEIGHT);
		expanded = snapState.expanded;
		drawerHeight.set(snapState.height);

		// Reset velocity
		velocity = 0;
		velocitySamples = [];
	}

	function handlePointerCancel(event: PointerEvent) {
		if (event.pointerId !== activePointerId) return;

		activePointerId = null;
		isDragging = false;

		// Snap back to previous state
		if (expanded) {
			drawerHeight.set(EXPANDED_HEIGHT);
		} else {
			drawerHeight.set(PEEK_HEIGHT);
		}
	}

	export function openDrawer(id: number) {
		updateMerchantHash(id, 'details');
	}
</script>

{#if isOpen}
	<!-- Bottom sheet drawer -->
	<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<div
		class="fixed right-0 bottom-0 left-0 z-[1002] flex flex-col bg-white shadow-2xl transition-shadow dark:bg-dark"
		class:rounded-t-[10px]={!expanded}
		style="height: {$drawerHeight}px;"
		on:click|stopPropagation
		role="dialog"
		aria-modal={expanded}
		aria-label="Merchant details"
	>
		<!-- Drag handle and header area -->
		<div
			class="flex-shrink-0 touch-none"
			bind:this={handleElement}
			on:pointerdown={handlePointerDown}
			on:pointermove={handlePointerMove}
			on:pointerup={handlePointerUp}
			on:pointercancel={handlePointerCancel}
			tabindex="0"
			role="button"
			aria-label={expanded ? 'Collapse drawer' : 'Expand drawer'}
			aria-expanded={expanded}
		>
			<!-- Drag handle -->
			<div class="mx-auto mt-4 h-1.5 w-12 rounded-full bg-gray-300 dark:bg-white/30"></div>

			<!-- Header -->
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
					<div class="w-9"></div>
				{/if}
			</div>
		</div>

		<!-- Scrollable content area -->
		<div class="min-h-0 flex-1 overflow-y-auto">
			{#if !merchant && fetchingMerchant}
				<div class="space-y-4 p-4">
					<div class="h-6 w-3/4 animate-pulse rounded-lg bg-link/50"></div>
					<div class="h-4 w-1/2 animate-pulse rounded bg-link/50"></div>
					<div class="flex space-x-2">
						<div class="h-8 w-16 animate-pulse rounded bg-link/50"></div>
						<div class="h-8 w-16 animate-pulse rounded bg-link/50"></div>
					</div>
				</div>
			{:else if merchant}
				{#if !expanded}
					<div class="p-4">
						<MerchantPeekContentMobile {merchant} {isUpToDate} {isBoosted} />
					</div>
				{:else}
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

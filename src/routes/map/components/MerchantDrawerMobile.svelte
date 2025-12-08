<script lang="ts">
	import { browser } from '$app/environment';
	import { spring } from 'svelte/motion';
	import { boost, resetBoost } from '$lib/store';
	import Icon from '$components/Icon.svelte';
	import BoostContent from '$components/BoostContent.svelte';
	import MerchantDetailsContent from '$components/MerchantDetailsContent.svelte';
	import MerchantPeekContentMobile from './MerchantPeekContentMobile.svelte';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { merchantDrawer } from '$lib/merchantDrawerStore';
	import {
		calcVerifiedDate,
		isUpToDate as checkUpToDate,
		isBoosted as checkBoosted,
		handleBoost as boostMerchant,
		handleBoostComplete as completeBoost,
		ensureBoostData,
		clearBoostState
	} from '$lib/merchantDrawerLogic';

	// Gesture constants
	const PEEK_HEIGHT = 140; // Collapsed state height - shows merchant name and quick info
	const VELOCITY_THRESHOLD = 0.5; // px/ms - minimum velocity for flick gesture detection
	const DISTANCE_THRESHOLD = 80; // px - minimum drag distance to trigger snap
	const DISMISS_THRESHOLD = 60; // px - drag distance below peek to trigger dismiss
	const POSITION_THRESHOLD_PERCENT = 0.3; // When to snap up vs down (30% of total height)
	const VELOCITY_SAMPLE_COUNT = 5; // Number of velocity samples for smoothing
	const SPRING_CONFIG = { stiffness: 0.2, damping: 0.75 }; // Animation feel - smooth but responsive

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

	// Derive state from centralized store
	$: isOpen = $merchantDrawer.isOpen;
	$: merchantId = $merchantDrawer.merchantId;
	$: drawerView = $merchantDrawer.drawerView;
	$: merchant = $merchantDrawer.merchant;
	$: fetchingMerchant = $merchantDrawer.isLoading;

	// Bottom sheet state
	let EXPANDED_HEIGHT = 500; // Initial value, updated to window.innerHeight on mount
	let expanded = false; // Whether drawer is in expanded (full screen) state
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
	let capturedElement: HTMLElement | null = null;
	let contentScrollElement: HTMLDivElement | null = null;

	// Scroll-aware drag state for expanded mode (touch-based for better control)
	let touchStartY: number | null = null;
	let isInCollapseDrag = false;
	const SCROLL_DRAG_THRESHOLD = 10; // px to decide drag vs scroll

	// Track previous state to reset drawer when merchant changes
	let previousMerchantId: number | null = null;
	$: if (isOpen && merchantId !== previousMerchantId) {
		previousMerchantId = merchantId;
		expanded = false;
		drawerHeight.set(PEEK_HEIGHT, { hard: true });
	}

	const verifiedDate = calcVerifiedDate();
	$: isUpToDate = checkUpToDate(merchant, verifiedDate);
	$: isBoosted = checkBoosted(merchant);

	let boostLoading = false;
	const setBoostLoading = (loading: boolean) => {
		boostLoading = loading;
	};

	const closeDrawer = () => {
		clearBoostState();
		boostLoading = false;
		expanded = false;
		drawerHeight.set(PEEK_HEIGHT);
		merchantDrawer.close();
	};

	const goBack = () => {
		clearBoostState();
		boostLoading = false;
		merchantDrawer.setView('details');
	};

	$: if (drawerView !== 'boost' && $boost !== undefined) {
		clearBoostState();
		boostLoading = false;
	}

	const handleBoost = () => boostMerchant(merchant, merchantId, setBoostLoading);
	const handleBoostComplete = () => completeBoost(merchantId, invalidateAll, resetBoost);

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
			window.removeEventListener('keydown', handleKeydown);
			if (updateHeight) {
				window.removeEventListener('resize', updateHeight);
			}
		};
	});

	$: if (drawerView === 'boost' && merchant) {
		ensureBoostData(merchant, $boost);
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

		const target = event.currentTarget as HTMLElement;
		if (target) {
			try {
				target.setPointerCapture(event.pointerId);
				capturedElement = target;
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
		// Allow going below PEEK_HEIGHT when in peek state for dismiss gesture
		const deltaY = startY - currentY;
		const minHeight = expanded ? PEEK_HEIGHT : 0;
		const newHeight = Math.max(minHeight, Math.min(EXPANDED_HEIGHT, initialHeight + deltaY));

		drawerHeight.set(newHeight, { hard: true });
	}

	function handlePointerUp(event: PointerEvent) {
		if (event.pointerId !== activePointerId) return;

		const finalHeight = $drawerHeight;
		const totalDelta = finalHeight - initialHeight;

		// Release pointer capture safely
		if (capturedElement) {
			try {
				capturedElement.releasePointerCapture(event.pointerId);
			} catch {
				// Already released or invalid
			}
		}
		capturedElement = null;
		activePointerId = null;
		isDragging = false;

		// Check for dismiss gesture when in peek state
		const shouldDismiss =
			!expanded &&
			(velocity < -VELOCITY_THRESHOLD || finalHeight < PEEK_HEIGHT - DISMISS_THRESHOLD);

		if (shouldDismiss) {
			closeDrawer();
		} else {
			// Determine snap state using helper function
			const snapState = determineSnapState(velocity, totalDelta, finalHeight, EXPANDED_HEIGHT);
			expanded = snapState.expanded;
			drawerHeight.set(snapState.height);
		}

		// Reset velocity
		velocity = 0;
		velocitySamples = [];
	}

	function handlePointerCancel(event: PointerEvent) {
		if (event.pointerId !== activePointerId) return;

		capturedElement = null;
		activePointerId = null;
		isDragging = false;

		// Snap back to previous state
		if (expanded) {
			drawerHeight.set(EXPANDED_HEIGHT);
		} else {
			drawerHeight.set(PEEK_HEIGHT);
		}
	}

	// Touch-based handlers for expanded content area (Google Maps style)
	// Using touch events gives us control to preventDefault() and stop native scroll
	function handleContentTouchStart(event: TouchEvent) {
		if (!expanded || event.touches.length !== 1) return;
		touchStartY = event.touches[0].clientY;
		isInCollapseDrag = false;
	}

	function handleContentTouchMove(event: TouchEvent) {
		if (!expanded || touchStartY === null || event.touches.length !== 1) return;

		const touch = event.touches[0];
		const scrollTop = contentScrollElement?.scrollTop ?? 0;
		const deltaY = touch.clientY - touchStartY;

		// At scroll top AND dragging down → enter collapse drag mode
		if (scrollTop <= 0 && deltaY > SCROLL_DRAG_THRESHOLD) {
			// Prevent native scroll/pull-to-refresh
			event.preventDefault();

			if (!isInCollapseDrag) {
				// Initialize drag state
				isInCollapseDrag = true;
				isDragging = true;
				startY = touch.clientY;
				initialHeight = $drawerHeight;
				lastY = touch.clientY;
				lastTime = Date.now();
				velocitySamples = [];
				velocity = 0;
			} else {
				// Continue drag - update velocity and height
				const currentY = touch.clientY;
				const currentTime = Date.now();

				const timeDelta = currentTime - lastTime;
				if (timeDelta > 0) {
					const yDelta = lastY - currentY;
					const instantVelocity = yDelta / timeDelta;
					velocitySamples.push(instantVelocity);
					if (velocitySamples.length > VELOCITY_SAMPLE_COUNT) {
						velocitySamples.shift();
					}
					velocity = velocitySamples.reduce((a, b) => a + b, 0) / velocitySamples.length;
				}

				lastY = currentY;
				lastTime = currentTime;

				// Calculate new height
				const dragDelta = startY - currentY;
				const newHeight = Math.max(
					PEEK_HEIGHT,
					Math.min(EXPANDED_HEIGHT, initialHeight + dragDelta)
				);
				drawerHeight.set(newHeight, { hard: true });
			}
		}
	}

	function handleContentTouchEnd() {
		if (isInCollapseDrag) {
			// Determine snap state
			const finalHeight = $drawerHeight;
			const totalDelta = finalHeight - initialHeight;
			const snapState = determineSnapState(velocity, totalDelta, finalHeight, EXPANDED_HEIGHT);
			expanded = snapState.expanded;
			drawerHeight.set(snapState.height);

			// Reset state
			isDragging = false;
			velocity = 0;
			velocitySamples = [];
		}
		touchStartY = null;
		isInCollapseDrag = false;
	}

	export function openDrawer(id: number) {
		merchantDrawer.open(id, 'details');
	}
</script>

{#if isOpen}
	<!-- Bottom sheet drawer -->
	<!-- svelte-ignore a11y-no-noninteractive-element-interactions - Click handler only prevents event bubbling, not for interaction -->
	<!-- svelte-ignore a11y-click-events-have-key-events - Dialog interaction handled by focusable handle element below -->
	<div
		class="fixed right-0 bottom-0 left-0 z-[1002] flex flex-col bg-white shadow-2xl transition-shadow dark:bg-dark"
		class:rounded-t-[10px]={!expanded}
		style="height: {$drawerHeight}px; will-change: height;"
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
			<div class="mx-auto mt-2 h-1.5 w-12 rounded-full bg-gray-300 dark:bg-white/30"></div>

			<!-- Header -->
			<div
				class="flex items-center bg-white px-4 dark:bg-dark {drawerView === 'details'
					? 'justify-end py-1'
					: 'justify-between border-b border-gray-300 py-3 dark:border-white/95'}"
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
				{/if}

				{#if expanded && drawerView === 'details'}
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
				{:else if drawerView === 'details'}
					<div class="w-9"></div>
				{/if}
			</div>
		</div>

		<!-- Scrollable content area -->
		<div
			bind:this={contentScrollElement}
			class="min-h-0 flex-1 overflow-y-auto"
			style="overscroll-behavior-y: contain;"
			on:touchstart={handleContentTouchStart}
			on:touchmove={handleContentTouchMove}
			on:touchend={handleContentTouchEnd}
			on:touchcancel={handleContentTouchEnd}
		>
			{#if !merchant && fetchingMerchant}
				<div class="space-y-4 px-4 pt-2 pb-4">
					<div class="h-6 w-3/4 animate-pulse rounded-lg bg-link/50"></div>
					<div class="h-4 w-1/2 animate-pulse rounded bg-link/50"></div>
					<div class="flex space-x-2">
						<div class="h-8 w-16 animate-pulse rounded bg-link/50"></div>
						<div class="h-8 w-16 animate-pulse rounded bg-link/50"></div>
					</div>
				</div>
			{:else if merchant}
				{#if !expanded}
					<!-- Peek content wrapper with swipe handlers - allows swiping from anywhere when collapsed -->
					<div
						class="touch-none px-4 pt-2 pb-4"
						on:pointerdown={handlePointerDown}
						on:pointermove={handlePointerMove}
						on:pointerup={handlePointerUp}
						on:pointercancel={handlePointerCancel}
					>
						<MerchantPeekContentMobile
							{merchant}
							{isUpToDate}
							{isBoosted}
							isLoading={fetchingMerchant}
						/>
					</div>
				{:else}
					<div class="px-6 pt-3 pb-6">
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

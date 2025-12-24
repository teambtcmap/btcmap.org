<script lang="ts">
	import { browser } from '$app/environment';
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
	import { drawerGesture } from '$lib/drawerGestureController';
	import { trackEvent } from '$lib/analytics';

	// Derive state from centralized store
	$: isOpen = $merchantDrawer.isOpen;
	$: merchantId = $merchantDrawer.merchantId;
	$: drawerView = $merchantDrawer.drawerView;
	$: merchant = $merchantDrawer.merchant;
	$: fetchingMerchant = $merchantDrawer.isLoading;

	// Get gesture state from controller
	const { expanded, drawerHeight } = drawerGesture;

	// DOM references
	let drawerElement: HTMLDivElement;
	let handleElement: HTMLDivElement;
	let capturedElement: HTMLElement | null = null;
	let contentScrollElement: HTMLDivElement | null = null;

	// Focus management for accessibility
	let previouslyFocusedElement: HTMLElement | null = null;

	// Track previous state to reset drawer when merchant changes
	let previousMerchantId: number | null = null;
	$: if (isOpen && merchantId !== previousMerchantId) {
		previousMerchantId = merchantId;
		drawerGesture.resetToPeek();
	}

	// Focus management: save/restore focus when expanding/collapsing
	let wasExpanded = false;
	$: if ($expanded && !wasExpanded) {
		previouslyFocusedElement = document.activeElement as HTMLElement;
		setTimeout(() => handleElement?.focus(), 0);
		wasExpanded = true;
	} else if (!$expanded && wasExpanded) {
		if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
			previouslyFocusedElement.focus();
		}
		previouslyFocusedElement = null;
		wasExpanded = false;
	}

	// Focus trap: keep focus inside drawer when expanded
	function handleFocusOut(event: FocusEvent) {
		if ($expanded && drawerElement && event.relatedTarget) {
			const focusMovingOutside = !drawerElement.contains(event.relatedTarget as Node);
			if (focusMovingOutside) {
				handleElement?.focus();
			}
		}
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
		drawerGesture.collapse();
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
				} else if ($expanded) {
					drawerGesture.collapse();
				} else {
					closeDrawer();
				}
				break;
			case 'ArrowUp':
				event.preventDefault();
				if (!$expanded) {
					drawerGesture.expand();
				}
				break;
			case 'ArrowDown':
				event.preventDefault();
				if ($expanded) {
					drawerGesture.collapse();
				}
				break;
			case 'Enter':
			case ' ':
				if (document.activeElement === handleElement) {
					event.preventDefault();
					drawerGesture.toggle();
				}
				break;
		}
	}

	// Wire up pointer event handlers with capture target
	function onPointerDown(event: PointerEvent) {
		const target = event.currentTarget as HTMLElement;
		capturedElement = target;
		drawerGesture.handlePointerDown(event, target);
	}

	function onPointerUp(event: PointerEvent) {
		drawerGesture.handlePointerUp(event, capturedElement);
		capturedElement = null;
	}

	// Wire up touch handler with scroll position
	function onContentTouchMove(event: TouchEvent) {
		const scrollTop = contentScrollElement?.scrollTop ?? 0;
		drawerGesture.handleContentTouchMove(event, scrollTop);
	}

	onMount(() => {
		// Set dismiss callback
		drawerGesture.setDismissCallback(closeDrawer);

		// Keyboard listener
		window.addEventListener('keydown', handleKeydown);

		// Window resize handler
		let updateHeight: (() => void) | null = null;
		if (browser) {
			updateHeight = () => {
				drawerGesture.setExpandedHeight(window.innerHeight);
			};
			updateHeight();
			window.addEventListener('resize', updateHeight);
		}

		return () => {
			drawerGesture.setDismissCallback(null);
			window.removeEventListener('keydown', handleKeydown);
			if (updateHeight) {
				window.removeEventListener('resize', updateHeight);
			}
		};
	});

	$: if (drawerView === 'boost' && merchant) {
		ensureBoostData(merchant, $boost);
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
		bind:this={drawerElement}
		class="fixed right-0 bottom-0 left-0 z-[1002] flex flex-col bg-white shadow-2xl transition-shadow dark:bg-dark"
		class:rounded-t-[10px]={!$expanded}
		style="height: {$drawerHeight}px; will-change: height;"
		on:click={(e) => e.stopPropagation()}
		on:focusout={handleFocusOut}
		role="dialog"
		aria-modal="true"
		aria-label="Merchant details"
	>
		<!-- Drag handle and header area -->
		<div
			class="flex-shrink-0 touch-none"
			bind:this={handleElement}
			on:pointerdown={onPointerDown}
			on:pointermove={drawerGesture.handlePointerMove}
			on:pointerup={onPointerUp}
			on:pointercancel={drawerGesture.handlePointerCancel}
			tabindex="0"
			role="button"
			aria-label={$expanded ? 'Collapse drawer' : 'Expand drawer'}
			aria-expanded={$expanded}
			aria-controls="drawer-content"
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

				{#if $expanded && drawerView === 'details'}
					<button
						on:click={() => {
							trackEvent('drawer_collapse_button_click');
							drawerGesture.collapse();
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
			id="drawer-content"
			bind:this={contentScrollElement}
			class="min-h-0 flex-1 overflow-y-auto"
			style="overscroll-behavior-y: contain; touch-action: pan-y;"
			on:touchstart={drawerGesture.handleContentTouchStart}
			on:touchmove={onContentTouchMove}
			on:touchend={drawerGesture.handleContentTouchEnd}
			on:touchcancel={drawerGesture.handleContentTouchEnd}
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
				{#if !$expanded}
					<!-- Peek content wrapper with swipe handlers - allows swiping from anywhere when collapsed -->
					<div
						class="touch-none px-4 pt-2 pb-4"
						on:pointerdown={onPointerDown}
						on:pointermove={drawerGesture.handlePointerMove}
						on:pointerup={onPointerUp}
						on:pointercancel={drawerGesture.handlePointerCancel}
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

<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy } from 'svelte';
	import { fly } from 'svelte/transition';
	import { merchantList } from '$lib/merchantListStore';
	import { merchantDrawer } from '$lib/merchantDrawerStore';
	import MerchantListItem from '$components/MerchantListItem.svelte';
	import CloseButton from '$components/CloseButton.svelte';
	import LoadingSpinner from '$components/LoadingSpinner.svelte';
	import Icon from '$components/Icon.svelte';
	import type { Place } from '$lib/types';
	import {
		MERCHANT_LIST_WIDTH,
		MERCHANT_LIST_MIN_ZOOM,
		MERCHANT_LIST_LOW_ZOOM
	} from '$lib/constants';
	import { calcVerifiedDate } from '$lib/merchantDrawerLogic';

	// Compute once for all list items
	const verifiedDate = calcVerifiedDate();

	// Callback to pan map when a merchant is clicked from the list
	export let onPanToPlace: ((place: Place) => void) | undefined = undefined;
	// Callbacks for hover highlighting
	export let onHoverStart: ((place: Place) => void) | undefined = undefined;
	export let onHoverEnd: ((place: Place) => void) | undefined = undefined;
	// Current zoom level to determine if we should show "zoom in" message
	export let currentZoom: number = 0;

	$: isOpen = $merchantList.isOpen;
	$: isExpanded = $merchantList.isExpanded;
	$: merchants = $merchantList.merchants;
	$: totalCount = $merchantList.totalCount;
	$: enrichedPlaces = $merchantList.enrichedPlaces;
	$: isLoading = $merchantList.isLoading;
	$: selectedId = $merchantDrawer.merchantId;
	// Show "zoom in" message when:
	// 1. Below zoom 11 (always - no data fetched at this level)
	// 2. Between zoom 11-14 with no merchants (too many results in dense area)
	$: showZoomInMessage =
		currentZoom < MERCHANT_LIST_LOW_ZOOM ||
		(currentZoom < MERCHANT_LIST_MIN_ZOOM && merchants.length === 0);
	$: isTruncated = totalCount > merchants.length;

	function handleItemClick(event: CustomEvent<Place>) {
		const place = event.detail;
		merchantDrawer.open(place.id, 'details');
		// Pan to merchant only when clicked from list (not from map markers)
		onPanToPlace?.(place);
	}

	function handleMouseEnter(event: CustomEvent<Place>) {
		onHoverStart?.(event.detail);
	}

	function handleMouseLeave(event: CustomEvent<Place>) {
		onHoverEnd?.(event.detail);
	}

	function handleClose() {
		merchantList.collapse();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			handleClose();
		}
	}

	// Track listener state to prevent accumulation
	let listenerAttached = false;

	// Scope keydown listener to when panel is open
	$: if (browser) {
		if (isOpen && !listenerAttached) {
			window.addEventListener('keydown', handleKeydown);
			listenerAttached = true;
		} else if (!isOpen && listenerAttached) {
			window.removeEventListener('keydown', handleKeydown);
			listenerAttached = false;
		}
	}

	onDestroy(() => {
		if (browser && listenerAttached) {
			window.removeEventListener('keydown', handleKeydown);
			listenerAttached = false;
		}
	});
</script>

{#if isOpen && isExpanded}
	<section
		class="hidden flex-none flex-col overflow-hidden border-r border-white/10 bg-white md:flex dark:border-white/5 dark:bg-dark"
		style="width: {MERCHANT_LIST_WIDTH}px"
		role="complementary"
		aria-label="Merchant list"
		transition:fly={{ x: -MERCHANT_LIST_WIDTH, duration: 200 }}
	>
		<!-- Header -->
		<div
			class="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-dark"
		>
			<div>
				<h2 class="text-sm font-semibold text-primary dark:text-white">Nearby Merchants</h2>
				{#if showZoomInMessage}
					<p class="text-xs text-body dark:text-white/70">Zoom in to see list</p>
				{:else if isTruncated}
					<p class="text-xs text-body dark:text-white/70">
						Showing {merchants.length} nearest of {totalCount}
					</p>
				{:else}
					<p class="text-xs text-body dark:text-white/70">
						{merchants.length} location{merchants.length !== 1 ? 's' : ''} in view
					</p>
				{/if}
			</div>
			<CloseButton on:click={handleClose} />
		</div>

		<!-- List content -->
		<div class="flex-1 overflow-y-auto">
			{#if showZoomInMessage}
				<div class="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
					<Icon
						w="48"
						h="48"
						icon="zoom_in"
						type="material"
						style="text-gray-300 dark:text-white/30"
					/>
					<div>
						<p class="text-sm font-medium text-primary dark:text-white">
							Zoom in to see nearby merchants
						</p>
						<p class="mt-1 text-xs text-body dark:text-white/70">
							The merchant list shows locations when zoomed in closer
						</p>
					</div>
				</div>
			{:else if isLoading}
				<div class="flex items-center justify-center py-8">
					<LoadingSpinner color="text-link dark:text-white" size="h-6 w-6" />
				</div>
			{:else if merchants.length === 0}
				<div class="px-3 py-8 text-center text-sm text-body dark:text-white/70">
					No merchants visible in current view
				</div>
			{:else}
				<ul class="divide-y divide-gray-100 dark:divide-white/5">
					{#each merchants as merchant (merchant.id)}
						<MerchantListItem
							{merchant}
							enrichedData={enrichedPlaces.get(merchant.id) || null}
							isSelected={selectedId === merchant.id}
							{verifiedDate}
							on:click={handleItemClick}
							on:mouseenter={handleMouseEnter}
							on:mouseleave={handleMouseLeave}
						/>
					{/each}
				</ul>
			{/if}
		</div>
	</section>
{/if}

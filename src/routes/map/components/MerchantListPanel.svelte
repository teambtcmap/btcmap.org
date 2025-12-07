<script lang="ts">
	import { browser } from '$app/environment';
	import { tick, onDestroy } from 'svelte';
	import { fly } from 'svelte/transition';
	import { merchantList, type MerchantListMode } from '$lib/merchantListStore';
	import { merchantDrawer } from '$lib/merchantDrawerStore';
	import MerchantListItem from './MerchantListItem.svelte';
	import CloseButton from '$components/CloseButton.svelte';
	import LoadingSpinner from '$components/LoadingSpinner.svelte';
	import Icon from '$components/Icon.svelte';
	import type { Place } from '$lib/types';
	import {
		MERCHANT_LIST_WIDTH,
		MERCHANT_LIST_MIN_ZOOM,
		MERCHANT_LIST_LOW_ZOOM,
		BREAKPOINTS
	} from '$lib/constants';
	import { calcVerifiedDate } from '$lib/merchantDrawerLogic';

	// Reduced motion preference for animations
	const reducedMotion = browser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	// Compute once for all list items
	const verifiedDate = calcVerifiedDate();

	// Callback to pan to a nearby merchant (already zoomed in, just center it)
	export let onPanToNearbyMerchant: ((place: Place) => void) | undefined = undefined;
	// Callback to zoom to a search result (may be far away, need to fly there)
	export let onZoomToSearchResult: ((place: Place) => void) | undefined = undefined;
	// Callbacks for hover highlighting
	export let onHoverStart: ((place: Place) => void) | undefined = undefined;
	export let onHoverEnd: ((place: Place) => void) | undefined = undefined;
	// Current zoom level to determine if we should show "zoom in" message
	export let currentZoom: number = 0;
	// Search callback - called when user types in search input
	export let onSearch: ((query: string) => void) | undefined = undefined;
	// Clear search callback
	export let onClearSearch: (() => void) | undefined = undefined;
	// Mode change callback
	export let onModeChange: ((mode: MerchantListMode) => void) | undefined = undefined;

	// Local search input value
	let searchInputValue = '';
	let searchInput: HTMLInputElement;

	// Body scroll lock for mobile (prevents iOS background scroll)
	let scrollLockActive = false;

	// Reference for focus trap
	let panelElement: HTMLElement;

	function handleSearchInput() {
		onSearch?.(searchInputValue);
	}

	function handleClearSearch() {
		searchInputValue = '';
		onClearSearch?.();
		searchInput?.focus();
	}

	function handleSearchKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape' && searchInputValue) {
			event.preventDefault();
			event.stopPropagation();
			handleClearSearch();
		}
	}

	function handleModeSwitch(newMode: MerchantListMode) {
		if (newMode === mode) return;
		// Clear local search input when switching modes
		if (newMode === 'nearby') {
			searchInputValue = '';
		}
		onModeChange?.(newMode);
	}

	$: isOpen = $merchantList.isOpen;
	$: isExpanded = $merchantList.isExpanded;
	$: merchants = $merchantList.merchants;
	$: totalCount = $merchantList.totalCount;
	$: placeDetailsCache = $merchantList.placeDetailsCache;
	$: isLoadingList = $merchantList.isLoadingList;
	$: selectedId = $merchantDrawer.merchantId;
	$: mode = $merchantList.mode;
	$: searchResults = $merchantList.searchResults;
	$: isSearching = $merchantList.isSearching;
	// Show "zoom in" message when:
	// 1. Below zoom 11 (always - no data fetched at this level)
	// 2. Between zoom 11-14 with no merchants (too many results in dense area)
	$: showZoomInMessage =
		currentZoom < MERCHANT_LIST_LOW_ZOOM ||
		(currentZoom < MERCHANT_LIST_MIN_ZOOM && merchants.length === 0);
	$: isTruncated = totalCount > merchants.length;

	// Body scroll lock on mobile when panel is open
	$: if (browser && isOpen !== undefined && isExpanded !== undefined) {
		const isMobile = window.innerWidth < BREAKPOINTS.md;
		const shouldLock = isOpen && isExpanded && isMobile;
		if (shouldLock && !scrollLockActive) {
			document.body.style.overflow = 'hidden';
			scrollLockActive = true;
		} else if (!shouldLock && scrollLockActive) {
			document.body.style.overflow = '';
			scrollLockActive = false;
		}
	}

	// Focus search input when panel opens in search mode
	$: if (browser && isOpen && isExpanded && mode === 'search' && searchInput) {
		tick().then(() => searchInput?.focus());
	}

	function handleItemClick(event: CustomEvent<Place>) {
		const place = event.detail;
		merchantDrawer.open(place.id, 'details');

		if (mode === 'search') {
			// Search result: zoom to location (may be far from current view)
			onZoomToSearchResult?.(place);
		} else {
			// Nearby merchant: pan only (already zoomed in)
			onPanToNearbyMerchant?.(place);
		}

		// On mobile, close the list panel so the drawer is visible
		if (browser && window.innerWidth < BREAKPOINTS.md) {
			merchantList.collapse();
		}
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

	function handleWindowKeydown(event: KeyboardEvent) {
		if (!isOpen) return;

		// Focus trap on mobile: cycle Tab within the panel
		const isMobileView = browser && window.innerWidth < BREAKPOINTS.md;
		if (event.key === 'Tab' && isMobileView && panelElement) {
			const focusable = panelElement.querySelectorAll<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);
			const first = focusable[0];
			const last = focusable[focusable.length - 1];

			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last?.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first?.focus();
			}
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			handleClose();
		}
	}

	// Cleanup scroll lock when component is destroyed
	onDestroy(() => {
		if (browser && scrollLockActive) {
			document.body.style.overflow = '';
		}
	});
</script>

<svelte:window on:keydown={handleWindowKeydown} />

{#if isOpen && isExpanded}
	<section
		bind:this={panelElement}
		class="absolute inset-0 z-[1000] flex flex-col overflow-hidden bg-white md:relative md:inset-auto md:z-auto md:w-80 md:flex-none md:border-r md:border-white/10 dark:border-white/5 dark:bg-dark"
		role="complementary"
		aria-label="Merchant list"
		transition:fly={{ x: -MERCHANT_LIST_WIDTH, duration: reducedMotion ? 0 : 200 }}
	>
		<!-- Header -->
		<div
			class="shrink-0 border-b border-gray-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-dark"
		>
			{#if mode === 'search'}
				<!-- Search mode: search input -->
				<div class="flex items-center gap-2">
					<div class="relative flex-1">
						<Icon
							w="16"
							h="16"
							icon="search"
							type="material"
							style="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/50 pointer-events-none"
						/>
						<input
							bind:this={searchInput}
							bind:value={searchInputValue}
							on:input={handleSearchInput}
							on:keydown={handleSearchKeyDown}
							type="search"
							placeholder="e.g. pizza, cafe, atm..."
							aria-label="Search for Bitcoin merchants"
							class="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pr-8 pl-9 text-sm text-primary focus:border-link focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/30 [&::-webkit-search-cancel-button]:hidden"
						/>
						{#if searchInputValue}
							<button
								type="button"
								on:click={handleClearSearch}
								class="absolute top-1/2 right-2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:text-white/50 dark:hover:text-white/70"
								aria-label="Clear search"
							>
								<Icon w="14" h="14" icon="close" type="material" />
							</button>
						{/if}
					</div>
					<CloseButton on:click={handleClose} />
				</div>
				<!-- Result count -->
				{#if isSearching || searchResults.length > 0 || searchInputValue.length >= 3}
					<p class="mt-2 text-xs text-body dark:text-white/70" aria-live="polite">
						{#if isSearching}
							Searching...
						{:else if searchResults.length === 0}
							No results found
						{:else}
							{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
						{/if}
					</p>
				{/if}
			{:else}
				<!-- Nearby mode: title + count -->
				<div class="flex items-center justify-between">
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
			{/if}

			<!-- Mode toggle buttons -->
			<div
				class="mt-3 flex rounded-lg bg-gray-100 p-1 dark:bg-white/5"
				role="radiogroup"
				aria-label="View mode"
			>
				<button
					type="button"
					role="radio"
					on:click={() => handleModeSwitch('search')}
					aria-checked={mode === 'search'}
					class="flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors
						{mode === 'search'
						? 'bg-white text-primary shadow-sm dark:bg-white/10 dark:text-white'
						: 'text-body hover:text-primary dark:text-white/70 dark:hover:text-white'}"
				>
					Search
				</button>
				<button
					type="button"
					role="radio"
					on:click={() => handleModeSwitch('nearby')}
					aria-checked={mode === 'nearby'}
					class="flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors
						{mode === 'nearby'
						? 'bg-white text-primary shadow-sm dark:bg-white/10 dark:text-white'
						: 'text-body hover:text-primary dark:text-white/70 dark:hover:text-white'}"
				>
					Nearby
				</button>
			</div>
		</div>

		<!-- List content -->
		<div class="flex-1 overflow-y-auto">
			{#if mode === 'search'}
				<!-- Search results -->
				{#if isSearching}
					<div class="flex items-center justify-center py-8">
						<LoadingSpinner color="text-link dark:text-white" size="h-6 w-6" />
					</div>
				{:else if searchResults.length === 0 && searchInputValue.length >= 3}
					<div class="px-3 py-8 text-center text-sm text-body dark:text-white/70">
						No results found
					</div>
				{:else if searchResults.length === 0}
					<!-- Empty state: user hasn't searched yet -->
					<div class="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
						<Icon
							w="48"
							h="48"
							icon="search"
							type="material"
							style="text-gray-300 dark:text-white/30"
						/>
						<p class="text-sm text-body dark:text-white/70">Search for merchants by name</p>
					</div>
				{:else}
					<ul class="divide-y divide-gray-100 dark:divide-white/5">
						{#each searchResults as merchant (merchant.id)}
							<MerchantListItem
								{merchant}
								enrichedData={merchant}
								isSelected={selectedId === merchant.id}
								{verifiedDate}
								on:click={handleItemClick}
								on:mouseenter={handleMouseEnter}
								on:mouseleave={handleMouseLeave}
							/>
						{/each}
					</ul>
				{/if}
			{:else if showZoomInMessage}
				<!-- Nearby mode: zoom in message -->
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
			{:else if isLoadingList}
				<div class="flex items-center justify-center py-8">
					<LoadingSpinner color="text-link dark:text-white" size="h-6 w-6" />
				</div>
			{:else if merchants.length === 0}
				<div class="px-3 py-8 text-center text-sm text-body dark:text-white/70">
					No merchants visible in current view
				</div>
			{:else}
				<!-- Nearby mode: merchant list -->
				<ul class="divide-y divide-gray-100 dark:divide-white/5">
					{#each merchants as merchant (merchant.id)}
						<MerchantListItem
							{merchant}
							enrichedData={placeDetailsCache.get(merchant.id) || null}
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

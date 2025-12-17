<script lang="ts">
	import { browser } from '$app/environment';
	import { tick, onDestroy } from 'svelte';
	import { fly } from 'svelte/transition';
	import type { MerchantListMode } from '$lib/merchantListStore';
	import { merchantList } from '$lib/merchantListStore';
	import { merchantDrawer } from '$lib/merchantDrawerStore';
	import MerchantListItem from './MerchantListItem.svelte';
	import CloseButton from '$components/CloseButton.svelte';
	import LoadingSpinner from '$components/LoadingSpinner.svelte';
	import Icon from '$components/Icon.svelte';
	import type { Place } from '$lib/types';
	import {
		CATEGORY_ENTRIES,
		placeMatchesCategory,
		type CategoryKey,
		type CategoryCounts
	} from '$lib/categoryMapping';
	import {
		MERCHANT_LIST_WIDTH,
		MERCHANT_LIST_MIN_ZOOM,
		MERCHANT_LIST_LOW_ZOOM,
		BREAKPOINTS
	} from '$lib/constants';
	import { calcVerifiedDate } from '$lib/merchantDrawerLogic';
	import { trackEvent } from '$lib/analytics';

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
	// Mode change callback (called for nearby mode switch)
	export let onModeChange: ((mode: MerchantListMode) => void) | undefined = undefined;
	// Refresh callback for category filtering
	export let onRefresh: (() => void) | undefined = undefined;
	// Callback to fit map bounds to all search results
	export let onFitSearchResultBounds: (() => void) | undefined = undefined;

	// Reference for search input element
	let searchInput: HTMLInputElement;

	// Local filter for nearby mode (client-side filtering by name)
	let nearbyFilter = '';

	// Body scroll lock for mobile (prevents iOS background scroll)
	let scrollLockActive = false;

	// Reference for focus trap
	let panelElement: HTMLElement;

	function handleClearSearch() {
		merchantList.clearSearchInput();
		// Trigger onSearch to abort any pending request (same as typing empty query)
		onSearch?.('');
		searchInput?.focus();
	}

	function handleSearchKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape' && $merchantList.searchQuery) {
			event.preventDefault();
			event.stopPropagation();
			handleClearSearch();
		}
	}

	function handleModeSwitch(newMode: MerchantListMode) {
		if (newMode === mode) return;
		nearbyFilter = ''; // Clear filter when switching modes
		if (newMode === 'nearby') {
			merchantList.exitSearchMode();
			onModeChange?.(newMode);
		} else {
			trackEvent('worldwide_mode_click');
			merchantList.setMode(newMode);
		}
	}

	function handleCategorySelect(category: CategoryKey) {
		// Guard against clicks on disabled buttons (Svelte fires click even when disabled)
		if (!hasMatchingMerchants(category, categoryCounts)) return;
		trackEvent('category_filter', { category });
		merchantList.setSelectedCategory(category);
		// Only refresh in nearby mode - search mode filters client-side
		if (mode === 'nearby') {
			onRefresh?.();
		}
	}

	$: isOpen = $merchantList.isOpen;
	$: merchants = $merchantList.merchants;
	$: totalCount = $merchantList.totalCount;
	$: placeDetailsCache = $merchantList.placeDetailsCache;
	$: isLoadingList = $merchantList.isLoadingList;
	$: selectedId = $merchantDrawer.merchantId;
	$: mode = $merchantList.mode;
	$: searchResults = $merchantList.searchResults;
	$: isSearching = $merchantList.isSearching;
	$: searchQuery = $merchantList.searchQuery;
	$: selectedCategory = $merchantList.selectedCategory;
	$: categoryCounts = $merchantList.categoryCounts;

	// Filter search results by category
	$: filteredSearchResults =
		selectedCategory === 'all'
			? searchResults
			: searchResults.filter((p) => placeMatchesCategory(p, selectedCategory));

	// Helper function to check if a category has matching merchants
	// Note: counts param required for Svelte reactivity (indirect deps aren't tracked)
	function hasMatchingMerchants(categoryKey: CategoryKey, counts: CategoryCounts): boolean {
		if (categoryKey === 'all') return true;
		return (counts?.[categoryKey] ?? 0) > 0;
	}

	// Helper function to get category button classes
	// Note: categoryCounts param required for Svelte reactivity (indirect deps aren't tracked)
	function getCategoryButtonClass(
		key: CategoryKey,
		selectedCategory: CategoryKey,
		counts: CategoryCounts
	): string {
		if (selectedCategory === key) return 'bg-primary text-white';
		const hasMatches = key === 'all' || (counts?.[key] ?? 0) > 0;
		if (hasMatches) {
			return 'bg-gray-100 text-body hover:bg-gray-200 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10';
		}
		return 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-white/30';
	}

	// Show "zoom in" message when:
	// 1. Below zoom 11 (always - no data fetched at this level)
	// 2. Between zoom 11-14 with no merchants (too many results in dense area)
	$: showZoomInMessage =
		currentZoom < MERCHANT_LIST_LOW_ZOOM ||
		(currentZoom < MERCHANT_LIST_MIN_ZOOM && merchants.length === 0);
	$: isTruncated = totalCount > merchants.length;

	// Body scroll lock on mobile when panel is open
	$: if (browser && isOpen !== undefined) {
		const isMobile = window.innerWidth < BREAKPOINTS.md;
		const shouldLock = isOpen && isMobile;
		if (shouldLock && !scrollLockActive) {
			document.body.style.overflow = 'hidden';
			scrollLockActive = true;
		} else if (!shouldLock && scrollLockActive) {
			document.body.style.overflow = '';
			scrollLockActive = false;
		}
	}

	// Focus search input when panel opens in search mode
	$: if (browser && isOpen && mode === 'search' && searchInput) {
		tick().then(() => searchInput?.focus());
	}

	function handleItemClick(place: Place) {
		merchantDrawer.open(place.id, 'details');

		if (mode === 'search') {
			// Search result: zoom to location (may be far from current view)
			onZoomToSearchResult?.(place);
		} else {
			// Nearby merchant: pan only (already zoomed in)
			onPanToNearbyMerchant?.(place);
		}

		// On mobile, close panel so drawer is visible (panel is fullscreen)
		// On desktop, keep panel open (list and drawer coexist side by side)
		if (browser && window.innerWidth < BREAKPOINTS.md) {
			merchantList.close();
		}
	}

	function handleMouseEnter(place: Place) {
		onHoverStart?.(place);
	}

	function handleMouseLeave(place: Place) {
		onHoverEnd?.(place);
	}

	function handleClose() {
		nearbyFilter = ''; // Clear filter when closing
		merchantList.close();
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (!isOpen) return;

		// Focus trap: cycle Tab within the panel to prevent focus escaping to background
		if (event.key === 'Tab' && panelElement) {
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

{#if isOpen}
	<section
		bind:this={panelElement}
		class="absolute inset-0 z-[1001] flex flex-col overflow-hidden bg-white md:relative md:inset-auto md:z-auto md:w-80 md:flex-none md:border-r md:border-white/10 dark:border-white/5 dark:bg-dark"
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
							class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-400 dark:text-white/50"
						/>
						<input
							bind:this={searchInput}
							value={searchQuery}
							on:input={(e) => {
								merchantList.setSearchQuery(e.currentTarget.value);
								onSearch?.($merchantList.searchQuery);
							}}
							on:keydown={handleSearchKeyDown}
							type="search"
							placeholder="e.g. pizza, cafe, atm..."
							aria-label="Search for Bitcoin merchants"
							class="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pr-8 pl-9 text-sm text-primary focus:border-link focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/30 [&::-webkit-search-cancel-button]:hidden"
						/>
						{#if searchQuery}
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
			{:else}
				<!-- Nearby mode: title + count -->
				<div class="flex items-center justify-between">
					<div>
						<h2 class="text-sm font-semibold text-primary dark:text-white">Nearby Merchants</h2>
						{#if showZoomInMessage}
							<p class="text-xs text-body dark:text-white/70" aria-live="polite">
								Zoom in to see list
							</p>
						{:else if isTruncated}
							<p class="text-xs text-body dark:text-white/70" aria-live="polite">
								Showing {merchants.length} nearest of {totalCount}
							</p>
						{:else}
							<p class="text-xs text-body dark:text-white/70" aria-live="polite">
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
					Worldwide
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

			<!-- Category filter (shown in both nearby and search modes) -->
			<div class="mt-3" role="radiogroup" aria-label="Filter by category">
				<h3 class="sr-only">Filter by category</h3>
				<div class="flex flex-wrap gap-2">
					{#each CATEGORY_ENTRIES as [key, category] (key)}
						<button
							type="button"
							role="radio"
							on:click={() => handleCategorySelect(key)}
							disabled={!hasMatchingMerchants(key, categoryCounts)}
							aria-disabled={!hasMatchingMerchants(key, categoryCounts)}
							aria-checked={selectedCategory === key}
							class="rounded-full px-3 py-1 text-xs font-medium transition-colors {getCategoryButtonClass(
								key,
								selectedCategory,
								categoryCounts
							)}"
						>
							{category.label}
						</button>
					{/each}
				</div>
			</div>

			{#if mode === 'search'}
				<!-- Search status row: result count + show all on map -->
				<div class="mt-3 flex items-center justify-between gap-2">
					<p class="text-xs text-body dark:text-white/70" aria-live="polite">
						{#if isSearching}
							Searching...
						{:else if searchResults.length === 0 && searchQuery.length >= 3}
							No results found
						{:else if searchResults.length === 0}
							Search for merchants
						{:else if selectedCategory !== 'all' && filteredSearchResults.length !== searchResults.length}
							{filteredSearchResults.length} of {searchResults.length} result{searchResults.length !==
							1
								? 's'
								: ''}
						{:else}
							{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
						{/if}
					</p>
					<button
						type="button"
						on:click={() => onFitSearchResultBounds?.()}
						disabled={filteredSearchResults.length === 0}
						class="flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors
							{filteredSearchResults.length > 0
							? 'border-gray-200 bg-white text-primary hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10'
							: 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400 dark:border-white/5 dark:bg-white/5 dark:text-white/30'}"
						aria-label="Zoom map to show {filteredSearchResults.length === 1
							? '1 result'
							: `all ${filteredSearchResults.length} results`}"
					>
						<Icon w="14" h="14" icon="zoom_out_map" type="material" />
						<span>Show all</span>
					</button>
				</div>
			{:else}
				<!-- Name filter input (nearby mode only) -->
				<div class="relative mt-3">
					<Icon
						w="14"
						h="14"
						icon="filter_list"
						type="material"
						class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-gray-400 dark:text-white/50"
					/>
					<input
						bind:value={nearbyFilter}
						type="text"
						placeholder="Filter by name..."
						aria-label="Filter nearby merchants by name"
						class="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pr-7 pl-8 text-xs text-primary focus:border-link focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/30"
					/>
					{#if nearbyFilter}
						<button
							type="button"
							on:click={() => (nearbyFilter = '')}
							class="absolute top-1/2 right-2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:text-white/50 dark:hover:text-white/70"
							aria-label="Clear filter"
						>
							<Icon w="12" h="12" icon="close" type="material" />
						</button>
					{/if}
				</div>
			{/if}
		</div>

		<!-- List content -->
		<div class="flex-1 overflow-y-auto">
			{#if mode === 'search'}
				<!-- Search results -->
				{#if isSearching}
					<div class="flex items-center justify-center py-8" role="status" aria-label="Searching">
						<LoadingSpinner color="text-link dark:text-white" size="h-6 w-6" />
					</div>
				{:else if searchResults.length === 0}
					<!-- Empty state: no results yet -->
					<div class="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
						<Icon
							w="48"
							h="48"
							icon="search"
							type="material"
							class="text-gray-300 dark:text-white/30"
						/>
						<p class="text-sm text-body dark:text-white/70">
							{#if searchQuery.length >= 3}
								No results found for "{searchQuery}"
							{:else}
								Search for merchants by name
							{/if}
						</p>
					</div>
				{:else if filteredSearchResults.length === 0}
					<!-- Has results but none match category filter -->
					<div class="px-3 py-8 text-center text-sm text-body dark:text-white/70">
						No results in this category
					</div>
				{:else}
					<ul class="divide-y divide-gray-100 dark:divide-white/5">
						{#each filteredSearchResults as merchant (merchant.id)}
							<MerchantListItem
								{merchant}
								enrichedData={merchant}
								isSelected={selectedId === merchant.id}
								{verifiedDate}
								onclick={handleItemClick}
								onmouseenter={handleMouseEnter}
								onmouseleave={handleMouseLeave}
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
						class="text-gray-300 dark:text-white/30"
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
				<div
					class="flex items-center justify-center py-8"
					role="status"
					aria-label="Loading nearby merchants"
				>
					<LoadingSpinner color="text-link dark:text-white" size="h-6 w-6" />
				</div>
			{:else if merchants.length === 0}
				<div class="px-3 py-8 text-center text-sm text-body dark:text-white/70">
					No merchants visible in current view
				</div>
			{:else}
				<!-- Nearby mode: merchant list -->
				{@const filteredMerchants = nearbyFilter
					? merchants.filter((m) => {
							const enriched = placeDetailsCache.get(m.id);
							const name = enriched?.name || m.name || '';
							return name.toLowerCase().includes(nearbyFilter.toLowerCase());
						})
					: merchants}
				{#if filteredMerchants.length === 0 && nearbyFilter}
					<div class="px-3 py-8 text-center text-sm text-body dark:text-white/70">
						No merchants match "{nearbyFilter}"
					</div>
				{:else}
					<ul class="divide-y divide-gray-100 dark:divide-white/5">
						{#each filteredMerchants as merchant (merchant.id)}
							<MerchantListItem
								{merchant}
								enrichedData={placeDetailsCache.get(merchant.id) || null}
								isSelected={selectedId === merchant.id}
								{verifiedDate}
								onclick={handleItemClick}
								onmouseenter={handleMouseEnter}
								onmouseleave={handleMouseLeave}
							/>
						{/each}
					</ul>
				{/if}
			{/if}
		</div>
	</section>
{/if}

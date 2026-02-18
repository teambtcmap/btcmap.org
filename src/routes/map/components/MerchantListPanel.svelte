<script lang="ts">
import { onDestroy, tick } from "svelte";

import Icon from "$components/Icon.svelte";
import LoadingSpinner from "$components/LoadingSpinner.svelte";
import SearchInput from "$components/SearchInput.svelte";
import { trackEvent } from "$lib/analytics";
import {
	CATEGORY_ENTRIES,
	type CategoryCounts,
	type CategoryKey,
	placeMatchesCategory,
} from "$lib/categoryMapping";
import {
	BREAKPOINTS,
	MERCHANT_LIST_LOW_ZOOM,
	MERCHANT_LIST_MIN_ZOOM,
} from "$lib/constants";
import { _ } from "$lib/i18n";
import { calcVerifiedDate } from "$lib/merchantDrawerLogic";
import { merchantDrawer } from "$lib/merchantDrawerStore";
import type { MerchantListMode } from "$lib/merchantListStore";
import { merchantList } from "$lib/merchantListStore";
import type { Place } from "$lib/types";
import { userLocation } from "$lib/userLocationStore";
import { errToast, formatNearbyCount } from "$lib/utils";

import MerchantListItem from "./MerchantListItem.svelte";
import { browser } from "$app/environment";

// Compute once for all list items
const verifiedDate = calcVerifiedDate();

// Get translated category label
function getCategoryLabel(key: CategoryKey): string {
	const labelMap: Record<CategoryKey, string> = {
		all: $_("categories.all"),
		restaurants: $_("categories.restaurants"),
		shopping: $_("categories.shopping"),
		groceries: $_("categories.groceries"),
		coffee: $_("categories.coffee"),
		atms: $_("categories.atms"),
		hotels: $_("categories.hotels"),
		beauty: $_("categories.beauty"),
	};
	return labelMap[key];
}

// Callback to pan to a nearby merchant (already zoomed in, just center it)
export let onPanToNearbyMerchant: ((place: Place) => void) | undefined =
	undefined;
// Callback to zoom to a search result (may be far away, need to fly there)
export let onZoomToSearchResult: ((place: Place) => void) | undefined =
	undefined;
// Callbacks for hover highlighting
export let onHoverStart: ((place: Place) => void) | undefined = undefined;
export let onHoverEnd: ((place: Place) => void) | undefined = undefined;
// Current zoom level to determine if we should show "zoom in" message
export let currentZoom: number = 0;
// Search callback - called when user types in search input
export let onSearch: ((query: string) => void) | undefined = undefined;
// Mode change callback (called for nearby mode switch)
export let onModeChange: ((mode: MerchantListMode) => void) | undefined =
	undefined;
// Refresh callback for category filtering
export let onRefresh: (() => void) | undefined = undefined;
// Callback to fit map bounds to all search results
export let onFitSearchResultBounds: (() => void) | undefined = undefined;

// Reference for search input component
let searchInputComponent: SearchInput;

// Local filter for nearby mode (client-side filtering by name)
let nearbyFilter = "";

// Body scroll lock for mobile (prevents iOS background scroll)
let scrollLockActive = false;

// Reference for focus trap
let panelElement: HTMLElement;

// Unified input handler - behaves differently based on mode
function handleUnifiedInput(e: Event) {
	const value = (e.target as HTMLInputElement).value;
	if (mode === "search") {
		merchantList.setSearchQuery(value);
		onSearch?.($merchantList.searchQuery);
	} else {
		nearbyFilter = value;
	}
}

// Unified keydown handler
function handleUnifiedKeyDown(event: KeyboardEvent) {
	if (event.key === "Escape") {
		event.preventDefault();
		event.stopPropagation();
		if (mode === "search" && searchQuery) {
			handleClearInput();
		} else if (mode === "nearby" && nearbyFilter) {
			handleClearInput();
		} else {
			handleClose();
		}
	} else if (
		event.key === "Enter" &&
		mode === "nearby" &&
		nearbyFilter.length >= 3
	) {
		// Switch to worldwide search on Enter in nearby mode
		trackEvent("search_query");
		merchantList.setSearchQuery(nearbyFilter);
		merchantList.setMode("search");
		onSearch?.(nearbyFilter);
		nearbyFilter = "";
	}
}

// Clear the current input (works for both modes)
function handleClearInput() {
	if (mode === "search") {
		merchantList.clearSearchInput();
		onSearch?.("");
	} else {
		nearbyFilter = "";
	}
	searchInputComponent?.focus();
}

function handleModeSwitch(newMode: MerchantListMode) {
	if (newMode === mode) return;
	// Clear both filters when switching modes
	nearbyFilter = "";
	if (newMode === "nearby") {
		trackEvent("nearby_mode_click", { source: "panel" });
		merchantList.exitSearchMode();
		onModeChange?.(newMode);
	} else {
		trackEvent("worldwide_mode_click", { source: "panel" });
		merchantList.setMode(newMode);
		// Focus search input when switching to worldwide
		tick().then(() => searchInputComponent?.focus());
	}
}

function handleCategorySelect(category: CategoryKey) {
	// Guard against clicks on disabled buttons (Svelte fires click even when disabled)
	if (!hasMatchingMerchants(category, categoryCounts)) return;
	trackEvent("category_filter", { category, mode });
	merchantList.setSelectedCategory(category);
	// Only refresh in nearby mode - search mode filters client-side
	if (mode === "nearby") {
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

// Location button state
let locationRequestDismissed = false;
let isLoadingLocation = false;
let locationAnnouncement = "";
let locationButton: HTMLButtonElement;
let merchantListContainer: HTMLDivElement;

async function handleEnableLocation() {
	isLoadingLocation = true;
	try {
		const location = await userLocation.getLocationWithCache();
		if (location) {
			merchantList.reSortByUserLocation();
			locationAnnouncement = $_("search.locationEnabled");
			await tick();
			merchantListContainer?.focus();
		}
	} catch (error) {
		if (error instanceof GeolocationPositionError) {
			if (error.code === error.PERMISSION_DENIED) {
				errToast($_("search.locationPermissionDenied"));
			} else {
				errToast($_("search.locationUnavailable"));
			}
		} else {
			errToast($_("search.locationUnavailable"));
		}
		await tick();
		locationButton?.focus();
	} finally {
		isLoadingLocation = false;
	}
}

function handleDismissLocation() {
	locationRequestDismissed = true;
}

// Filter search results by category
$: filteredSearchResults =
	selectedCategory === "all"
		? searchResults
		: searchResults.filter((p) => placeMatchesCategory(p, selectedCategory));

// Helper function to check if a category has matching merchants
// Note: counts param required for Svelte reactivity (indirect deps aren't tracked)
function hasMatchingMerchants(
	categoryKey: CategoryKey,
	counts: CategoryCounts,
): boolean {
	if (categoryKey === "all") return true;
	return (counts?.[categoryKey] ?? 0) > 0;
}

// Helper function to get category button classes
// Note: categoryCounts param required for Svelte reactivity (indirect deps aren't tracked)
function getCategoryButtonClass(
	key: CategoryKey,
	selectedCategory: CategoryKey,
	counts: CategoryCounts,
): string {
	if (selectedCategory === key) return "bg-primary text-white";
	const hasMatches = key === "all" || (counts?.[key] ?? 0) > 0;
	if (hasMatches) {
		return "bg-gray-100 text-body hover:bg-gray-200 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10";
	}
	return "cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-white/30";
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
		document.body.style.overflow = "hidden";
		scrollLockActive = true;
	} else if (!shouldLock && scrollLockActive) {
		document.body.style.overflow = "";
		scrollLockActive = false;
	}
}

// Focus search input when panel opens (always, since we now have unified search)
$: if (browser && isOpen && searchInputComponent) {
	tick().then(() => searchInputComponent?.focus());
}

function handleItemClick(place: Place) {
	trackEvent("merchant_list_item_click", { mode });
	merchantDrawer.open(place.id, "details");

	if (mode === "search") {
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
	nearbyFilter = ""; // Clear filter when closing
	merchantList.close();
}

function handleWindowKeydown(event: KeyboardEvent) {
	if (!isOpen) return;

	// Focus trap: cycle Tab within the panel to prevent focus escaping to background
	if (event.key === "Tab" && panelElement) {
		const focusable = panelElement.querySelectorAll<HTMLElement>(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
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

	if (event.key === "Escape") {
		event.preventDefault();
		handleClose();
	}
}

// Cleanup scroll lock when component is destroyed
onDestroy(() => {
	if (browser && scrollLockActive) {
		document.body.style.overflow = "";
	}
});
</script>

<svelte:window on:keydown={handleWindowKeydown} />

{#if isOpen}
	<section
		bind:this={panelElement}
		class="pb-safe absolute inset-0 z-[1001] flex flex-col overflow-hidden bg-white md:absolute md:inset-auto md:top-3 md:bottom-4 md:left-3 md:w-80 md:rounded-lg md:pb-0 md:shadow-lg dark:bg-dark dark:shadow-black/30"
		role="complementary"
		aria-label={$_('aria.merchantList')}
	>
		<!-- Screen reader announcement for location changes -->
		{#if locationAnnouncement}
			<p class="sr-only" aria-live="polite">{locationAnnouncement}</p>
		{/if}
		<!-- Search input - uses shared SearchInput component -->
		<div class="shrink-0 border-b border-gray-100 dark:border-white/10">
			<SearchInput
				bind:this={searchInputComponent}
				value={mode === 'search' ? searchQuery : nearbyFilter}
				placeholder={mode === 'search'
					? $_('search.placeholderWorldwide')
					: $_('search.placeholderNearby')}
				ariaLabel={mode === 'search' ? $_('search.switchToWorldwide') : $_('search.filterResults')}
				on:input={handleUnifiedInput}
				on:keydown={handleUnifiedKeyDown}
			>
				<svelte:fragment slot="trailing">
					{#if (mode === 'search' && searchQuery) || (mode === 'nearby' && nearbyFilter)}
						<button
							type="button"
							on:click={handleClearInput}
							class="p-1 text-gray-600 hover:text-gray-800 dark:text-white/70 dark:hover:text-white"
							aria-label={$_('aria.clearSearch')}
						>
							<Icon w="20" h="20" icon="close" type="material" />
						</button>
					{:else}
						<button
							type="button"
							on:click={handleClose}
							class="p-1 text-gray-600 hover:text-gray-800 dark:text-white/70 dark:hover:text-white"
							aria-label={$_('aria.closeMerchantList')}
						>
							<Icon w="20" h="20" icon="close" type="material" />
						</button>
					{/if}
				</svelte:fragment>
			</SearchInput>
		</div>

		<!-- Filters and controls -->
		<div class="shrink-0 border-b border-gray-100 px-3 py-3 dark:border-white/10">
			<!-- Mode toggle buttons -->
			<div
				class="flex rounded-lg bg-gray-100 p-1 dark:bg-white/5"
				role="radiogroup"
				aria-label={$_('aria.switchMode')}
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
					{$_('search.worldwide')}
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
					{$_('search.nearby')}{#if isLoadingList}<span class="opacity-60">
							...</span
						>{:else}{formatNearbyCount(totalCount)}{/if}
				</button>
			</div>

			<!-- Category filter (shown in both nearby and search modes) -->
			<div class="mt-3" role="radiogroup" aria-label={$_('aria.filterByCategory')}>
				<h3 class="sr-only">{$_('categories.filter')}</h3>
				<div class="flex flex-wrap gap-2">
					{#each CATEGORY_ENTRIES as [key, _category] (key)}
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
							{getCategoryLabel(key)}
						</button>
					{/each}
				</div>
			</div>

			<!-- Status row -->
			<div class="mt-3 flex items-center justify-between gap-2">
				<p class="text-xs text-body dark:text-white/70" aria-live="polite">
					{#if mode === 'search'}
						{#if isSearching}
							{$_('search.searching')}
						{:else if searchResults.length === 0 && searchQuery.length >= 3}
							{$_('search.noResults')}
						{:else if searchResults.length === 0}
							{$_('search.prompt')}
						{:else if selectedCategory !== 'all' && filteredSearchResults.length !== searchResults.length}
							{filteredSearchResults.length} of {searchResults.length} result{searchResults.length !==
							1
								? 's'
								: ''}
						{:else}
							{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
						{/if}
					{:else if showZoomInMessage}
						{$_('search.zoomIn')}
					{:else if isTruncated}
						{$_('search.showingNearest', { values: { count: merchants.length } })}
					{/if}
				</p>
				{#if mode === 'search'}
					<button
						type="button"
						on:click={() => {
							trackEvent('show_all_on_map_click');
							onFitSearchResultBounds?.();
						}}
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
						<span>{$_('search.showAll')}</span>
					</button>
				{/if}
			</div>

			<!-- Location enable button - nearby mode only -->
			{#if mode === 'nearby' && !$userLocation.location && !locationRequestDismissed}
				<div class="mt-3 flex items-center gap-2 rounded-lg border border-gray-200 p-2 dark:border-white/10">
					<button
						bind:this={locationButton}
						type="button"
						on:click={handleEnableLocation}
						disabled={isLoadingLocation}
						class="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-white/5"
						aria-label={$_('search.enablePreciseDistances')}
					>
						{#if isLoadingLocation}
							<LoadingSpinner color="text-primary dark:text-white" size="h-4 w-4" />
						{:else}
							<Icon w="16" h="16" icon="my_location" type="material" class="text-primary dark:text-white" />
						{/if}
						<span class="text-primary dark:text-white">{$_('search.enablePreciseDistances')}</span>
					</button>
					<button
						type="button"
						on:click={handleDismissLocation}
						class="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
						aria-label={$_('search.clear')}
					>
						<Icon w="16" h="16" icon="close" type="material" />
					</button>
				</div>
			{/if}
		</div>

		<!-- List content -->
		<div
			bind:this={merchantListContainer}
			class="flex-1 overflow-y-auto"
			tabindex="-1"
		>
			{#if mode === 'search'}
				<!-- Search results -->
				{#if isSearching}
					<div
						class="flex items-center justify-center py-8"
						role="status"
						aria-label={$_('search.searching')}
					>
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
								{$_('search.noResultsFor', { values: { query: searchQuery } })}
							{:else}
								{$_('search.prompt')}
							{/if}
						</p>
					</div>
				{:else if filteredSearchResults.length === 0}
					<!-- Has results but none match category filter -->
					<div class="px-3 py-8 text-center text-sm text-body dark:text-white/70">
						{$_('categories.noMatches')}
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
							{$_('search.zoomIn')}
						</p>
						<p class="mt-1 text-xs text-body dark:text-white/70">
							{$_('search.zoomInDetail')}
						</p>
					</div>
				</div>
			{:else if isLoadingList}
				<div
					class="flex items-center justify-center py-8"
					role="status"
					aria-label={$_('aria.loading')}
				>
					<LoadingSpinner color="text-link dark:text-white" size="h-6 w-6" />
				</div>
			{:else if merchants.length === 0}
				<div class="px-3 py-8 text-center text-sm text-body dark:text-white/70">
					{$_('search.noVisible')}
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
						{$_('search.noResultsFor', { values: { query: nearbyFilter } })}
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

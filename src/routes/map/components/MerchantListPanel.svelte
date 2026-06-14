<script lang="ts">
import { onDestroy, onMount, tick } from "svelte";
import { get } from "svelte/store";

import Icon from "$components/Icon.svelte";
import LoadingSpinner from "$components/LoadingSpinner.svelte";
import SearchInput from "$components/SearchInput.svelte";
import { trackEvent } from "$lib/analytics";
import { lockBodyScroll, unlockBodyScroll } from "$lib/bodyScrollLock";
import {
	CATEGORY_ENTRIES,
	type CategoryCounts,
	type CategoryKey,
	placeMatchesCategory,
} from "$lib/categoryMapping";
import {
	MERCHANT_LIST_LOW_ZOOM,
	MERCHANT_LIST_MAX_ITEMS,
} from "$lib/constants";
import { SEARCH_SHEET_PEEK_HEIGHT } from "$lib/drawerConfig";
import { createDrawerGestureController } from "$lib/drawerGestureController";
import { _ } from "$lib/i18n";
import { merchantDrawer } from "$lib/merchantDrawerStore";
import type { MerchantListMode } from "$lib/merchantListStore";
import { merchantList } from "$lib/merchantListStore";
import type { Place } from "$lib/types";
import { userLocation } from "$lib/userLocationStore";
import { errToast, formatNearbyCount, formatNearbyPillCount } from "$lib/utils";

import MerchantListItem from "./MerchantListItem.svelte";
import NearbyCountPill from "./NearbyCountPill.svelte";
import { browser } from "$app/environment";

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
// Callback to zoom to nearby level (when user clicks "zoom in" message)
export let onZoomToNearbyLevel: (() => void) | undefined = undefined;
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
// Map style readiness — gates the mobile peek sheet so it doesn't show over the loading screen
export let mapReady = false;
// Layout decision locked at page init (same pattern as MerchantDrawerHash);
// shared with the floating search bar so exactly one search surface exists
export let isMobile = false;

// On mobile the panel is a bottom sheet mirroring the merchant drawer's
// snap behavior: peek (grabber + single input) <-> full panel. The store's
// isOpen IS the expanded state; peek = closed, so close() keeping
// merchants/totalCount keeps the count pill populated at rest.
const sheetGesture = createDrawerGestureController({
	peekHeight: SEARCH_SHEET_PEEK_HEIGHT,
	canDismiss: false,
	events: {
		expand: "search_sheet_swipe_expand",
		collapse: "search_sheet_swipe_collapse",
	},
});
const sheetHeight = sheetGesture.drawerHeight;
const sheetExpanded = sheetGesture.expanded;

let grabberElement: HTMLElement;

// gesture → store (sheet snapped by finger)
const unsubscribeSheet = sheetGesture.expanded.subscribe((expanded) => {
	if (!isMobile) return;
	const open = get(merchantList).isOpen;
	if (expanded && !open) {
		merchantList.open();
		onRefresh?.();
	} else if (!expanded && open) {
		merchantList.close();
	}
});

function handlePeekTap() {
	// A drag on the facade can fire a click after the gesture already
	// expanded the sheet — don't double-open or double-track
	if (get(merchantList).isOpen) return;
	trackEvent("search_sheet_tap_expand");
	merchantList.open();
	onRefresh?.();
}

function handleGrabberKeydown(event: KeyboardEvent) {
	if (event.key === "Enter" || event.key === " ") {
		event.preventDefault();
		if (isOpen) {
			handleClose();
		} else {
			handlePeekTap();
		}
	}
}

function onSheetPointerDown(event: PointerEvent) {
	sheetGesture.handlePointerDown(event, grabberElement);
}
function onSheetPointerUp(event: PointerEvent) {
	sheetGesture.handlePointerUp(event, grabberElement);
}
// The whole peek facade is a swipe surface, not just the grabber strip
let facadeElement: HTMLElement;
function onFacadePointerDown(event: PointerEvent) {
	sheetGesture.handlePointerDown(event, facadeElement);
}
function onFacadePointerUp(event: PointerEvent) {
	sheetGesture.handlePointerUp(event, facadeElement);
}

// Expanded header (input row + toggle/chips) drags the sheet too. A small
// vertical slop decides tap-vs-drag so the input, mode toggle and category
// chips stay tappable; past the slop the gesture controller takes over and
// captures the pointer (so releasing a drag over a chip doesn't click it).
const HEADER_DRAG_SLOP = 8;
let headerDragStartY: number | null = null;
let headerDragging = false;

function onHeaderPointerDown(event: PointerEvent) {
	if (!isMobile) return;
	headerDragStartY = event.clientY;
	headerDragging = false;
}
function onHeaderPointerMove(event: PointerEvent) {
	if (!isMobile || headerDragStartY === null) return;
	if (!headerDragging) {
		if (Math.abs(event.clientY - headerDragStartY) < HEADER_DRAG_SLOP) return;
		headerDragging = true;
		sheetGesture.handlePointerDown(event, event.currentTarget as HTMLElement);
	} else {
		sheetGesture.handlePointerMove(event);
	}
}
function onHeaderPointerUp(event: PointerEvent) {
	if (headerDragging) {
		sheetGesture.handlePointerUp(event, event.currentTarget as HTMLElement);
	}
	headerDragStartY = null;
	headerDragging = false;
}
function onHeaderPointerCancel(event: PointerEvent) {
	if (headerDragging) {
		sheetGesture.handlePointerCancel(event);
	}
	headerDragStartY = null;
	headerDragging = false;
}
function onContentTouchStart(event: TouchEvent) {
	if (isMobile) sheetGesture.handleContentTouchStart(event);
}
function onContentTouchMove(event: TouchEvent) {
	if (isMobile)
		sheetGesture.handleContentTouchMove(
			event,
			merchantListContainer?.scrollTop ?? 0,
		);
}
function onContentTouchEnd() {
	if (isMobile) sheetGesture.handleContentTouchEnd();
}

onMount(() => {
	if (!isMobile) return;
	const updateExpandedHeight = () =>
		sheetGesture.setExpandedHeight(window.innerHeight);
	updateExpandedHeight();
	window.addEventListener("resize", updateExpandedHeight);
	return () => window.removeEventListener("resize", updateExpandedHeight);
});

// Reference for search input component
let searchInputComponent: SearchInput;

// Local filter for nearby mode (client-side filtering by name)
let nearbyFilter = "";

// Body scroll lock state for mobile (prevents iOS background scroll)
let scrollLockActive = false;

// Reference for focus trap
let panelElement: HTMLElement;

function handleSearchFocus() {
	trackEvent("search_input_focus", { source: "panel" });
}

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
	if (newMode === "nearby") {
		trackEvent("nearby_mode_click", { source: "panel" });
		const carryOver = $merchantList.searchQuery;
		merchantList.exitSearchMode();
		nearbyFilter = carryOver;
		onModeChange?.(newMode);
		tick().then(() => searchInputComponent?.focus());
	} else {
		trackEvent("worldwide_mode_click", { source: "panel" });
		const carryOver = nearbyFilter;
		nearbyFilter = "";
		merchantList.setSearchQuery(carryOver);
		merchantList.setMode("search");
		if (carryOver.length >= 3) {
			onSearch?.(carryOver);
		}
		tick().then(() => searchInputComponent?.focus());
	}
}

function handleSearchWorldwideCta() {
	trackEvent("search_worldwide_cta_click");
	handleModeSwitch("search");
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
$: allMerchants = $merchantList.allMerchants;
$: totalCount = $merchantList.totalCount;

// Any close path (Escape, X button, item tap, swipe-collapse) resets the
// local name filter so reopening always starts clean
$: if (!isOpen) {
	nearbyFilter = "";
}

// store → gesture (open/close from peek tap, item click, Escape, search)
$: if (isMobile) {
	if (isOpen && !$sheetExpanded) {
		sheetGesture.expand();
	} else if (!isOpen && $sheetExpanded) {
		sheetGesture.collapse();
	}
}

// Peek sheet is the mobile resting state; it yields the bottom edge to the
// merchant drawer (mirrors the old floating bar's max-md:hidden rule)
$: showPeekSheet = isMobile && mapReady && !$merchantDrawer.isOpen;

// The drawer taking the bottom edge can unmount the sheet mid-drag, which
// would strand the captured pointer and the spring height. Reset so the
// sheet remounts cleanly at peek (mirrors MerchantDrawerMobile's
// resetToPeek-on-merchant-change).
$: if (isMobile && $merchantDrawer.isOpen) {
	sheetGesture.resetToPeek();
}
$: pillCount = formatNearbyPillCount(totalCount);
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
	trackEvent("enable_precise_distances_click");
	try {
		await userLocation.getLocationWithCache();
		merchantList.reSortByUserLocation();
		locationAnnouncement = $_("search.locationEnabled");
		await tick();
		merchantListContainer?.focus();
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

// Nearby-mode client-side name filter — searches the full fetched set
// (allMerchants, up to the fetch ceiling), not just the 99 displayed rows,
// so a match ranked beyond the display cap isn't reported as "nothing nearby"
$: filteredMerchants = nearbyFilter
	? allMerchants.filter((m) => {
			const enriched = placeDetailsCache.get(m.id);
			const name = enriched?.name || m.name || "";
			return name.toLowerCase().includes(nearbyFilter.toLowerCase());
		})
	: merchants;
// Display stays capped at the usual list size
$: displayedMerchants = nearbyFilter
	? filteredMerchants.slice(0, MERCHANT_LIST_MAX_ITEMS)
	: filteredMerchants;
// While filtering, the tab shows the true match count — even (0), which signals "try worldwide"
$: nearbyTabCount = nearbyFilter
	? `(${formatNearbyPillCount(filteredMerchants.length) || "0"})`
	: formatNearbyCount(totalCount);

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

// Show "zoom in" prompt when:
// 1. Below the list floor (no data fetched at this zoom)
// 2. Results were blanked because the area is too dense (>fetch ceiling):
//    an empty list but a non-zero total count
// A genuinely empty area (totalCount === 0) falls through to the
// "No merchants visible in current view" body state instead.
$: showZoomInMessage =
	currentZoom < MERCHANT_LIST_LOW_ZOOM ||
	(merchants.length === 0 && totalCount > 0);
$: isTruncated = totalCount > merchants.length;

// Body scroll lock on mobile when panel is open
$: if (browser && isOpen !== undefined) {
	const shouldLock = isOpen && isMobile;
	if (shouldLock && !scrollLockActive) {
		lockBodyScroll();
		scrollLockActive = true;
	} else if (!shouldLock && scrollLockActive) {
		unlockBodyScroll();
		scrollLockActive = false;
	}
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
	if (isMobile) {
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
	merchantList.close();
}

function handleZoomToNearbyLevel() {
	onZoomToNearbyLevel?.();
	// Close panel on mobile so the user can see the map zoom in
	if (isMobile) {
		handleClose();
	}
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
	unsubscribeSheet();
	if (browser && scrollLockActive) {
		unlockBodyScroll();
		scrollLockActive = false;
	}
});
</script>

<svelte:window on:keydown={handleWindowKeydown} />

{#if isOpen || showPeekSheet}
	<section
		bind:this={panelElement}
		class="z-[1001] flex flex-col overflow-hidden bg-white dark:bg-dark
			{isMobile
			? 'fixed right-0 bottom-0 left-0 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl'
			: 'absolute top-3 bottom-[max(3rem,env(safe-area-inset-bottom))] left-3 w-80 rounded-lg shadow-lg dark:shadow-black/30'}"
		class:rounded-t-3xl={isMobile && !isOpen}
		style={isMobile
			? `height: calc(${$sheetHeight}px + env(safe-area-inset-bottom)); max-height: 100dvh; will-change: height;`
			: ''}
		role="complementary"
		aria-label={$_('aria.merchantList')}
	>
		<!-- Drag handle (mobile sheet only) -->
		{#if isMobile}
			<div
				bind:this={grabberElement}
				class="flex-shrink-0 touch-none"
				on:pointerdown={onSheetPointerDown}
				on:pointermove={sheetGesture.handlePointerMove}
				on:pointerup={onSheetPointerUp}
				on:pointercancel={sheetGesture.handlePointerCancel}
				on:keydown={handleGrabberKeydown}
				tabindex={isOpen ? 0 : -1}
				role="button"
				aria-label={isOpen ? $_('aria.closeMerchantList') : $_('aria.expandMerchantList')}
				aria-expanded={isOpen}
				aria-controls="merchant-sheet-content"
				aria-hidden={!isOpen}
			>
				<div class="mx-auto mt-2 mb-1 h-1.5 w-12 rounded-full bg-gray-300 dark:bg-white/30"></div>
			</div>
		{/if}

		{#if isOpen}
		<!-- Screen reader announcement for location changes -->
		{#if locationAnnouncement}
			<p class="sr-only" aria-live="polite">{locationAnnouncement}</p>
		{/if}
		<!-- Search input - uses shared SearchInput component.
		     On mobile the row doubles as a sheet drag surface (tap-vs-drag slop). -->
		<div
			class="shrink-0 border-b border-gray-100 dark:border-white/10"
			class:touch-none={isMobile}
			on:pointerdown={onHeaderPointerDown}
			on:pointermove={onHeaderPointerMove}
			on:pointerup={onHeaderPointerUp}
			on:pointercancel={onHeaderPointerCancel}
		>
			<SearchInput
				bind:this={searchInputComponent}
				value={mode === 'search' ? searchQuery : nearbyFilter}
				placeholder={$_('search.placeholderPlaces')}
				ariaLabel={mode === 'search' ? $_('search.switchToWorldwide') : $_('search.filterResults')}
				on:input={handleUnifiedInput}
				on:keydown={handleUnifiedKeyDown}
				on:focus={handleSearchFocus}
			>
				<svelte:fragment slot="trailing">
					{#if (mode === 'search' && searchQuery) || (mode === 'nearby' && nearbyFilter)}
						<button
							type="button"
							on:click={handleClearInput}
							class="pointer-events-auto p-1 text-gray-600 hover:text-gray-800 dark:text-white/70 dark:hover:text-white"
							aria-label={$_('aria.clearSearch')}
						>
							<Icon w="20" h="20" icon="close" type="material" />
						</button>
					{:else if isMobile}
						<!-- Sheet collapses via grabber/drag; the count pill rides the input at rest -->
						{#if pillCount}
							<NearbyCountPill count={pillCount} />
						{/if}
					{:else}
						<button
							type="button"
							on:click={handleClose}
							class="pointer-events-auto p-1 text-gray-600 hover:text-gray-800 dark:text-white/70 dark:hover:text-white"
							aria-label={$_('aria.closeMerchantList')}
						>
							<Icon w="20" h="20" icon="close" type="material" />
						</button>
					{/if}
				</svelte:fragment>
			</SearchInput>
		</div>

		<!-- Filters and controls — also a sheet drag surface on mobile -->
		<div
			class="shrink-0 border-b border-gray-100 px-3 py-3 dark:border-white/10"
			class:touch-none={isMobile}
			on:pointerdown={onHeaderPointerDown}
			on:pointermove={onHeaderPointerMove}
			on:pointerup={onHeaderPointerUp}
			on:pointercancel={onHeaderPointerCancel}
		>
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
					class="flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors
						{mode === 'search'
						? 'bg-white text-primary shadow-sm dark:bg-white/10 dark:text-white'
						: 'text-body hover:text-primary dark:text-white/70 dark:hover:text-white'}"
				>
					<Icon type="fa" icon="globe" w="14" h="14" />
					{$_('search.worldwide')}
				</button>
				<button
					type="button"
					role="radio"
					on:click={() => handleModeSwitch('nearby')}
					aria-checked={mode === 'nearby'}
					class="flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors
						{mode === 'nearby'
						? 'bg-white text-primary shadow-sm dark:bg-white/10 dark:text-white'
						: 'text-body hover:text-primary dark:text-white/70 dark:hover:text-white'}"
				>
					<Icon type="fa" icon="list" w="14" h="14" />
					{$_('search.nearby')}{#if isLoadingList}<span class="opacity-60">
							...</span
						>{:else}{nearbyTabCount}{/if}
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
						<button
							on:click={handleZoomToNearbyLevel}
							class="text-link underline-offset-2 hover:underline dark:text-white"
							>{$_('search.zoomIn')}</button
						>
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
						aria-label={$_('search.dismissLocationPrompt')}
					>
						<Icon w="16" h="16" icon="close" type="material" />
					</button>
				</div>
			{/if}
		</div>

		<!-- List content (touch handlers: Google-Maps-style collapse drag from scroll top on mobile) -->
		<div
			bind:this={merchantListContainer}
			id="merchant-sheet-content"
			class="flex-1 overflow-y-auto"
			style="overscroll-behavior-y: contain; touch-action: pan-y;"
			tabindex="-1"
			on:touchstart={onContentTouchStart}
			on:touchmove={onContentTouchMove}
			on:touchend={onContentTouchEnd}
			on:touchcancel={onContentTouchEnd}
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
					<ul class="flex flex-col gap-2 bg-neutral-50 p-2 dark:bg-white/10">
						{#each filteredSearchResults as merchant (merchant.id)}
							<MerchantListItem
								{merchant}
								enrichedData={merchant}
								isSelected={selectedId === merchant.id}
								onclick={handleItemClick}
								onmouseenter={handleMouseEnter}
								onmouseleave={handleMouseLeave}
							/>
						{/each}
					</ul>
				{/if}
			{:else if showZoomInMessage && !isLoadingList}
				<!-- Nearby mode: clickable zoom in prompt (loading spinner takes
				     precedence so a stale count-only state can't flash this) -->
				<button
					type="button"
					on:click={handleZoomToNearbyLevel}
					class="group mx-2 mt-2 flex w-[calc(100%-1rem)] cursor-pointer flex-col items-center justify-center gap-3 rounded-lg px-4 py-12 text-center transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
				>
					<div
						class="rounded-full bg-link/10 p-3 transition-colors group-hover:bg-link/20 dark:bg-white/10 dark:group-hover:bg-white/20"
					>
						<Icon w="32" h="32" icon="zoom_in" type="material" class="text-link dark:text-white" />
					</div>
					<div>
						<p class="text-sm font-medium text-primary group-hover:text-link dark:text-white">
							{$_('search.zoomIn')}
						</p>
						<p class="mt-1 text-xs text-body dark:text-white/70">
							{$_('search.zoomInDetail')}
						</p>
					</div>
				</button>
			{:else if isLoadingList}
				<div
					class="flex items-center justify-center py-8"
					role="status"
					aria-label={$_('aria.loading')}
				>
					<LoadingSpinner color="text-link dark:text-white" size="h-6 w-6" />
				</div>
			{:else}
				<!-- Nearby mode: merchant list -->
				{#if merchants.length === 0}
					<div class="px-3 py-8 text-center text-sm text-body dark:text-white/70">
						{$_('search.noVisible')}
					</div>
				{:else if filteredMerchants.length === 0 && nearbyFilter}
					<!-- Filter matched nothing nearby: nudge toward worldwide instead of a blank list -->
					<div class="flex flex-col items-center justify-center gap-1 px-9 py-12 text-center">
						<div class="mb-2 grid h-14 w-14 place-items-center rounded-full bg-gray-100 dark:bg-white/5">
							<Icon w="26" h="26" icon="search" type="material" class="text-gray-400 dark:text-white/40" />
						</div>
						<p class="text-base font-semibold text-primary dark:text-white">
							{$_('search.noNearbyMatches', { values: { query: nearbyFilter } })}
						</p>
						<p class="mb-3 text-sm text-body dark:text-white/70">
							{$_('search.noNearbyMatchesHint')}
						</p>
						<button
							type="button"
							on:click={handleSearchWorldwideCta}
							class="inline-flex items-center gap-2 rounded-full bg-link px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-hover"
						>
							<Icon type="fa" icon="globe" w="16" h="16" />
							{$_('search.searchWorldwide')}
						</button>
					</div>
				{:else}
					<ul class="flex flex-col gap-2 bg-neutral-50 p-2 dark:bg-white/10">
						{#each displayedMerchants as merchant (merchant.id)}
							<MerchantListItem
								{merchant}
								enrichedData={placeDetailsCache.get(merchant.id) || null}
								isSelected={selectedId === merchant.id}
								onclick={handleItemClick}
								onmouseenter={handleMouseEnter}
								onmouseleave={handleMouseLeave}
							/>
						{/each}
					</ul>
				{/if}
			{/if}
		</div>
		{:else}
			<!-- Peek: input facade — opens the sheet without focusing a real input
			     (keyboard stays down until the user taps the real input and types).
			     The whole facade is also a swipe surface like the drawer's peek. -->
			<div id="merchant-sheet-content" class="px-3">
				<button
					bind:this={facadeElement}
					type="button"
					on:click={handlePeekTap}
					on:pointerdown={onFacadePointerDown}
					on:pointermove={sheetGesture.handlePointerMove}
					on:pointerup={onFacadePointerUp}
					on:pointercancel={sheetGesture.handlePointerCancel}
					class="relative flex w-full touch-none items-center rounded-lg py-3 pr-3 pl-10 text-left"
					aria-expanded="false"
				>
					<Icon
						w="18"
						h="18"
						icon="search"
						type="material"
						class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-600 dark:text-white/70"
					/>
					<span class="flex-1 truncate text-base text-gray-400 dark:text-white/50">
						{$_('search.placeholderPlaces')}
					</span>
					{#if pillCount}
						<NearbyCountPill count={pillCount} />
					{/if}
				</button>
			</div>
		{/if}
	</section>
{/if}

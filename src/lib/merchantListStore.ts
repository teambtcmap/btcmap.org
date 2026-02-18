import axios from "axios";
import { get, writable } from "svelte/store";

import { buildFieldsParam, PLACE_FIELD_SETS } from "$lib/api-fields";
import {
	type CategoryCounts,
	type CategoryKey,
	countMerchantsByCategory,
	createEmptyCategoryCounts,
	filterMerchantsByCategory,
} from "$lib/categoryMapping";
import { MERCHANT_LIST_MAX_ITEMS } from "$lib/constants";
import { isBoosted } from "$lib/merchantDrawerLogic";
import type { Place } from "$lib/types";
import type { UserLocation } from "$lib/userLocationStore";
import { userLocation } from "$lib/userLocationStore";
import { calculateDistance, errToast } from "$lib/utils";

export type MerchantListMode = "nearby" | "search";

export interface MerchantListState {
	isOpen: boolean;
	merchants: Place[];
	totalCount: number;
	// Cache of full Place data by ID, used to show icons/addresses without re-fetching
	placeDetailsCache: Map<number, Place>;
	// True when fetching/replacing the merchant list (shows spinner)
	isLoadingList: boolean;
	// True when fetching enriched details in background (no spinner)
	isEnrichingDetails: boolean;
	// Panel mode: 'nearby' for location-based list, 'search' for search results
	mode: MerchantListMode;
	// Search state
	searchQuery: string;
	searchResults: Place[];
	isSearching: boolean;
	// Category filter
	selectedCategory: CategoryKey;
	categoryCounts: CategoryCounts;
}

const initialState: MerchantListState = {
	isOpen: false,
	merchants: [],
	totalCount: 0,
	placeDetailsCache: new Map(),
	isLoadingList: false,
	isEnrichingDetails: false,
	mode: "nearby",
	searchQuery: "",
	searchResults: [],
	isSearching: false,
	selectedCategory: "all",
	categoryCounts: createEmptyCategoryCounts(),
};

// Helper function to reset category state
function resetCategoryState<T extends MerchantListState>(state: T): T {
	return { ...state, selectedCategory: "all" };
}

// Helper to apply category filtering with auto-reset when selected category has no matches
// Returns filtered merchants and the effective category (may be reset to 'all')
function applyCategoryFilter(
	merchants: Place[],
	selectedCategory: CategoryKey,
	categoryCounts: CategoryCounts,
): { filtered: Place[]; effectiveCategory: CategoryKey } {
	// Auto-reset if selected category has no matches but other merchants exist
	const shouldReset =
		selectedCategory !== "all" &&
		categoryCounts.all > 0 &&
		categoryCounts[selectedCategory] === 0;

	const effectiveCategory = shouldReset ? "all" : selectedCategory;

	const filtered =
		effectiveCategory !== "all"
			? filterMerchantsByCategory(merchants, effectiveCategory)
			: merchants;

	return { filtered, effectiveCategory };
}

// Sort order: boosted merchants first (premium placement), then by distance, then alphabetically
function sortMerchants(
	merchants: Place[],
	centerLat?: number,
	centerLon?: number,
	userLoc?: UserLocation | null,
): Place[] {
	// Use user location if available, otherwise fall back to map center
	const sortLat = userLoc?.lat ?? centerLat;
	const sortLon = userLoc?.lon ?? centerLon;

	// Precompute distances once per merchant to avoid redundant trig inside the comparator
	const distanceMap =
		sortLat !== undefined && sortLon !== undefined
			? new Map(
					merchants.map((m) => [
						m.id,
						calculateDistance(sortLat, sortLon, m.lat, m.lon),
					]),
				)
			: null;

	return [...merchants].sort((a, b) => {
		// Boosted first
		if (isBoosted(a) && !isBoosted(b)) return -1;
		if (!isBoosted(a) && isBoosted(b)) return 1;

		// Then by distance
		if (distanceMap) {
			return (distanceMap.get(a.id) ?? 0) - (distanceMap.get(b.id) ?? 0);
		}

		// Fallback to alphabetical
		return (a.name || "").localeCompare(b.name || "");
	});
}

// Filter out invalid API response items missing required id field
function filterValidPlaces<T extends { id?: unknown }>(items: T[]): T[] {
	return items.filter((item): item is T => typeof item?.id === "number");
}

function createMerchantListStore() {
	const store = writable<MerchantListState>(initialState);
	const { subscribe, set, update } = store;

	// Separate abort controllers so list and detail fetches don't cancel each other
	let listAbortController: AbortController | null = null;
	let detailsAbortController: AbortController | null = null;

	function cancelListRequest() {
		if (listAbortController) {
			listAbortController.abort();
			listAbortController = null;
		}
	}

	function cancelDetailsRequest() {
		if (detailsAbortController) {
			detailsAbortController.abort();
			detailsAbortController = null;
		}
	}

	function cancelAllRequests() {
		cancelListRequest();
		cancelDetailsRequest();
	}

	return {
		subscribe,

		open() {
			update((state) => ({ ...state, isOpen: true }));
		},

		// Hide the panel, reset category filter and search state, but keep merchant data (count visible on button)
		close() {
			update((state) => ({
				...resetCategoryState(state),
				isOpen: false,
				mode: "nearby",
				searchQuery: "",
				searchResults: [],
				isSearching: false,
			}));
		},

		// Set merchants from locally-loaded markers (used at zoom 15-16)
		setMerchants(
			merchants: Place[],
			centerLat?: number,
			centerLon?: number,
			limit: number = MERCHANT_LIST_MAX_ITEMS,
		) {
			const categoryCounts = countMerchantsByCategory(merchants);
			const { selectedCategory } = get(store);
			const { filtered, effectiveCategory } = applyCategoryFilter(
				merchants,
				selectedCategory,
				categoryCounts,
			);

			const sorted = sortMerchants(
				filtered,
				centerLat,
				centerLon,
				get(userLocation).location,
			);
			const limited = sorted.slice(0, limit);

			update((state) => ({
				...state,
				merchants: limited,
				totalCount: filtered.length,
				isLoadingList: false,
				categoryCounts,
				selectedCategory: effectiveCategory,
			}));
		},

		// Fetch merchants from API and replace the current list
		// Used at high zoom (17+) and low zoom (11-14) where we can't rely on loaded markers
		// hideIfExceeds: if API returns more than this, clear the list (shows "zoom in" message)
		async fetchAndReplaceList(
			center: { lat: number; lon: number },
			radiusKm: number,
			options?: { hideIfExceeds?: number },
		) {
			cancelListRequest();
			listAbortController = new AbortController();

			// Keep previous merchants visible while loading (prevents flicker)
			update((state) => ({ ...state, isLoadingList: true }));

			try {
				const fields = buildFieldsParam(PLACE_FIELD_SETS.LIST_ITEM);
				const response = await axios.get<Place[]>(
					`https://api.btcmap.org/v4/places/search/?lat=${center.lat}&lon=${center.lon}&radius_km=${radiusKm}&fields=${fields}`,
					{ timeout: 10000, signal: listAbortController.signal },
				);

				// Validate response is an array (API may return HTML error page)
				if (!Array.isArray(response.data)) {
					throw new Error("API returned invalid data format");
				}

				// Filter out invalid items missing required id field
				const validPlaces = filterValidPlaces(response.data);

				// Build cache for enriched display (icons, addresses, etc.)
				const placeDetailsCache = new Map<number, Place>();
				validPlaces.forEach((place) => placeDetailsCache.set(place.id, place));

				const categoryCounts = countMerchantsByCategory(validPlaces);

				// Check if we should hide results (too many at low zoom)
				if (
					options?.hideIfExceeds &&
					validPlaces.length > options.hideIfExceeds
				) {
					// Too many results - store count but show empty list
					// The panel will display "zoom in" message, button shows count
					update((state) => ({
						...state,
						merchants: [],
						totalCount: validPlaces.length,
						isLoadingList: false,
						categoryCounts,
					}));
				} else {
					const { selectedCategory } = get(store);
					const { filtered, effectiveCategory } = applyCategoryFilter(
						validPlaces,
						selectedCategory,
						categoryCounts,
					);

					const sorted = sortMerchants(
						filtered,
						center.lat,
						center.lon,
						get(userLocation).location,
					);
					const limited = sorted.slice(0, MERCHANT_LIST_MAX_ITEMS);
					update((state) => ({
						...state,
						merchants: limited,
						totalCount: filtered.length,
						placeDetailsCache,
						isLoadingList: false,
						categoryCounts,
						selectedCategory: effectiveCategory,
					}));
				}
			} catch (error) {
				if (error instanceof Error && error.name !== "AbortError") {
					console.warn("Failed to fetch merchant list:", error.message);
					errToast("Failed to load nearby merchants");
				}
				update((state) => ({ ...state, isLoadingList: false }));
			}
		},

		// Fetch only IDs to get count (minimal payload for button badge)
		// Used at zoom 11-14 when panel is closed - avoids fetching full data unnecessarily
		async fetchCountOnly(
			center: { lat: number; lon: number },
			radiusKm: number,
		) {
			cancelListRequest();
			listAbortController = new AbortController();

			update((state) => ({ ...state, isLoadingList: true }));

			try {
				const response = await axios.get<{ id: number }[]>(
					`https://api.btcmap.org/v4/places/search/?lat=${center.lat}&lon=${center.lon}&radius_km=${radiusKm}&fields=id`,
					{ timeout: 10000, signal: listAbortController.signal },
				);

				// Validate response is an array (API may return HTML error page)
				if (!Array.isArray(response.data)) {
					throw new Error("API returned invalid data format");
				}

				// Filter out invalid items missing required id field
				const validItems = filterValidPlaces(response.data);

				update((state) => ({
					...state,
					merchants: [],
					totalCount: validItems.length,
					isLoadingList: false,
					// Preserve existing categoryCounts since we don't have actual merchant data to recalculate them
				}));
			} catch (error) {
				if (error instanceof Error && error.name !== "AbortError") {
					console.warn("Failed to fetch merchant count:", error.message);
				}
				update((state) => ({ ...state, isLoadingList: false }));
			}
		},

		// Fetch full Place data to enrich existing list items (doesn't change the list)
		// Used at zoom 15-16 when panel is open - adds icons/addresses to skeleton items
		// Runs silently in background without showing spinner
		async fetchEnrichedDetails(
			center: { lat: number; lon: number },
			radiusKm: number,
		) {
			cancelDetailsRequest();
			detailsAbortController = new AbortController();

			update((state) => ({ ...state, isEnrichingDetails: true }));

			try {
				const fields = buildFieldsParam(PLACE_FIELD_SETS.LIST_ITEM);
				const response = await axios.get<Place[]>(
					`https://api.btcmap.org/v4/places/search/?lat=${center.lat}&lon=${center.lon}&radius_km=${radiusKm}&fields=${fields}`,
					{ timeout: 10000, signal: detailsAbortController.signal },
				);

				// Filter out invalid items and merge into existing cache
				const validPlaces = filterValidPlaces(response.data);
				update((state) => {
					const mergedCache = new Map(state.placeDetailsCache);
					validPlaces.forEach((place) => mergedCache.set(place.id, place));
					return {
						...state,
						placeDetailsCache: mergedCache,
						isEnrichingDetails: false,
					};
				});
			} catch (error) {
				if (error instanceof Error && error.name !== "AbortError") {
					console.warn("Failed to fetch enriched details:", error.message);
				}
				update((state) => ({ ...state, isEnrichingDetails: false }));
			}
		},

		// Open panel with search results (sorted with boosted first)
		openWithSearchResults(query: string, results: Place[]) {
			const sortedResults = sortMerchants(
				results,
				undefined,
				undefined,
				get(userLocation).location,
			);
			const categoryCounts = countMerchantsByCategory(sortedResults);
			update((state) => ({
				...resetCategoryState(state),
				isOpen: true,
				mode: "search",
				searchQuery: query,
				searchResults: sortedResults,
				isSearching: false,
				categoryCounts,
			}));
		},

		// Open panel in search mode, optionally showing spinner
		// Use openSearchMode() to open panel ready for input (no spinner)
		// Use openSearchMode(true) when a search is in progress (shows spinner)
		openSearchMode(isSearching: boolean = false) {
			update((state) => ({
				...state,
				isSearching,
				mode: "search",
				isOpen: true,
			}));
		},

		// Update the search query (used when binding input to store)
		setSearchQuery(query: string) {
			update((state) => ({ ...state, searchQuery: query }));
		},

		// Clear search input and results, but stay in search mode
		// Use when: user clears the search input (e.g., clicking X button)
		// Markers reset because searchResultIds becomes empty, triggering normal marker reload
		clearSearchInput() {
			update((state) => ({
				...resetCategoryState(state),
				searchQuery: "",
				searchResults: [],
				isSearching: false,
			}));
		},

		// Exit search mode and return to nearby mode
		// Use when: user explicitly switches away from search (e.g., clicking "Nearby" tab)
		exitSearchMode() {
			update((state) => ({
				...resetCategoryState(state),
				mode: "nearby",
				searchQuery: "",
				searchResults: [],
				isSearching: false,
			}));
		},

		// Switch between modes (no side effects - just sets mode)
		setMode(mode: MerchantListMode) {
			update((state) => ({ ...state, mode }));
		},

		// Set the selected category filter
		setSelectedCategory(category: CategoryKey) {
			update((state) => ({ ...state, selectedCategory: category }));
		},

		// Reset the selected category to 'all'
		resetCategory() {
			update((state) => resetCategoryState(state));
		},

		// Re-sort merchants using current user location (if available)
		// Call this when user location becomes available to re-sort the list
		reSortByUserLocation() {
			update((state) => {
				if (state.merchants.length === 0) return state;
				const sorted = sortMerchants(
					state.merchants,
					undefined,
					undefined,
					get(userLocation).location,
				);
				return { ...state, merchants: sorted };
			});
		},

		reset() {
			cancelAllRequests();
			set(initialState);
		},
	};
}

export const merchantList = createMerchantListStore();

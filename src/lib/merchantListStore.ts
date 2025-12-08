import { writable } from 'svelte/store';
import axios from 'axios';
import type { Place } from '$lib/types';
import { PLACE_FIELD_SETS, buildFieldsParam } from '$lib/api-fields';
import { isBoosted } from '$lib/merchantDrawerLogic';
import { MERCHANT_LIST_MAX_ITEMS } from '$lib/constants';
import { errToast } from '$lib/utils';

export type MerchantListMode = 'nearby' | 'search';

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
}

const initialState: MerchantListState = {
	isOpen: false,
	merchants: [],
	totalCount: 0,
	placeDetailsCache: new Map(),
	isLoadingList: false,
	isEnrichingDetails: false,
	mode: 'nearby',
	searchQuery: '',
	searchResults: [],
	isSearching: false
};

// Equirectangular approximation for local distance sorting
// Uses squared distance (avoids sqrt) since we only need relative ordering
// Cosine adjustment accounts for longitude distortion at different latitudes
function getDistanceSquared(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const dx = (lon2 - lon1) * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
	const dy = lat2 - lat1;
	return dx * dx + dy * dy;
}

// Sort order: boosted merchants first (premium placement), then by distance, then alphabetically
function sortMerchants(merchants: Place[], centerLat?: number, centerLon?: number): Place[] {
	return [...merchants].sort((a, b) => {
		// Boosted first
		if (isBoosted(a) && !isBoosted(b)) return -1;
		if (!isBoosted(a) && isBoosted(b)) return 1;

		// Then by distance (if center provided)
		if (centerLat !== undefined && centerLon !== undefined) {
			const distA = getDistanceSquared(centerLat, centerLon, a.lat, a.lon);
			const distB = getDistanceSquared(centerLat, centerLon, b.lat, b.lon);
			return distA - distB;
		}

		// Fallback to alphabetical
		return (a.name || '').localeCompare(b.name || '');
	});
}

// Filter out invalid API response items missing required id field
function filterValidPlaces<T extends { id?: unknown }>(items: T[]): T[] {
	return items.filter((item): item is T => typeof item?.id === 'number');
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

		// Hide the panel but keep all data (count stays visible on button)
		close() {
			update((state) => ({ ...state, isOpen: false }));
		},

		// Set merchants from locally-loaded markers (used at zoom 15-16)
		setMerchants(
			merchants: Place[],
			centerLat?: number,
			centerLon?: number,
			limit: number = MERCHANT_LIST_MAX_ITEMS
		) {
			const sorted = sortMerchants(merchants, centerLat, centerLon);
			const limited = sorted.slice(0, limit);
			update((state) => ({
				...state,
				merchants: limited,
				totalCount: merchants.length,
				isLoadingList: false
			}));
		},

		// Fetch merchants from API and replace the current list
		// Used at high zoom (17+) and low zoom (11-14) where we can't rely on loaded markers
		// hideIfExceeds: if API returns more than this, clear the list (shows "zoom in" message)
		async fetchAndReplaceList(
			center: { lat: number; lon: number },
			radiusKm: number,
			options?: { hideIfExceeds?: number }
		) {
			cancelListRequest();
			listAbortController = new AbortController();

			// Keep previous merchants visible while loading (prevents flicker)
			update((state) => ({ ...state, isLoadingList: true }));

			try {
				const fields = buildFieldsParam(PLACE_FIELD_SETS.LIST_ITEM);
				const response = await axios.get<Place[]>(
					`https://api.btcmap.org/v4/places/search/?lat=${center.lat}&lon=${center.lon}&radius_km=${radiusKm}&fields=${fields}`,
					{ timeout: 10000, signal: listAbortController.signal }
				);

				// Validate response is an array (API may return HTML error page)
				if (!Array.isArray(response.data)) {
					throw new Error('API returned invalid data format');
				}

				// Filter out invalid items missing required id field
				const validPlaces = filterValidPlaces(response.data);

				// Build cache for enriched display (icons, addresses, etc.)
				const placeDetailsCache = new Map<number, Place>();
				validPlaces.forEach((place) => placeDetailsCache.set(place.id, place));

				// Check if we should hide results (too many at low zoom)
				if (options?.hideIfExceeds && validPlaces.length > options.hideIfExceeds) {
					// Too many results - store count but show empty list
					// The panel will display "zoom in" message, button shows count
					update((state) => ({
						...state,
						merchants: [],
						totalCount: validPlaces.length,
						isLoadingList: false
					}));
				} else {
					const sorted = sortMerchants(validPlaces, center.lat, center.lon);
					const limited = sorted.slice(0, MERCHANT_LIST_MAX_ITEMS);
					update((state) => ({
						...state,
						merchants: limited,
						totalCount: validPlaces.length,
						placeDetailsCache,
						isLoadingList: false
					}));
				}
			} catch (error) {
				if (error instanceof Error && error.name !== 'AbortError') {
					console.warn('Failed to fetch merchant list:', error.message);
					errToast('Failed to load nearby merchants');
				}
				update((state) => ({ ...state, isLoadingList: false }));
			}
		},

		// Fetch only IDs to get count (minimal payload for button badge)
		// Used at zoom 11-14 when panel is closed - avoids fetching full data unnecessarily
		async fetchCountOnly(center: { lat: number; lon: number }, radiusKm: number) {
			cancelListRequest();
			listAbortController = new AbortController();

			update((state) => ({ ...state, isLoadingList: true }));

			try {
				const response = await axios.get<{ id: number }[]>(
					`https://api.btcmap.org/v4/places/search/?lat=${center.lat}&lon=${center.lon}&radius_km=${radiusKm}&fields=id`,
					{ timeout: 10000, signal: listAbortController.signal }
				);

				// Validate response is an array (API may return HTML error page)
				if (!Array.isArray(response.data)) {
					throw new Error('API returned invalid data format');
				}

				// Filter out invalid items missing required id field
				const validItems = filterValidPlaces(response.data);

				update((state) => ({
					...state,
					merchants: [],
					totalCount: validItems.length,
					isLoadingList: false
				}));
			} catch (error) {
				if (error instanceof Error && error.name !== 'AbortError') {
					console.warn('Failed to fetch merchant count:', error.message);
				}
				update((state) => ({ ...state, isLoadingList: false }));
			}
		},

		// Fetch full Place data to enrich existing list items (doesn't change the list)
		// Used at zoom 15-16 when panel is open - adds icons/addresses to skeleton items
		// Runs silently in background without showing spinner
		async fetchEnrichedDetails(center: { lat: number; lon: number }, radiusKm: number) {
			cancelDetailsRequest();
			detailsAbortController = new AbortController();

			update((state) => ({ ...state, isEnrichingDetails: true }));

			try {
				const fields = buildFieldsParam(PLACE_FIELD_SETS.LIST_ITEM);
				const response = await axios.get<Place[]>(
					`https://api.btcmap.org/v4/places/search/?lat=${center.lat}&lon=${center.lon}&radius_km=${radiusKm}&fields=${fields}`,
					{ timeout: 10000, signal: detailsAbortController.signal }
				);

				// Filter out invalid items and merge into existing cache
				const validPlaces = filterValidPlaces(response.data);
				update((state) => {
					const mergedCache = new Map(state.placeDetailsCache);
					validPlaces.forEach((place) => mergedCache.set(place.id, place));
					return { ...state, placeDetailsCache: mergedCache, isEnrichingDetails: false };
				});
			} catch (error) {
				if (error instanceof Error && error.name !== 'AbortError') {
					console.warn('Failed to fetch enriched details:', error.message);
				}
				update((state) => ({ ...state, isEnrichingDetails: false }));
			}
		},

		// Open panel with search results (sorted with boosted first)
		openWithSearchResults(query: string, results: Place[]) {
			const sortedResults = sortMerchants(results);
			update((state) => ({
				...state,
				isOpen: true,
				mode: 'search',
				searchQuery: query,
				searchResults: sortedResults,
				isSearching: false
			}));
		},

		// Open panel in search mode, optionally showing spinner
		// Use openSearchMode() to open panel ready for input (no spinner)
		// Use openSearchMode(true) when a search is in progress (shows spinner)
		openSearchMode(isSearching: boolean = false) {
			update((state) => ({
				...state,
				isSearching,
				mode: 'search',
				isOpen: true
			}));
		},

		// Clear search results but stay in search mode
		// Use when: user clears the search input to type a new query (e.g., clicking X button)
		// The panel stays open in search mode, ready for new input
		clearSearchResults() {
			update((state) => ({
				...state,
				searchQuery: '',
				searchResults: [],
				isSearching: false
			}));
		},

		// Clear search and exit to nearby mode
		// Use when: user explicitly switches away from search (e.g., clicking "Nearby" tab)
		// Resets to the default nearby merchant list view
		clearSearch() {
			update((state) => ({
				...state,
				mode: 'nearby',
				searchQuery: '',
				searchResults: [],
				isSearching: false
			}));
		},

		// Switch between modes
		setMode(mode: MerchantListMode) {
			update((state) => ({
				...state,
				mode,
				// Clear search state when switching to nearby
				...(mode === 'nearby' ? { searchQuery: '', searchResults: [], isSearching: false } : {})
			}));
		},

		reset() {
			cancelAllRequests();
			set(initialState);
		}
	};
}

export const merchantList = createMerchantListStore();

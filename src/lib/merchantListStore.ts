import { writable } from 'svelte/store';
import axios from 'axios';
import type { Place } from '$lib/types';
import { PLACE_FIELD_SETS, buildFieldsParam } from '$lib/api-fields';
import { isBoosted } from '$lib/merchantDrawerLogic';
import { MERCHANT_LIST_MAX_ITEMS } from '$lib/constants';

export interface MerchantListState {
	isOpen: boolean;
	isExpanded: boolean;
	merchants: Place[];
	totalCount: number;
	// Cache of full Place data by ID, used to show icons/addresses without re-fetching
	placeDetailsCache: Map<number, Place>;
	isLoading: boolean;
}

const initialState: MerchantListState = {
	isOpen: false,
	isExpanded: true,
	merchants: [],
	totalCount: 0,
	placeDetailsCache: new Map(),
	isLoading: false
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

function createMerchantListStore() {
	const store = writable<MerchantListState>(initialState);
	const { subscribe, set, update } = store;

	let abortController: AbortController | null = null;

	// Cancel any in-flight API requests
	function cancelPendingRequests() {
		if (abortController) {
			abortController.abort();
			abortController = null;
		}
	}

	return {
		subscribe,

		open() {
			update((state) => ({ ...state, isOpen: true }));
		},

		close() {
			cancelPendingRequests();
			update((state) => ({
				...state,
				isOpen: false,
				isExpanded: true,
				merchants: [],
				totalCount: 0,
				placeDetailsCache: new Map()
			}));
		},

		collapse() {
			update((state) => ({ ...state, isExpanded: false }));
		},

		expand() {
			update((state) => ({ ...state, isExpanded: true }));
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
				isLoading: false
			}));
		},

		setLoading(isLoading: boolean) {
			update((state) => ({ ...state, isLoading }));
		},

		// Fetch merchants from API and replace the current list
		// Used at high zoom (17+) and low zoom (11-14) where we can't rely on loaded markers
		// hideIfExceeds: if API returns more than this, clear the list (shows "zoom in" message)
		async fetchAndReplaceList(
			center: { lat: number; lon: number },
			radiusKm: number,
			options?: { hideIfExceeds?: number }
		) {
			cancelPendingRequests();
			abortController = new AbortController();

			// Keep previous merchants visible while loading (prevents flicker)
			update((state) => ({ ...state, isLoading: true }));

			try {
				const fields = buildFieldsParam(PLACE_FIELD_SETS.LIST_ITEM);
				const response = await axios.get<Place[]>(
					`https://api.btcmap.org/v4/places/search/?lat=${center.lat}&lon=${center.lon}&radius_km=${radiusKm}&fields=${fields}`,
					{ timeout: 10000, signal: abortController.signal }
				);

				// Build cache for enriched display (icons, addresses, etc.)
				const placeDetailsCache = new Map<number, Place>();
				response.data.forEach((place) => placeDetailsCache.set(place.id, place));

				// Check if we should hide results (too many at low zoom)
				if (options?.hideIfExceeds && response.data.length > options.hideIfExceeds) {
					// Too many results - store count but show empty list
					// The panel will display "zoom in" message, button shows count
					update((state) => ({
						...state,
						merchants: [],
						totalCount: response.data.length,
						isLoading: false
					}));
				} else {
					const sorted = sortMerchants(response.data, center.lat, center.lon);
					const limited = sorted.slice(0, MERCHANT_LIST_MAX_ITEMS);
					update((state) => ({
						...state,
						merchants: limited,
						totalCount: response.data.length,
						placeDetailsCache,
						isLoading: false
					}));
				}
			} catch (error) {
				if (error instanceof Error && error.name !== 'AbortError') {
					console.warn('Failed to fetch merchant list:', error.message);
				}
				update((state) => ({ ...state, isLoading: false }));
			}
		},

		// Fetch full Place data to enrich existing list items (doesn't change the list)
		// Used at zoom 15-16 when panel is open - adds icons/addresses to skeleton items
		async fetchEnrichedDetails(center: { lat: number; lon: number }, radiusKm: number) {
			cancelPendingRequests();
			abortController = new AbortController();

			update((state) => ({ ...state, isLoading: true }));

			try {
				const fields = buildFieldsParam(PLACE_FIELD_SETS.LIST_ITEM);
				const response = await axios.get<Place[]>(
					`https://api.btcmap.org/v4/places/search/?lat=${center.lat}&lon=${center.lon}&radius_km=${radiusKm}&fields=${fields}`,
					{ timeout: 10000, signal: abortController.signal }
				);

				// Build cache - existing merchants will use this for display
				const placeDetailsCache = new Map<number, Place>();
				response.data.forEach((place) => placeDetailsCache.set(place.id, place));

				update((state) => ({ ...state, placeDetailsCache, isLoading: false }));
			} catch (error) {
				if (error instanceof Error && error.name !== 'AbortError') {
					console.warn('Failed to fetch enriched details:', error.message);
				}
				update((state) => ({ ...state, isLoading: false }));
			}
		},

		reset() {
			cancelPendingRequests();
			set(initialState);
		}
	};
}

export const merchantList = createMerchantListStore();

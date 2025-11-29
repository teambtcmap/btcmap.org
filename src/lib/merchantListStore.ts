import { writable } from 'svelte/store';
import axios from 'axios';
import type { Place } from '$lib/types';
import { PLACE_FIELD_SETS, buildFieldsParam } from '$lib/api-fields';
import { isBoosted } from '$lib/merchantDrawerLogic';

export interface MerchantListState {
	isOpen: boolean;
	merchants: Place[];
	enrichedPlaces: Map<number, Place>;
	isLoading: boolean;
	isFetchingDetails: boolean;
}

const initialState: MerchantListState = {
	isOpen: false,
	merchants: [],
	enrichedPlaces: new Map(),
	isLoading: false,
	isFetchingDetails: false
};

// Equirectangular approximation - accurate for local sorting, not precise distance
function getDistanceSquared(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const dx = (lon2 - lon1) * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
	const dy = lat2 - lat1;
	return dx * dx + dy * dy;
}

// Sort merchants: boosted first, then by distance, then alphabetically
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

	return {
		subscribe,

		open() {
			update((state) => ({ ...state, isOpen: true }));
		},

		close() {
			if (abortController) {
				abortController.abort();
				abortController = null;
			}
			update((state) => ({
				...state,
				isOpen: false,
				merchants: [],
				enrichedPlaces: new Map(),
				isFetchingDetails: false
			}));
		},

		setMerchants(merchants: Place[], centerLat?: number, centerLon?: number, limit: number = 50) {
			const sorted = sortMerchants(merchants, centerLat, centerLon);
			const limited = sorted.slice(0, limit);
			update((state) => ({ ...state, merchants: limited, isLoading: false }));
		},

		setLoading(isLoading: boolean) {
			update((state) => ({ ...state, isLoading }));
		},

		async fetchByRadius(center: { lat: number; lon: number }, radiusKm: number) {
			// Cancel any pending requests
			if (abortController) {
				abortController.abort();
			}
			abortController = new AbortController();

			update((state) => ({ ...state, isFetchingDetails: true }));

			try {
				const fields = buildFieldsParam(PLACE_FIELD_SETS.LIST_ITEM);
				const response = await axios.get<Place[]>(
					`https://api.btcmap.org/v4/places/search/?lat=${center.lat}&lon=${center.lon}&radius_km=${radiusKm}&fields=${fields}`,
					{ timeout: 10000, signal: abortController.signal }
				);

				// Build enriched places map (no caching - just replace)
				const enrichedPlaces = new Map<number, Place>();
				response.data.forEach((place) => enrichedPlaces.set(place.id, place));

				update((state) => ({ ...state, enrichedPlaces }));
			} catch {
				// Silently fail - list will show without enriched data
			} finally {
				update((state) => ({ ...state, isFetchingDetails: false }));
			}
		},

		reset() {
			if (abortController) {
				abortController.abort();
				abortController = null;
			}
			set(initialState);
		}
	};
}

export const merchantList = createMerchantListStore();

import { writable, get } from 'svelte/store';
import axios from 'axios';
import type { Place } from '$lib/types';
import { PLACE_FIELD_SETS, buildFieldsParam } from '$lib/api-fields';
import { calcVerifiedDate } from '$lib/merchantDrawerLogic';

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

// Sort merchants: boosted first, then verified, then alphabetically
function sortMerchants(merchants: Place[]): Place[] {
	const now = Date.now();
	const verifiedDate = calcVerifiedDate();

	return [...merchants].sort((a, b) => {
		const aBoosted = a.boosted_until && Date.parse(a.boosted_until) > now;
		const bBoosted = b.boosted_until && Date.parse(b.boosted_until) > now;
		if (aBoosted && !bBoosted) return -1;
		if (!aBoosted && bBoosted) return 1;

		const aVerified = a.verified_at && Date.parse(a.verified_at) > verifiedDate;
		const bVerified = b.verified_at && Date.parse(b.verified_at) > verifiedDate;
		if (aVerified && !bVerified) return -1;
		if (!aVerified && bVerified) return 1;

		return (a.name || '').localeCompare(b.name || '');
	});
}

function createMerchantListStore() {
	const store = writable<MerchantListState>(initialState);
	const { subscribe, set, update } = store;

	let abortController: AbortController | null = null;

	async function fetchSinglePlace(id: number, signal: AbortSignal): Promise<Place | null> {
		try {
			const response = await axios.get<Place>(
				`https://api.btcmap.org/v4/places/${id}?fields=${buildFieldsParam(PLACE_FIELD_SETS.LIST_ITEM)}`,
				{ timeout: 10000, signal }
			);
			return response.data;
		} catch {
			return null;
		}
	}

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

		setMerchants(merchants: Place[], limit: number = 50) {
			const sorted = sortMerchants(merchants);
			const limited = sorted.slice(0, limit);
			update((state) => ({ ...state, merchants: limited, isLoading: false }));
		},

		setLoading(isLoading: boolean) {
			update((state) => ({ ...state, isLoading }));
		},

		async fetchDetails(placeIds: number[]) {
			const currentState = get(store);

			// Filter out already-fetched places
			const idsToFetch = placeIds.filter((id) => !currentState.enrichedPlaces.has(id));
			if (idsToFetch.length === 0) return;

			// Cancel any pending requests
			if (abortController) {
				abortController.abort();
			}
			abortController = new AbortController();
			const signal = abortController.signal;

			update((state) => ({ ...state, isFetchingDetails: true }));

			try {
				// Fetch in parallel with concurrency limit of 5
				const concurrencyLimit = 5;
				for (let i = 0; i < idsToFetch.length; i += concurrencyLimit) {
					if (signal.aborted) break;

					const batch = idsToFetch.slice(i, i + concurrencyLimit);
					const results = await Promise.all(batch.map((id) => fetchSinglePlace(id, signal)));

					if (signal.aborted) break;

					update((state) => {
						const newEnrichedPlaces = new Map(state.enrichedPlaces);
						results.forEach((place, idx) => {
							if (place) {
								newEnrichedPlaces.set(batch[idx], place);
							}
						});
						return { ...state, enrichedPlaces: newEnrichedPlaces };
					});
				}
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

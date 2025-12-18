import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import axios from 'axios';
import { places } from '$lib/store';
import type { DrawerView } from '$lib/merchantDrawerHash';
import { updateMerchantHash, parseMerchantHash } from '$lib/merchantDrawerHash';
import { PLACE_FIELD_SETS, buildFieldsParam } from '$lib/api-fields';
import type { Place } from '$lib/types';

export interface MerchantDrawerState {
	isOpen: boolean;
	merchantId: number | null;
	drawerView: DrawerView;
	merchant: Place | null;
	isLoading: boolean;
	error: string | null;
}

const initialState: MerchantDrawerState = {
	isOpen: false,
	merchantId: null,
	drawerView: 'details',
	merchant: null,
	isLoading: false,
	error: null
};

function createMerchantDrawerStore() {
	const { subscribe, set, update } = writable<MerchantDrawerState>(initialState);

	let abortController: AbortController | null = null;

	function hasCompleteData(place: Place | undefined): place is Place {
		if (!place) return false;
		return (
			place.name !== undefined && place.address !== undefined && place.verified_at !== undefined
		);
	}

	async function fetchMerchantData(id: number): Promise<void> {
		// Cancel any pending request
		if (abortController) {
			abortController.abort();
		}
		abortController = new AbortController();

		try {
			const response = await axios.get(
				`https://api.btcmap.org/v4/places/${id}?fields=${buildFieldsParam(PLACE_FIELD_SETS.COMPLETE_PLACE)}`,
				{
					timeout: 10000,
					signal: abortController.signal
				}
			);

			// Only update if this merchant is still selected
			update((state) => {
				if (state.merchantId === id) {
					return { ...state, merchant: response.data, isLoading: false, error: null };
				}
				return state;
			});
		} catch (error) {
			if (axios.isCancel(error)) return;

			console.error('Error fetching merchant details:', error);
			update((state) => {
				if (state.merchantId === id) {
					return { ...state, isLoading: false, error: 'Failed to load merchant details' };
				}
				return state;
			});
		}
	}

	return {
		subscribe,

		// Open drawer with optimistic UI - show cached data immediately
		open(id: number, view: DrawerView = 'details') {
			// Get cached data from places store
			const cachedPlace = get(places).find((p) => p.id === id);
			const needsFetch = !hasCompleteData(cachedPlace);

			update((state) => ({
				...state,
				isOpen: true,
				merchantId: id,
				drawerView: view,
				merchant: cachedPlace || null,
				isLoading: needsFetch,
				error: null
			}));

			// Update URL hash
			updateMerchantHash(id, view);

			// Fetch fresh data if needed
			if (needsFetch) {
				fetchMerchantData(id);
			}
		},

		// Close drawer and cancel any pending requests
		close() {
			if (abortController) {
				abortController.abort();
				abortController = null;
			}

			update((state) => ({
				...state,
				isOpen: false,
				merchantId: null,
				merchant: null,
				isLoading: false,
				error: null
			}));

			updateMerchantHash(null);
		},

		// Change drawer view (details/boost)
		setView(view: DrawerView) {
			update((state) => {
				if (state.merchantId) {
					updateMerchantHash(state.merchantId, view);
				}
				return { ...state, drawerView: view };
			});
		},

		// Sync state from URL hash (called on hashchange)
		syncFromHash() {
			if (!browser) return;

			const hashState = parseMerchantHash();

			update((currentState) => {
				// Drawer closing
				if (!hashState.isOpen && currentState.isOpen) {
					if (abortController) {
						abortController.abort();
						abortController = null;
					}
					return { ...initialState };
				}

				// Drawer opening or merchant changing
				if (hashState.isOpen && hashState.merchantId !== currentState.merchantId) {
					const cachedPlace = get(places).find((p) => p.id === hashState.merchantId);
					const needsFetch = !hasCompleteData(cachedPlace);

					if (needsFetch && hashState.merchantId) {
						fetchMerchantData(hashState.merchantId);
					}

					return {
						...currentState,
						isOpen: true,
						merchantId: hashState.merchantId,
						drawerView: hashState.drawerView,
						merchant: cachedPlace || null,
						isLoading: needsFetch,
						error: null
					};
				}

				// Just view changing
				if (hashState.drawerView !== currentState.drawerView) {
					return { ...currentState, drawerView: hashState.drawerView };
				}

				return currentState;
			});
		},

		// Update merchant data (e.g., after boost completes)
		updateMerchant(merchant: Place) {
			update((state) => ({ ...state, merchant }));
		},

		// Reset to initial state
		reset() {
			if (abortController) {
				abortController.abort();
				abortController = null;
			}
			set(initialState);
		}
	};
}

export const merchantDrawer = createMerchantDrawerStore();

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { get } from 'svelte/store';
import axios from 'axios';
import type { Place } from '$lib/types';

// Mock axios
vi.mock('axios');

// Mock errToast
vi.mock('$lib/utils', () => ({
	errToast: vi.fn(),
	isBoosted: (place: Place) => place.boosted_until && new Date(place.boosted_until) > new Date()
}));

// Mock isBoosted from merchantDrawerLogic
vi.mock('$lib/merchantDrawerLogic', () => ({
	isBoosted: (place: Place) => place.boosted_until && new Date(place.boosted_until) > new Date()
}));

// Import after mocks are set up
import { merchantList } from './merchantListStore';
import { errToast } from '$lib/utils';

// Helper to create mock Place objects
function createMockPlace(overrides: Partial<Place> = {}): Place {
	return {
		id: Math.floor(Math.random() * 10000),
		lat: 0,
		lon: 0,
		name: 'Test Place',
		...overrides
	} as Place;
}

describe('merchantListStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		merchantList.reset();
	});

	describe('state toggles', () => {
		it('open() should set isOpen to true', () => {
			merchantList.open();
			const state = get(merchantList);
			expect(state.isOpen).toBe(true);
		});

		it('close() should reset state and clear merchants', () => {
			// Set up some state first
			merchantList.open();
			merchantList.setMerchants([createMockPlace()], 0, 0);

			merchantList.close();
			const state = get(merchantList);

			expect(state.isOpen).toBe(false);
			expect(state.isExpanded).toBe(true);
			expect(state.merchants).toEqual([]);
			expect(state.totalCount).toBe(0);
			expect(state.placeDetailsCache.size).toBe(0);
		});

		it('collapse() should set isExpanded to false', () => {
			merchantList.collapse();
			const state = get(merchantList);
			expect(state.isExpanded).toBe(false);
		});

		it('expand() should set isExpanded to true', () => {
			merchantList.collapse();
			merchantList.expand();
			const state = get(merchantList);
			expect(state.isExpanded).toBe(true);
		});

		it('reset() should restore initial state', () => {
			merchantList.open();
			merchantList.collapse();
			merchantList.setMerchants([createMockPlace()], 0, 0);

			merchantList.reset();
			const state = get(merchantList);

			expect(state.isOpen).toBe(false);
			expect(state.isExpanded).toBe(true);
			expect(state.merchants).toEqual([]);
			expect(state.totalCount).toBe(0);
			expect(state.isLoadingList).toBe(false);
			expect(state.isEnrichingDetails).toBe(false);
		});
	});

	describe('setMerchants', () => {
		it('should limit results to default max items', () => {
			const merchants = Array.from({ length: 100 }, (_, i) =>
				createMockPlace({ id: i, name: `Place ${i}` })
			);

			merchantList.setMerchants(merchants, 0, 0);
			const state = get(merchantList);

			expect(state.merchants.length).toBe(50); // MERCHANT_LIST_MAX_ITEMS
			expect(state.totalCount).toBe(100);
		});

		it('should update totalCount with full array length', () => {
			const merchants = Array.from({ length: 75 }, (_, i) => createMockPlace({ id: i }));

			merchantList.setMerchants(merchants, 0, 0);
			const state = get(merchantList);

			expect(state.totalCount).toBe(75);
		});

		it('should set isLoadingList to false', () => {
			merchantList.setMerchants([createMockPlace()], 0, 0);
			const state = get(merchantList);
			expect(state.isLoadingList).toBe(false);
		});

		it('should respect custom limit parameter', () => {
			const merchants = Array.from({ length: 20 }, (_, i) => createMockPlace({ id: i }));

			merchantList.setMerchants(merchants, 0, 0, 5);
			const state = get(merchantList);

			expect(state.merchants.length).toBe(5);
			expect(state.totalCount).toBe(20);
		});
	});

	describe('merchant sorting', () => {
		it('should place boosted merchants first', () => {
			const futureDate = new Date(Date.now() + 86400000).toISOString(); // Tomorrow
			const boosted = createMockPlace({ id: 1, name: 'Boosted', boosted_until: futureDate });
			const regular = createMockPlace({ id: 2, name: 'Regular' });

			merchantList.setMerchants([regular, boosted], 0, 0);
			const state = get(merchantList);

			expect(state.merchants[0].id).toBe(1); // Boosted first
			expect(state.merchants[1].id).toBe(2);
		});

		it('should sort by distance when center provided', () => {
			const near = createMockPlace({ id: 1, name: 'Near', lat: 0.001, lon: 0.001 });
			const far = createMockPlace({ id: 2, name: 'Far', lat: 1, lon: 1 });

			merchantList.setMerchants([far, near], 0, 0);
			const state = get(merchantList);

			expect(state.merchants[0].id).toBe(1); // Near first
			expect(state.merchants[1].id).toBe(2);
		});

		it('should fallback to alphabetical when no center', () => {
			const placeB = createMockPlace({ id: 1, name: 'Beta' });
			const placeA = createMockPlace({ id: 2, name: 'Alpha' });

			merchantList.setMerchants([placeB, placeA]);
			const state = get(merchantList);

			expect(state.merchants[0].name).toBe('Alpha');
			expect(state.merchants[1].name).toBe('Beta');
		});

		it('should handle merchants without names', () => {
			const withName = createMockPlace({ id: 1, name: 'Has Name' });
			const withoutName = createMockPlace({ id: 2, name: '' });
			const nullName = createMockPlace({ id: 3 });
			delete (nullName as Partial<Place>).name;

			// Should not throw
			merchantList.setMerchants([withName, withoutName, nullName]);
			const state = get(merchantList);
			expect(state.merchants.length).toBe(3);
		});
	});

	describe('fetchAndReplaceList', () => {
		it('should set isLoadingList while fetching', async () => {
			const mockResponse = { data: [] };
			(axios.get as Mock).mockResolvedValueOnce(mockResponse);

			const fetchPromise = merchantList.fetchAndReplaceList({ lat: 0, lon: 0 }, 10);

			// Check loading state immediately
			let state = get(merchantList);
			expect(state.isLoadingList).toBe(true);

			await fetchPromise;

			state = get(merchantList);
			expect(state.isLoadingList).toBe(false);
		});

		it('should populate merchants on success', async () => {
			const mockPlaces = [createMockPlace({ id: 1 }), createMockPlace({ id: 2 })];
			(axios.get as Mock).mockResolvedValueOnce({ data: mockPlaces });

			await merchantList.fetchAndReplaceList({ lat: 0, lon: 0 }, 10);
			const state = get(merchantList);

			expect(state.merchants.length).toBe(2);
			expect(state.totalCount).toBe(2);
		});

		it('should build placeDetailsCache from response', async () => {
			const mockPlaces = [createMockPlace({ id: 123 }), createMockPlace({ id: 456 })];
			(axios.get as Mock).mockResolvedValueOnce({ data: mockPlaces });

			await merchantList.fetchAndReplaceList({ lat: 0, lon: 0 }, 10);
			const state = get(merchantList);

			expect(state.placeDetailsCache.has(123)).toBe(true);
			expect(state.placeDetailsCache.has(456)).toBe(true);
		});

		it('should clear merchants when hideIfExceeds triggered', async () => {
			const mockPlaces = Array.from({ length: 60 }, (_, i) => createMockPlace({ id: i }));
			(axios.get as Mock).mockResolvedValueOnce({ data: mockPlaces });

			await merchantList.fetchAndReplaceList({ lat: 0, lon: 0 }, 10, { hideIfExceeds: 50 });
			const state = get(merchantList);

			expect(state.merchants).toEqual([]);
			expect(state.totalCount).toBe(60);
		});

		it('should store totalCount even when hiding results', async () => {
			const mockPlaces = Array.from({ length: 100 }, (_, i) => createMockPlace({ id: i }));
			(axios.get as Mock).mockResolvedValueOnce({ data: mockPlaces });

			await merchantList.fetchAndReplaceList({ lat: 0, lon: 0 }, 10, { hideIfExceeds: 50 });
			const state = get(merchantList);

			expect(state.totalCount).toBe(100);
		});

		it('should show error toast on failure', async () => {
			const error = new Error('Network error');
			(axios.get as Mock).mockRejectedValueOnce(error);

			await merchantList.fetchAndReplaceList({ lat: 0, lon: 0 }, 10);

			expect(errToast).toHaveBeenCalledWith('Failed to load nearby merchants');
		});

		it('should ignore AbortError (no toast)', async () => {
			const abortError = new Error('Aborted');
			abortError.name = 'AbortError';
			(axios.get as Mock).mockRejectedValueOnce(abortError);

			await merchantList.fetchAndReplaceList({ lat: 0, lon: 0 }, 10);

			expect(errToast).not.toHaveBeenCalled();
		});
	});

	describe('fetchCountOnly', () => {
		it('should request only id field', async () => {
			(axios.get as Mock).mockResolvedValueOnce({ data: [] });

			await merchantList.fetchCountOnly({ lat: 10, lon: 20 }, 5);

			expect(axios.get).toHaveBeenCalledWith(
				expect.stringContaining('fields=id'),
				expect.any(Object)
			);
		});

		it('should set totalCount from response length', async () => {
			const mockIds = [{ id: 1 }, { id: 2 }, { id: 3 }];
			(axios.get as Mock).mockResolvedValueOnce({ data: mockIds });

			await merchantList.fetchCountOnly({ lat: 0, lon: 0 }, 10);
			const state = get(merchantList);

			expect(state.totalCount).toBe(3);
		});

		it('should leave merchants empty', async () => {
			const mockIds = [{ id: 1 }, { id: 2 }];
			(axios.get as Mock).mockResolvedValueOnce({ data: mockIds });

			await merchantList.fetchCountOnly({ lat: 0, lon: 0 }, 10);
			const state = get(merchantList);

			expect(state.merchants).toEqual([]);
		});

		it('should not show error toast on failure', async () => {
			const error = new Error('Network error');
			(axios.get as Mock).mockRejectedValueOnce(error);

			await merchantList.fetchCountOnly({ lat: 0, lon: 0 }, 10);

			expect(errToast).not.toHaveBeenCalled();
		});
	});

	describe('fetchEnrichedDetails', () => {
		it('should merge into existing cache (not replace)', async () => {
			// Set up initial cache
			const initialPlace = createMockPlace({ id: 1 });
			(axios.get as Mock).mockResolvedValueOnce({ data: [initialPlace] });
			await merchantList.fetchAndReplaceList({ lat: 0, lon: 0 }, 10);

			// Fetch enriched details with new place
			const newPlace = createMockPlace({ id: 2 });
			(axios.get as Mock).mockResolvedValueOnce({ data: [newPlace] });
			await merchantList.fetchEnrichedDetails({ lat: 0, lon: 0 }, 10);

			const state = get(merchantList);
			expect(state.placeDetailsCache.has(1)).toBe(true); // Original preserved
			expect(state.placeDetailsCache.has(2)).toBe(true); // New added
		});

		it('should set isEnrichingDetails during fetch', async () => {
			(axios.get as Mock).mockResolvedValueOnce({ data: [] });

			const fetchPromise = merchantList.fetchEnrichedDetails({ lat: 0, lon: 0 }, 10);

			let state = get(merchantList);
			expect(state.isEnrichingDetails).toBe(true);

			await fetchPromise;

			state = get(merchantList);
			expect(state.isEnrichingDetails).toBe(false);
		});

		it('should not affect isLoadingList', async () => {
			(axios.get as Mock).mockResolvedValueOnce({ data: [] });

			const fetchPromise = merchantList.fetchEnrichedDetails({ lat: 0, lon: 0 }, 10);

			const state = get(merchantList);
			expect(state.isLoadingList).toBe(false);

			await fetchPromise;
		});
	});

	describe('request cancellation', () => {
		it('should cancel previous list request when new one starts', async () => {
			let firstAborted = false;
			(axios.get as Mock)
				.mockImplementationOnce(
					(_url: string, config: { signal: AbortSignal }) =>
						new Promise((_, reject) => {
							config.signal.addEventListener('abort', () => {
								firstAborted = true;
								const error = new Error('Aborted');
								error.name = 'AbortError';
								reject(error);
							});
						})
				)
				.mockResolvedValueOnce({ data: [] });

			// Start first request (will hang)
			const first = merchantList.fetchAndReplaceList({ lat: 0, lon: 0 }, 10);

			// Start second request (should abort first)
			const second = merchantList.fetchAndReplaceList({ lat: 1, lon: 1 }, 10);

			await Promise.all([first.catch(() => {}), second]);

			expect(firstAborted).toBe(true);
		});

		it('should NOT cancel details request when list request starts', async () => {
			let detailsAborted = false;
			(axios.get as Mock)
				.mockImplementationOnce(
					(_url: string, config: { signal: AbortSignal }) =>
						new Promise((resolve) => {
							config.signal.addEventListener('abort', () => {
								detailsAborted = true;
							});
							// Resolve after a tick
							setTimeout(() => resolve({ data: [] }), 10);
						})
				)
				.mockResolvedValueOnce({ data: [] });

			// Start details request
			const details = merchantList.fetchEnrichedDetails({ lat: 0, lon: 0 }, 10);

			// Start list request (should NOT abort details)
			const list = merchantList.fetchAndReplaceList({ lat: 1, lon: 1 }, 10);

			await Promise.all([details, list]);

			expect(detailsAborted).toBe(false);
		});

		it('should cancel all requests on close()', async () => {
			let listAborted = false;
			let detailsAborted = false;

			(axios.get as Mock)
				.mockImplementationOnce(
					(_url: string, config: { signal: AbortSignal }) =>
						new Promise((_, reject) => {
							config.signal.addEventListener('abort', () => {
								listAborted = true;
								const error = new Error('Aborted');
								error.name = 'AbortError';
								reject(error);
							});
						})
				)
				.mockImplementationOnce(
					(_url: string, config: { signal: AbortSignal }) =>
						new Promise((_, reject) => {
							config.signal.addEventListener('abort', () => {
								detailsAborted = true;
								const error = new Error('Aborted');
								error.name = 'AbortError';
								reject(error);
							});
						})
				);

			// Start both requests
			const list = merchantList.fetchAndReplaceList({ lat: 0, lon: 0 }, 10);
			const details = merchantList.fetchEnrichedDetails({ lat: 0, lon: 0 }, 10);

			// Close should cancel both
			merchantList.close();

			await Promise.all([list.catch(() => {}), details.catch(() => {})]);

			expect(listAborted).toBe(true);
			expect(detailsAborted).toBe(true);
		});
	});
});

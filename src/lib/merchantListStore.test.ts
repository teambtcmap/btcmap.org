import axios from "axios";
import { get } from "svelte/store";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Place } from "$lib/types";

// Mock axios
vi.mock("axios");

// Mock errToast and calculateDistance
vi.mock("$lib/utils", async () => {
	const actual = await vi.importActual("$lib/utils");
	return {
		...actual,
		errToast: vi.fn(),
	};
});

// Mock isBoosted from merchantDrawerLogic
vi.mock("$lib/merchantDrawerLogic", () => ({
	isBoosted: (place: Place) =>
		place.boosted_until && new Date(place.boosted_until) > new Date(),
}));

// Mock userLocationStore - must return proper store value for get()
vi.mock("$lib/userLocationStore", async () => {
	const { writable } =
		await vi.importActual<typeof import("svelte/store")>("svelte/store");
	const mockStore = writable({
		location: null,
		lastUpdated: null,
		usesMetricSystem: null,
	});
	return {
		userLocation: mockStore,
		getLocationWithCache: vi.fn().mockResolvedValue(null),
		getLocation: vi.fn().mockResolvedValue(null),
		reSortByUserLocation: vi.fn(),
	};
});

import { errToast } from "$lib/utils";

// Import after mocks are set up
import { merchantList } from "./merchantListStore";

// Helper to create mock Place objects
function createMockPlace(overrides: Partial<Place> = {}): Place {
	return {
		id: Math.floor(Math.random() * 10000),
		lat: 0,
		lon: 0,
		name: "Test Place",
		...overrides,
	} as Place;
}

describe("merchantListStore", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		merchantList.reset();
	});

	describe("state toggles", () => {
		it("open() should set isOpen to true", () => {
			merchantList.open();
			const state = get(merchantList);
			expect(state.isOpen).toBe(true);
		});

		it("close() should hide panel but keep data", () => {
			// Set up some state first
			merchantList.open();
			merchantList.setMerchants([createMockPlace()], 0, 0);

			merchantList.close();
			const state = get(merchantList);

			expect(state.isOpen).toBe(false);
			// Data should be preserved (count visible on button)
			expect(state.merchants.length).toBe(1);
			expect(state.totalCount).toBe(1);
		});

		it("reset() should restore initial state and clear all data", () => {
			merchantList.open();
			merchantList.setMerchants([createMockPlace()], 0, 0);

			merchantList.reset();
			const state = get(merchantList);

			expect(state.isOpen).toBe(false);
			expect(state.merchants).toEqual([]);
			expect(state.totalCount).toBe(0);
			expect(state.isLoadingList).toBe(false);
			expect(state.isEnrichingDetails).toBe(false);
		});
	});

	describe("setMerchants", () => {
		it("should limit results to default max items", () => {
			const merchants = Array.from({ length: 100 }, (_, i) =>
				createMockPlace({ id: i, name: `Place ${i}` }),
			);

			merchantList.setMerchants(merchants, 0, 0);
			const state = get(merchantList);

			expect(state.merchants.length).toBe(99); // MERCHANT_LIST_MAX_ITEMS
			expect(state.totalCount).toBe(100);
		});

		it("should update totalCount with full array length", () => {
			const merchants = Array.from({ length: 75 }, (_, i) =>
				createMockPlace({ id: i }),
			);

			merchantList.setMerchants(merchants, 0, 0);
			const state = get(merchantList);

			expect(state.totalCount).toBe(75);
		});

		it("should set isLoadingList to false", () => {
			merchantList.setMerchants([createMockPlace()], 0, 0);
			const state = get(merchantList);
			expect(state.isLoadingList).toBe(false);
		});

		it("should respect custom limit parameter", () => {
			const merchants = Array.from({ length: 20 }, (_, i) =>
				createMockPlace({ id: i }),
			);

			merchantList.setMerchants(merchants, 0, 0, 5);
			const state = get(merchantList);

			expect(state.merchants.length).toBe(5);
			expect(state.totalCount).toBe(20);
		});
	});

	describe("merchant sorting", () => {
		it("should place boosted merchants first", () => {
			const futureDate = new Date(Date.now() + 86400000).toISOString(); // Tomorrow
			const boosted = createMockPlace({
				id: 1,
				name: "Boosted",
				boosted_until: futureDate,
			});
			const regular = createMockPlace({ id: 2, name: "Regular" });

			merchantList.setMerchants([regular, boosted], 0, 0);
			const state = get(merchantList);

			expect(state.merchants[0].id).toBe(1); // Boosted first
			expect(state.merchants[1].id).toBe(2);
		});

		it("should sort by distance when center provided", () => {
			const near = createMockPlace({
				id: 1,
				name: "Near",
				lat: 0.001,
				lon: 0.001,
			});
			const far = createMockPlace({ id: 2, name: "Far", lat: 1, lon: 1 });

			merchantList.setMerchants([far, near], 0, 0);
			const state = get(merchantList);

			expect(state.merchants[0].id).toBe(1); // Near first
			expect(state.merchants[1].id).toBe(2);
		});

		it("should fallback to alphabetical when no center", () => {
			const placeB = createMockPlace({ id: 1, name: "Beta" });
			const placeA = createMockPlace({ id: 2, name: "Alpha" });

			merchantList.setMerchants([placeB, placeA]);
			const state = get(merchantList);

			expect(state.merchants[0].name).toBe("Alpha");
			expect(state.merchants[1].name).toBe("Beta");
		});

		it("should handle merchants without names", () => {
			const withName = createMockPlace({ id: 1, name: "Has Name" });
			const withoutName = createMockPlace({ id: 2, name: "" });
			const nullName = createMockPlace({ id: 3 });
			delete (nullName as Partial<Place>).name;

			// Should not throw
			merchantList.setMerchants([withName, withoutName, nullName]);
			const state = get(merchantList);
			expect(state.merchants.length).toBe(3);
		});
	});

	describe("fetchAndReplaceList", () => {
		it("should set isLoadingList while fetching", async () => {
			const mockResponse = { data: [] };
			(axios.get as Mock).mockResolvedValueOnce(mockResponse);

			const fetchPromise = merchantList.fetchAndReplaceList(
				{ lat: 0, lon: 0 },
				10,
			);

			// Check loading state immediately
			let state = get(merchantList);
			expect(state.isLoadingList).toBe(true);

			await fetchPromise;

			state = get(merchantList);
			expect(state.isLoadingList).toBe(false);
		});

		it("should populate merchants on success", async () => {
			const mockPlaces = [
				createMockPlace({ id: 1 }),
				createMockPlace({ id: 2 }),
			];
			(axios.get as Mock).mockResolvedValueOnce({ data: mockPlaces });

			await merchantList.fetchAndReplaceList({ lat: 0, lon: 0 }, 10);
			const state = get(merchantList);

			expect(state.merchants.length).toBe(2);
			expect(state.totalCount).toBe(2);
		});

		it("should build placeDetailsCache from response", async () => {
			const mockPlaces = [
				createMockPlace({ id: 123 }),
				createMockPlace({ id: 456 }),
			];
			(axios.get as Mock).mockResolvedValueOnce({ data: mockPlaces });

			await merchantList.fetchAndReplaceList({ lat: 0, lon: 0 }, 10);
			const state = get(merchantList);

			expect(state.placeDetailsCache.has(123)).toBe(true);
			expect(state.placeDetailsCache.has(456)).toBe(true);
		});

		it("should clear merchants when hideIfExceeds triggered", async () => {
			const mockPlaces = Array.from({ length: 60 }, (_, i) =>
				createMockPlace({ id: i }),
			);
			(axios.get as Mock).mockResolvedValueOnce({ data: mockPlaces });

			await merchantList.fetchAndReplaceList({ lat: 0, lon: 0 }, 10, {
				hideIfExceeds: 50,
			});
			const state = get(merchantList);

			expect(state.merchants).toEqual([]);
			expect(state.totalCount).toBe(60);
		});

		it("should store totalCount even when hiding results", async () => {
			const mockPlaces = Array.from({ length: 100 }, (_, i) =>
				createMockPlace({ id: i }),
			);
			(axios.get as Mock).mockResolvedValueOnce({ data: mockPlaces });

			await merchantList.fetchAndReplaceList({ lat: 0, lon: 0 }, 10, {
				hideIfExceeds: 50,
			});
			const state = get(merchantList);

			expect(state.totalCount).toBe(100);
		});

		it("should show error toast on failure", async () => {
			const error = new Error("Network error");
			(axios.get as Mock).mockRejectedValueOnce(error);

			await merchantList.fetchAndReplaceList({ lat: 0, lon: 0 }, 10);

			expect(errToast).toHaveBeenCalledWith("Failed to load nearby merchants");
		});

		it("should ignore AbortError (no toast)", async () => {
			const abortError = new Error("Aborted");
			abortError.name = "AbortError";
			(axios.get as Mock).mockRejectedValueOnce(abortError);

			await merchantList.fetchAndReplaceList({ lat: 0, lon: 0 }, 10);

			expect(errToast).not.toHaveBeenCalled();
		});
	});

	describe("fetchCountOnly", () => {
		it("should request only id field", async () => {
			(axios.get as Mock).mockResolvedValueOnce({ data: [] });

			await merchantList.fetchCountOnly({ lat: 10, lon: 20 }, 5);

			expect(axios.get).toHaveBeenCalledWith(
				expect.stringContaining("fields=id"),
				expect.any(Object),
			);
		});

		it("should set totalCount from response length", async () => {
			const mockIds = [{ id: 1 }, { id: 2 }, { id: 3 }];
			(axios.get as Mock).mockResolvedValueOnce({ data: mockIds });

			await merchantList.fetchCountOnly({ lat: 0, lon: 0 }, 10);
			const state = get(merchantList);

			expect(state.totalCount).toBe(3);
		});

		it("should leave merchants empty", async () => {
			const mockIds = [{ id: 1 }, { id: 2 }];
			(axios.get as Mock).mockResolvedValueOnce({ data: mockIds });

			await merchantList.fetchCountOnly({ lat: 0, lon: 0 }, 10);
			const state = get(merchantList);

			expect(state.merchants).toEqual([]);
		});

		it("should not show error toast on failure", async () => {
			const error = new Error("Network error");
			(axios.get as Mock).mockRejectedValueOnce(error);

			await merchantList.fetchCountOnly({ lat: 0, lon: 0 }, 10);

			expect(errToast).not.toHaveBeenCalled();
		});
	});

	describe("fetchEnrichedDetails", () => {
		it("should merge into existing cache (not replace)", async () => {
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

		it("should set isEnrichingDetails during fetch", async () => {
			(axios.get as Mock).mockResolvedValueOnce({ data: [] });

			const fetchPromise = merchantList.fetchEnrichedDetails(
				{ lat: 0, lon: 0 },
				10,
			);

			let state = get(merchantList);
			expect(state.isEnrichingDetails).toBe(true);

			await fetchPromise;

			state = get(merchantList);
			expect(state.isEnrichingDetails).toBe(false);
		});

		it("should not affect isLoadingList", async () => {
			(axios.get as Mock).mockResolvedValueOnce({ data: [] });

			const fetchPromise = merchantList.fetchEnrichedDetails(
				{ lat: 0, lon: 0 },
				10,
			);

			const state = get(merchantList);
			expect(state.isLoadingList).toBe(false);

			await fetchPromise;
		});
	});

	describe("request cancellation", () => {
		it("should cancel previous list request when new one starts", async () => {
			let firstAborted = false;
			(axios.get as Mock)
				.mockImplementationOnce(
					(_url: string, config: { signal: AbortSignal }) =>
						new Promise((_, reject) => {
							config.signal.addEventListener("abort", () => {
								firstAborted = true;
								const error = new Error("Aborted");
								error.name = "AbortError";
								reject(error);
							});
						}),
				)
				.mockResolvedValueOnce({ data: [] });

			// Start first request (will hang)
			const first = merchantList.fetchAndReplaceList({ lat: 0, lon: 0 }, 10);

			// Start second request (should abort first)
			const second = merchantList.fetchAndReplaceList({ lat: 1, lon: 1 }, 10);

			await Promise.all([first.catch(() => {}), second]);

			expect(firstAborted).toBe(true);
		});

		it("should NOT cancel details request when list request starts", async () => {
			let detailsAborted = false;
			(axios.get as Mock)
				.mockImplementationOnce(
					(_url: string, config: { signal: AbortSignal }) =>
						new Promise((resolve) => {
							config.signal.addEventListener("abort", () => {
								detailsAborted = true;
							});
							// Resolve after a tick
							setTimeout(() => resolve({ data: [] }), 10);
						}),
				)
				.mockResolvedValueOnce({ data: [] });

			// Start details request
			const details = merchantList.fetchEnrichedDetails({ lat: 0, lon: 0 }, 10);

			// Start list request (should NOT abort details)
			const list = merchantList.fetchAndReplaceList({ lat: 1, lon: 1 }, 10);

			await Promise.all([details, list]);

			expect(detailsAborted).toBe(false);
		});

		it("should cancel all requests on reset()", async () => {
			let listAborted = false;
			let detailsAborted = false;

			(axios.get as Mock)
				.mockImplementationOnce(
					(_url: string, config: { signal: AbortSignal }) =>
						new Promise((_, reject) => {
							config.signal.addEventListener("abort", () => {
								listAborted = true;
								const error = new Error("Aborted");
								error.name = "AbortError";
								reject(error);
							});
						}),
				)
				.mockImplementationOnce(
					(_url: string, config: { signal: AbortSignal }) =>
						new Promise((_, reject) => {
							config.signal.addEventListener("abort", () => {
								detailsAborted = true;
								const error = new Error("Aborted");
								error.name = "AbortError";
								reject(error);
							});
						}),
				);

			// Start both requests
			const list = merchantList.fetchAndReplaceList({ lat: 0, lon: 0 }, 10);
			const details = merchantList.fetchEnrichedDetails({ lat: 0, lon: 0 }, 10);

			// Reset should cancel both
			merchantList.reset();

			await Promise.all([list.catch(() => {}), details.catch(() => {})]);

			expect(listAborted).toBe(true);
			expect(detailsAborted).toBe(true);
		});

		it("close() should NOT cancel requests (just hide panel)", async () => {
			let requestAborted = false;

			(axios.get as Mock).mockImplementationOnce(
				(_url: string, config: { signal: AbortSignal }) =>
					new Promise((resolve) => {
						config.signal.addEventListener("abort", () => {
							requestAborted = true;
						});
						// Resolve after a short delay
						setTimeout(() => resolve({ data: [] }), 50);
					}),
			);

			// Start a request
			const list = merchantList.fetchAndReplaceList({ lat: 0, lon: 0 }, 10);

			// Close should NOT cancel the request
			merchantList.close();

			await list;

			expect(requestAborted).toBe(false);
		});
	});

	describe("search state", () => {
		it("openSearchMode() should open panel in search mode with optional spinner", () => {
			merchantList.openSearchMode(true);
			const state = get(merchantList);

			expect(state.isSearching).toBe(true);
			expect(state.mode).toBe("search");
			expect(state.isOpen).toBe(true);
		});

		it("openSearchMode() without argument should not show spinner", () => {
			merchantList.openSearchMode();
			const state = get(merchantList);

			expect(state.isSearching).toBe(false);
			expect(state.mode).toBe("search");
			expect(state.isOpen).toBe(true);
		});

		it("openWithSearchResults() should set mode, query, and results", () => {
			const results = [createMockPlace({ id: 1 }), createMockPlace({ id: 2 })];
			merchantList.openWithSearchResults("pizza", results);
			const state = get(merchantList);

			expect(state.mode).toBe("search");
			expect(state.searchQuery).toBe("pizza");
			expect(state.searchResults.length).toBe(2);
			expect(state.isSearching).toBe(false);
			expect(state.isOpen).toBe(true);
		});

		it("openWithSearchResults() should sort boosted merchants first", () => {
			const futureDate = new Date(Date.now() + 86400000).toISOString();
			const boosted = createMockPlace({
				id: 1,
				name: "Boosted",
				boosted_until: futureDate,
			});
			const regular = createMockPlace({ id: 2, name: "Regular" });

			merchantList.openWithSearchResults("test", [regular, boosted]);
			const state = get(merchantList);

			expect(state.searchResults[0].id).toBe(1); // Boosted first
			expect(state.searchResults[1].id).toBe(2);
		});

		it("openWithSearchResults() should calculate category counts from results", () => {
			const results = [
				createMockPlace({ id: 1, icon: "restaurant" }),
				createMockPlace({ id: 2, icon: "restaurant" }),
				createMockPlace({ id: 3, icon: "local_cafe" }),
				createMockPlace({ id: 4, icon: "local_atm" }),
			];

			merchantList.openWithSearchResults("test query", results);
			const state = get(merchantList);

			expect(state.categoryCounts.all).toBe(4);
			expect(state.categoryCounts.restaurants).toBe(2);
			expect(state.categoryCounts.coffee).toBe(1);
			expect(state.categoryCounts.atms).toBe(1);
			expect(state.categoryCounts.shopping).toBe(0);
		});

		it("clearSearchInput() should clear results but keep search mode", () => {
			merchantList.openWithSearchResults("test", [createMockPlace()]);
			merchantList.clearSearchInput();
			const state = get(merchantList);

			expect(state.mode).toBe("search"); // Mode preserved
			expect(state.searchQuery).toBe("");
			expect(state.searchResults).toEqual([]);
			expect(state.isSearching).toBe(false);
		});

		it("exitSearchMode() should switch to nearby mode and clear search state", () => {
			merchantList.openWithSearchResults("test", [createMockPlace()]);
			merchantList.exitSearchMode();
			const state = get(merchantList);

			expect(state.mode).toBe("nearby");
			expect(state.searchQuery).toBe("");
			expect(state.searchResults).toEqual([]);
			expect(state.isSearching).toBe(false);
		});

		it("setMode() should switch to search mode", () => {
			merchantList.setMode("search");
			const state = get(merchantList);

			expect(state.mode).toBe("search");
		});

		it("setMode() should switch to nearby mode without clearing search state", () => {
			// Set up search state first
			merchantList.openWithSearchResults("pizza", [createMockPlace()]);

			merchantList.setMode("nearby");
			const state = get(merchantList);

			// Mode changes but search state is preserved (no side effects)
			expect(state.mode).toBe("nearby");
			expect(state.searchQuery).toBe("pizza");
			expect(state.searchResults.length).toBe(1);
		});
	});

	describe("category filtering", () => {
		// Helper to create places with specific icons for category testing
		function createPlaceWithIcon(
			icon: string,
			overrides: Partial<Place> = {},
		): Place {
			return createMockPlace({ icon, ...overrides });
		}

		describe("setSelectedCategory and resetCategory", () => {
			it("setSelectedCategory() should update selectedCategory in state", () => {
				merchantList.setSelectedCategory("restaurants");
				const state = get(merchantList);
				expect(state.selectedCategory).toBe("restaurants");
			});

			it("setSelectedCategory() should allow setting any valid category", () => {
				const categories = [
					"all",
					"restaurants",
					"shopping",
					"groceries",
					"coffee",
					"atms",
					"hotels",
					"beauty",
				] as const;

				for (const category of categories) {
					merchantList.setSelectedCategory(category);
					const state = get(merchantList);
					expect(state.selectedCategory).toBe(category);
				}
			});

			it("resetCategory() should reset selectedCategory to all", () => {
				merchantList.setSelectedCategory("coffee");
				merchantList.resetCategory();
				const state = get(merchantList);
				expect(state.selectedCategory).toBe("all");
			});
		});

		describe("category state reset on close", () => {
			it("close() should reset category to all", () => {
				merchantList.open();
				merchantList.setSelectedCategory("restaurants");
				merchantList.close();
				const state = get(merchantList);
				expect(state.selectedCategory).toBe("all");
			});

			it("close() should preserve merchants while resetting category", () => {
				const merchants = [createPlaceWithIcon("restaurant", { id: 1 })];
				merchantList.setMerchants(merchants, 0, 0);
				merchantList.setSelectedCategory("restaurants");
				merchantList.close();
				const state = get(merchantList);

				expect(state.selectedCategory).toBe("all");
				expect(state.merchants.length).toBe(1);
			});

			it("close() should reset all search state (mode, query, results, isSearching)", () => {
				// Set up search state
				merchantList.openWithSearchResults("pizza", [
					createPlaceWithIcon("restaurant", { id: 1 }),
					createPlaceWithIcon("restaurant", { id: 2 }),
				]);

				// Verify search state is set
				let state = get(merchantList);
				expect(state.mode).toBe("search");
				expect(state.searchQuery).toBe("pizza");
				expect(state.searchResults.length).toBe(2);
				expect(state.isOpen).toBe(true);

				// Close should reset all search state
				merchantList.close();
				state = get(merchantList);

				expect(state.isOpen).toBe(false);
				expect(state.mode).toBe("nearby");
				expect(state.searchQuery).toBe("");
				expect(state.searchResults).toEqual([]);
				expect(state.isSearching).toBe(false);
				expect(state.selectedCategory).toBe("all");
			});
		});

		describe("category state reset on search actions", () => {
			it("openWithSearchResults() should reset category to all", () => {
				merchantList.setSelectedCategory("coffee");
				merchantList.openWithSearchResults("test", [createMockPlace()]);
				const state = get(merchantList);
				expect(state.selectedCategory).toBe("all");
			});

			it("clearSearchInput() should reset category to all", () => {
				merchantList.openSearchMode();
				merchantList.setSelectedCategory("atms");
				merchantList.clearSearchInput();
				const state = get(merchantList);
				expect(state.selectedCategory).toBe("all");
			});

			it("exitSearchMode() should reset category to all", () => {
				merchantList.openSearchMode();
				merchantList.setSelectedCategory("hotels");
				merchantList.exitSearchMode();
				const state = get(merchantList);
				expect(state.selectedCategory).toBe("all");
			});
		});

		describe("category counts", () => {
			it("setMerchants() should calculate category counts", () => {
				const merchants = [
					createPlaceWithIcon("restaurant", { id: 1 }),
					createPlaceWithIcon("restaurant", { id: 2 }),
					createPlaceWithIcon("local_cafe", { id: 3 }),
					createPlaceWithIcon("local_atm", { id: 4 }),
				];

				merchantList.setMerchants(merchants, 0, 0);
				const state = get(merchantList);

				expect(state.categoryCounts.all).toBe(4);
				expect(state.categoryCounts.restaurants).toBe(2);
				expect(state.categoryCounts.coffee).toBe(1);
				expect(state.categoryCounts.atms).toBe(1);
				expect(state.categoryCounts.shopping).toBe(0);
			});

			it("setMerchants() should handle merchants without icons", () => {
				const merchants = [
					createPlaceWithIcon("restaurant", { id: 1 }),
					createMockPlace({ id: 2 }), // No icon
					createMockPlace({ id: 3, icon: undefined }),
				];

				merchantList.setMerchants(merchants, 0, 0);
				const state = get(merchantList);

				expect(state.categoryCounts.all).toBe(3);
				expect(state.categoryCounts.restaurants).toBe(1);
			});
		});

		describe("category filtering in setMerchants", () => {
			it("should filter merchants by selected category", () => {
				merchantList.setSelectedCategory("restaurants");

				const merchants = [
					createPlaceWithIcon("restaurant", { id: 1, name: "Restaurant A" }),
					createPlaceWithIcon("local_cafe", { id: 2, name: "Cafe B" }),
					createPlaceWithIcon("restaurant", { id: 3, name: "Restaurant C" }),
				];

				merchantList.setMerchants(merchants, 0, 0);
				const state = get(merchantList);

				expect(state.merchants.length).toBe(2);
				expect(state.merchants.every((m) => m.icon === "restaurant")).toBe(
					true,
				);
				expect(state.totalCount).toBe(2);
			});

			it("should show all merchants when category is all", () => {
				merchantList.setSelectedCategory("all");

				const merchants = [
					createPlaceWithIcon("restaurant", { id: 1 }),
					createPlaceWithIcon("local_cafe", { id: 2 }),
					createPlaceWithIcon("local_atm", { id: 3 }),
				];

				merchantList.setMerchants(merchants, 0, 0);
				const state = get(merchantList);

				expect(state.merchants.length).toBe(3);
				expect(state.totalCount).toBe(3);
			});
		});

		describe("auto-reset category when no matches", () => {
			it("should auto-reset to all when selected category has no matches but other merchants exist", () => {
				// First set up with restaurants
				merchantList.setSelectedCategory("restaurants");
				const initialMerchants = [
					createPlaceWithIcon("restaurant", { id: 1 }),
					createPlaceWithIcon("local_cafe", { id: 2 }),
				];
				merchantList.setMerchants(initialMerchants, 0, 0);

				// Now update with merchants that have no restaurants
				const newMerchants = [
					createPlaceWithIcon("local_cafe", { id: 3 }),
					createPlaceWithIcon("local_atm", { id: 4 }),
				];
				merchantList.setMerchants(newMerchants, 0, 0);

				const state = get(merchantList);

				// Should auto-reset to 'all' since there are no restaurants
				expect(state.selectedCategory).toBe("all");
				expect(state.merchants.length).toBe(2);
				expect(state.categoryCounts.restaurants).toBe(0);
				expect(state.categoryCounts.all).toBe(2);
			});

			it("should NOT auto-reset when selected category still has matches", () => {
				merchantList.setSelectedCategory("restaurants");

				const merchants = [
					createPlaceWithIcon("restaurant", { id: 1 }),
					createPlaceWithIcon("local_cafe", { id: 2 }),
				];
				merchantList.setMerchants(merchants, 0, 0);

				const state = get(merchantList);

				expect(state.selectedCategory).toBe("restaurants");
				expect(state.merchants.length).toBe(1);
			});

			it("should NOT auto-reset when no merchants exist at all (empty area)", () => {
				merchantList.setSelectedCategory("restaurants");

				// Simulate panning to empty area
				merchantList.setMerchants([], 0, 0);

				const state = get(merchantList);

				// Should keep restaurants selected - no point resetting when area is empty
				expect(state.selectedCategory).toBe("restaurants");
				expect(state.merchants.length).toBe(0);
				expect(state.categoryCounts.all).toBe(0);
			});

			it("should NOT auto-reset when category is already all", () => {
				merchantList.setSelectedCategory("all");

				const merchants = [createPlaceWithIcon("local_cafe", { id: 1 })];
				merchantList.setMerchants(merchants, 0, 0);

				const state = get(merchantList);

				expect(state.selectedCategory).toBe("all");
			});
		});

		describe("fetchAndReplaceList with categories", () => {
			it("should calculate category counts from API response", async () => {
				const mockPlaces = [
					createPlaceWithIcon("restaurant", { id: 1 }),
					createPlaceWithIcon("restaurant", { id: 2 }),
					createPlaceWithIcon("local_cafe", { id: 3 }),
				];
				(axios.get as Mock).mockResolvedValueOnce({ data: mockPlaces });

				await merchantList.fetchAndReplaceList({ lat: 0, lon: 0 }, 10);
				const state = get(merchantList);

				expect(state.categoryCounts.all).toBe(3);
				expect(state.categoryCounts.restaurants).toBe(2);
				expect(state.categoryCounts.coffee).toBe(1);
			});

			it("should apply category filter to API results", async () => {
				merchantList.setSelectedCategory("restaurants");

				const mockPlaces = [
					createPlaceWithIcon("restaurant", { id: 1 }),
					createPlaceWithIcon("local_cafe", { id: 2 }),
					createPlaceWithIcon("restaurant", { id: 3 }),
				];
				(axios.get as Mock).mockResolvedValueOnce({ data: mockPlaces });

				await merchantList.fetchAndReplaceList({ lat: 0, lon: 0 }, 10);
				const state = get(merchantList);

				expect(state.merchants.length).toBe(2);
				expect(state.totalCount).toBe(2);
				expect(state.categoryCounts.all).toBe(3); // Full counts preserved
			});

			it("should auto-reset category when API returns no matches for selected category", async () => {
				merchantList.setSelectedCategory("restaurants");

				const mockPlaces = [
					createPlaceWithIcon("local_cafe", { id: 1 }),
					createPlaceWithIcon("local_atm", { id: 2 }),
				];
				(axios.get as Mock).mockResolvedValueOnce({ data: mockPlaces });

				await merchantList.fetchAndReplaceList({ lat: 0, lon: 0 }, 10);
				const state = get(merchantList);

				expect(state.selectedCategory).toBe("all");
				expect(state.merchants.length).toBe(2);
			});

			it("should still calculate category counts when hideIfExceeds is triggered", async () => {
				const mockPlaces = Array.from({ length: 60 }, (_, i) =>
					createPlaceWithIcon(i % 2 === 0 ? "restaurant" : "local_cafe", {
						id: i,
					}),
				);
				(axios.get as Mock).mockResolvedValueOnce({ data: mockPlaces });

				await merchantList.fetchAndReplaceList({ lat: 0, lon: 0 }, 10, {
					hideIfExceeds: 50,
				});
				const state = get(merchantList);

				expect(state.merchants).toEqual([]);
				expect(state.categoryCounts.all).toBe(60);
				expect(state.categoryCounts.restaurants).toBe(30);
				expect(state.categoryCounts.coffee).toBe(30);
			});
		});
	});
});

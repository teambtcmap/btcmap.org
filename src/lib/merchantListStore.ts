import axios from "axios";
import { get, writable } from "svelte/store";

import { API_BASE } from "$lib/api-base";
import { buildFieldsParam, PLACE_FIELD_SETS } from "$lib/api-fields";
import api from "$lib/axios";
import {
	type CategoryCounts,
	type CategoryKey,
	createEmptyCategoryCounts,
} from "$lib/categoryMapping";
import { MERCHANT_LIST_MAX_ITEMS } from "$lib/constants";
import { _ } from "$lib/i18n";
import type { VerifiedFilterYears } from "$lib/map/verifiedFilter";
import {
	getStoredVerifiedFilter,
	storeVerifiedFilter,
} from "$lib/map/verifiedFilter";
import { selectVisiblePlaces } from "$lib/map/visiblePlaces";
import { isBoosted } from "$lib/merchantDrawerLogic";
import { verifiedDatesLoaded } from "$lib/store";
import type { Place } from "$lib/types";
import type { UserLocation } from "$lib/userLocationStore";
import { userLocation } from "$lib/userLocationStore";
import { calculateDistance, errToast } from "$lib/utils";
import { filterPlacesByRecency } from "$lib/verification";

export type MerchantListMode = "nearby" | "search";

export type MerchantListState = {
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
	// Total matches on the server. The API caps how many it returns, so this can
	// exceed searchResults.length; the panel surfaces the gap rather than
	// presenting a truncated slice as the whole result set.
	searchTotal: number;
	isSearching: boolean;
	// Category filter
	selectedCategory: CategoryKey;
	categoryCounts: CategoryCounts;
	// "Verified within N years" filter (null = Any/off); persisted to localStorage
	verifiedWithinYears: VerifiedFilterYears;
};

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
	searchTotal: 0,
	isSearching: false,
	selectedCategory: "all",
	categoryCounts: createEmptyCategoryCounts(),
	verifiedWithinYears: getStoredVerifiedFilter(),
};

// Helper function to reset category state
function resetCategoryState<T extends MerchantListState>(state: T): T {
	return { ...state, selectedCategory: "all" };
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
			return (
				(distanceMap.get(a.id) ?? Infinity) -
				(distanceMap.get(b.id) ?? Infinity)
			);
		}

		// Fallback to alphabetical
		return (a.name || "").localeCompare(b.name || "");
	});
}

// Deliberate aborts from our AbortControllers surface as axios CanceledError
// (axios.isCancel) — or a native AbortError — and are not failures: rapid
// pans and zoom-boundary crossings cancel the prior request every time.
function isCancellation(error: Error): boolean {
	return axios.isCancel(error) || error.name === "AbortError";
}

// Filter out invalid API response items missing required id field
function filterValidPlaces<T extends { id?: unknown }>(items: T[]): T[] {
	return items.filter((item): item is T => typeof item?.id === "number");
}

// The one radius-search fetcher behind the three list reducers
// (fetchAndReplaceList, fetchCountOnly, fetchEnrichedDetails). Owns the URL
// shape, the 10s transport policy, the array-shape validation (the API can
// return an HTML error page), and the dropping of rows without a numeric id.
// What each reducer does with the rows — and how loudly it fails — stays
// that reducer's own policy.
async function searchPlacesInRadius<T extends { id?: unknown }>(
	center: { lat: number; lon: number },
	radiusKm: number,
	fields: string,
	signal: AbortSignal,
): Promise<T[]> {
	const response = await api.get<T[]>(
		`${API_BASE}/v4/places/search/?lat=${center.lat}&lon=${center.lon}&radius_km=${radiusKm}&fields=${fields}`,
		{ timeout: 10000, signal },
	);
	if (!Array.isArray(response.data)) {
		throw new Error("API returned invalid data format");
	}
	return filterValidPlaces(response.data);
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
				searchTotal: 0,
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
			const { selectedCategory, verifiedWithinYears } = get(store);
			// The shared pipeline applies the recency window (gated on the lazy
			// dates being loaded, matching the markers), computes chip counts on
			// the pre-category set, and applies the auto-reset rule — one
			// decision path for list, pins, and counts.
			const { selection, counts, effectiveCategory } = selectVisiblePlaces({
				places: merchants,
				mode: "nearby",
				category: selectedCategory,
				recency: verifiedWithinYears,
				recencyReady: verifiedWithinYears == null || get(verifiedDatesLoaded),
				boostsOnly: false,
			});

			const sorted = sortMerchants(
				selection,
				centerLat,
				centerLon,
				get(userLocation).location,
			);
			const limited = sorted.slice(0, limit);

			update((state) => ({
				...state,
				merchants: limited,
				totalCount: selection.length,
				isLoadingList: false,
				categoryCounts: counts,
				selectedCategory: effectiveCategory,
			}));
		},

		// Fetch merchants from API and replace the current list
		// Used at high zoom (17+) and low zoom (10-14) where we can't rely on loaded markers
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
				const validPlaces = await searchPlacesInRadius<Place>(
					center,
					radiusKm,
					buildFieldsParam(PLACE_FIELD_SETS.LIST_ITEM),
					listAbortController.signal,
				);

				// Build cache for enriched display (icons, addresses, etc.)
				const placeDetailsCache = new Map<number, Place>();
				validPlaces.forEach((place) => placeDetailsCache.set(place.id, place));

				// The shared pipeline applies the recency window before the density
				// check (API rows carry verified_at, so recencyReady is
				// unconditionally true here): a narrow window can bring an
				// otherwise-too-dense area under the ceiling, so the filter stays
				// effective at zoom 10-14. The density ceiling compares the
				// PRE-category set — a selected chip must not defeat it.
				const { selectedCategory, verifiedWithinYears } = get(store);
				const { selection, preCategory, counts, effectiveCategory } =
					selectVisiblePlaces({
						places: validPlaces,
						mode: "nearby",
						category: selectedCategory,
						recency: verifiedWithinYears,
						recencyReady: true,
						boostsOnly: false,
					});

				// Check if we should hide results (too many at low zoom)
				if (
					options?.hideIfExceeds &&
					preCategory.length > options.hideIfExceeds
				) {
					// Too many results - store count but show empty list
					// The panel will display "zoom in" message, button shows count.
					// The auto-reset still persists: a selected chip whose count
					// dropped to zero must snap back to "all" here too, or the chip
					// state disagrees with the markers (which render the pipeline's
					// reset selection independently).
					update((state) => ({
						...state,
						merchants: [],
						totalCount: preCategory.length,
						isLoadingList: false,
						categoryCounts: counts,
						selectedCategory: effectiveCategory,
					}));
				} else {
					const sorted = sortMerchants(
						selection,
						center.lat,
						center.lon,
						get(userLocation).location,
					);
					const limited = sorted.slice(0, MERCHANT_LIST_MAX_ITEMS);
					update((state) => ({
						...state,
						merchants: limited,
						totalCount: selection.length,
						placeDetailsCache,
						isLoadingList: false,
						categoryCounts: counts,
						selectedCategory: effectiveCategory,
					}));
				}
			} catch (error) {
				if (error instanceof Error && !isCancellation(error)) {
					console.warn("Failed to fetch merchant list:", error.message);
					errToast(get(_)("errors.loadFailed"));
				}
				update((state) => ({ ...state, isLoadingList: false }));
			}
		},

		// Count-only fetch for the closed-panel badge at zoom 10-14. Minimal
		// payload: ids alone, widened with verified_at only while the recency
		// filter is active so the badge counts the same set the markers and the
		// open panel show (matching fetchAndReplaceList's hideIfExceeds policy,
		// which is the state users transition into on open). Category needs
		// nothing here: close() resets it to "all" and this path only runs with
		// the panel closed. Search rows carry verified_at natively, so no
		// verifiedDatesLoaded gate applies — that gate exists for the bulk
		// $places feed, which lacks dates until enrichment. Deliberate trade:
		// during the one-time enrichment fetch the badge (like the open panel
		// list, which filters ungated for the same reason) is filtered while
		// the markers briefly are not; gating the badge instead would make it
		// disagree with the list at the open/close boundary — the exact
		// mismatch this method exists to prevent.
		async fetchCountOnly(
			center: { lat: number; lon: number },
			radiusKm: number,
		) {
			cancelListRequest();
			listAbortController = new AbortController();

			update((state) => ({ ...state, isLoadingList: true }));

			// One snapshot so the fields param and the post-response filter can
			// never disagree; a mid-flight filter change re-invokes this method,
			// which aborts the stale request above.
			const { verifiedWithinYears } = get(store);
			const fields = verifiedWithinYears == null ? "id" : "id,verified_at";

			try {
				// Typed to the payload actually requested — these rows are not
				// full Places and must not be handed to anything expecting one.
				const validItems = await searchPlacesInRadius<
					Pick<Place, "id" | "verified_at">
				>(center, radiusKm, fields, listAbortController.signal);
				const recencyPlaces = filterPlacesByRecency(
					validItems,
					verifiedWithinYears,
				);

				// A response that raced a filter change can settle before the
				// re-invocation aborts it (e.g. during applyVerifiedFilter's
				// ensureVerifiedDates await) — drop the stale count (the forced
				// follow-up refetch owns the fresh one) but never strand the
				// spinner.
				if (get(store).verifiedWithinYears !== verifiedWithinYears) {
					update((state) => ({ ...state, isLoadingList: false }));
					return;
				}

				update((state) => ({
					...state,
					merchants: [],
					totalCount: recencyPlaces.length,
					isLoadingList: false,
					// Preserve existing categoryCounts since we don't have actual merchant data to recalculate them
				}));
			} catch (error) {
				if (error instanceof Error && !isCancellation(error)) {
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
				const validPlaces = await searchPlacesInRadius<Place>(
					center,
					radiusKm,
					buildFieldsParam(PLACE_FIELD_SETS.LIST_ITEM),
					detailsAbortController.signal,
				);

				// Merge into existing cache
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
				if (error instanceof Error && !isCancellation(error)) {
					console.warn("Failed to fetch enriched details:", error.message);
				}
				update((state) => ({ ...state, isEnrichingDetails: false }));
			}
		},

		// Open panel with search results (boosted first, then the server's order)
		openWithSearchResults(
			query: string,
			results: Place[],
			total: number = results.length,
		) {
			// The server already ordered these by relevance (exact name match, then
			// prefix, then substring, then a hit on any other tag) with proximity to
			// the map centre as the tiebreak. Preserve that — re-sorting by distance
			// or alphabetically, as the nearby list does, would discard it and bury
			// an exact name match. Only boosted places are promoted above it.
			// Array.sort is stable, so equal-boost rows keep the server's order.
			const sortedResults = [...results].sort((a, b) => {
				if (isBoosted(a) && !isBoosted(b)) return -1;
				if (!isBoosted(a) && isBoosted(b)) return 1;
				return 0;
			});
			// Counts come from the shared pipeline on the recency-filtered set;
			// the panel renders the same pipeline's selection
			// (filteredSearchResults), so chips and rows can never disagree.
			const { verifiedWithinYears } = get(store);
			const { counts: categoryCounts } = selectVisiblePlaces({
				places: sortedResults,
				mode: "search",
				category: "all",
				recency: verifiedWithinYears,
				recencyReady: true,
				boostsOnly: false,
			});
			update((state) => ({
				...resetCategoryState(state),
				isOpen: true,
				mode: "search",
				searchQuery: query,
				searchResults: sortedResults,
				// Total matches on the server, which can exceed what it returned —
				// the panel shows "N of TOTAL" so truncation isn't silent.
				searchTotal: total,
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
				searchTotal: 0,
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
				searchTotal: 0,
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

		// Set the "verified within N years" filter (null = Any/off) and persist
		// it. Unlike the category filter, this survives close()/reset and across
		// sessions, matching the Android setting. `persist: false` seeds a
		// session-only selection (the ?outdated URL param) so a shared link
		// can't overwrite the visitor's stored preference.
		setVerifiedFilter(
			years: VerifiedFilterYears,
			opts: { persist?: boolean } = {},
		) {
			if (opts.persist !== false) storeVerifiedFilter(years);
			update((state) => {
				// In search mode the page-level refresh (updateMerchantList)
				// early-returns, so recompute the chip counts here from the same
				// recency-filtered selection the panel renders — otherwise they
				// freeze at search time and disagree with the visible list.
				// Search results carry their own verified_at (from /v4/search),
				// so no verifiedDatesLoaded gate applies, matching the panel and
				// the marker block's inSearch bypass. Nearby mode stays untouched:
				// the forced update re-runs setMerchants/fetchAndReplaceList,
				// which own that recompute.
				if (state.mode === "search" && state.searchResults.length > 0) {
					// The pipeline recomputes counts on the new window and applies
					// the auto-reset rule — a window that zeroes the selected chip
					// snaps selection to "all", exactly as nearby mode does.
					const { counts, effectiveCategory } = selectVisiblePlaces({
						places: state.searchResults,
						mode: "search",
						category: state.selectedCategory,
						recency: years,
						recencyReady: true,
						boostsOnly: false,
					});
					return {
						...state,
						verifiedWithinYears: years,
						categoryCounts: counts,
						selectedCategory: effectiveCategory,
					};
				}
				return { ...state, verifiedWithinYears: years };
			});
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

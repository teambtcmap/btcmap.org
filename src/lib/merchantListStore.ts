import axios from "axios";
import { get, writable } from "svelte/store";

import { trackEvent } from "$lib/analytics";
import { API_BASE } from "$lib/api-base";
import { buildFieldsParam, PLACE_FIELD_SETS } from "$lib/api-fields";
import api from "$lib/axios";
import type { CategoryCounts, CategoryKey } from "$lib/categoryMapping";
import { createEmptyCategoryCounts } from "$lib/categoryMapping";
import { MERCHANT_LIST_MAX_ITEMS } from "$lib/constants";
import { _ } from "$lib/i18n";
import type {
	PaymentMethod,
	PaymentTaggedPlace,
} from "$lib/map/paymentMethodFilter";
import { placeMatchesPaymentMethods } from "$lib/map/paymentMethodFilter";
import type { VerifiedFilterYears } from "$lib/map/verifiedFilter";
import {
	getStoredVerifiedFilter,
	storeVerifiedFilter,
} from "$lib/map/verifiedFilter";
import { selectVisiblePlaces } from "$lib/map/visiblePlaces";
import { isBoosted } from "$lib/merchantDrawerLogic";
import { merchantDrawer } from "$lib/merchantDrawerStore";
import { paymentTagsLoaded, verifiedDatesLoaded } from "$lib/store";
import type { Place } from "$lib/types";
import type { UserLocation } from "$lib/userLocationStore";
import { userLocation } from "$lib/userLocationStore";
import { calculateDistance, debounce, errToast } from "$lib/utils";
import { filterPlacesByRecency } from "$lib/verification";

export type MerchantListMode = "nearby" | "search";

// The page supplies the live map centre lazily: the session evaluates the
// getter at dispatch time (the map can pan during the debounce window), and
// it returns undefined until the map initialises — the search box is
// reachable before that.
export type SearchCenterGetter = () => { lat: number; lon: number } | undefined;

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
	// True when the last list-shaping fetch (list replace or count) failed
	// for a non-cancellation reason; cleared by every successful populate
	// path. Enrichment failures don't set it — they degrade cosmetics
	// (icons/addresses), not the list itself.
	listError: boolean;
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
	// ?onchain&lightning&nfc embed filter (#1269), seeded by the map page from
	// the URL and locked for the session — no persistence, no user toggle.
	// null = off. Consumed by every selectVisiblePlaces call site in this
	// store so pins, lists, and counts can't disagree.
	paymentMethods: ReadonlySet<PaymentMethod> | null;
};

const initialState: MerchantListState = {
	isOpen: false,
	merchants: [],
	totalCount: 0,
	placeDetailsCache: new Map(),
	isLoadingList: false,
	isEnrichingDetails: false,
	listError: false,
	mode: "nearby",
	searchQuery: "",
	searchResults: [],
	searchTotal: 0,
	isSearching: false,
	selectedCategory: "all",
	categoryCounts: createEmptyCategoryCounts(),
	verifiedWithinYears: getStoredVerifiedFilter(),
	paymentMethods: null,
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
		throw new Error(
			`Radius search returned invalid data: expected an array, got ${typeof response.data}`,
		);
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

	// Open panel with search results (boosted first, then the server's order)
	function applySearchResults(
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
		const { verifiedWithinYears, paymentMethods } = get(store);
		const { counts: categoryCounts } = selectVisiblePlaces({
			places: sortedResults,
			mode: "search",
			category: "all",
			recency: verifiedWithinYears,
			recencyReady: true,
			boostsOnly: false,
			issueCodes: null,
			issuesReady: true,
			// /v4/search rows carry the payment tags natively (LIST_ITEM).
			paymentMethods,
			paymentsReady: true,
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
	}

	// Open panel in search mode, optionally showing spinner
	// Use setSearchModeOpen() to open panel ready for input (no spinner)
	// Use setSearchModeOpen(true) when a search is in progress (shows spinner)
	function setSearchModeOpen(isSearching: boolean = false) {
		update((state) => ({
			...state,
			isSearching,
			mode: "search",
			isOpen: true,
		}));
	}

	// --- searchSession (#1173) --------------------------------------------
	// The whole search request lifecycle in one place: the debounce, the
	// abort, and every staleness/open guard. search() is the single entry
	// point and the sole LIVE writer of searchQuery (the PR #1126
	// input-clobber class this extraction exists to prevent). The legacy
	// public writers — openWithSearchResults, clearSearchInput,
	// exitSearchMode — have no production callers and bypass the session's
	// cancellation; route new code through search() instead.
	let searchAbortController: AbortController | null = null;

	function cancelSearchRequest() {
		if (searchAbortController) {
			searchAbortController.abort();
			searchAbortController = null;
		}
	}

	// Ported verbatim from map/+page.svelte's executeSearch — abort any
	// prior request, fetch via the SvelteKit endpoint, hand results to the
	// store. Errors surface as toasts.
	const executeSearch = async (
		query: string,
		getCenter?: SearchCenterGetter,
	) => {
		cancelSearchRequest();
		// Trim so the request matches the dispatch decision (search() gates
		// on the trimmed length) — otherwise "  abc" is sent verbatim as
		// %20%20abc.
		const trimmed = query.trim();
		if (trimmed.length < 3) return;

		trackEvent("search_query");
		searchAbortController = new AbortController();

		// Close any drawer so it doesn't sit on top of the result list.
		merchantDrawer.close();
		setSearchModeOpen(true);

		// The server breaks relevance ties by proximity to this point,
		// mirroring the original client-side search, which ranked purely by
		// distance from the map centre. Without it, a query like "hamburg" —
		// which no place is named — leaves every match tied at the lowest
		// rank, and the result cap selects among them by name length.
		// getCenter runs HERE, at dispatch time, not at the keystroke that
		// armed the debounce: the map can pan during the 300 ms window, and
		// the page-level code this replaces read the live centre at this
		// exact moment. Undefined (map not initialised) omits both params —
		// the API rejects a lone coordinate.
		const searchParams = new URLSearchParams({ name: trimmed });
		const center = getCenter?.();
		if (center) {
			searchParams.set("lat", String(center.lat));
			searchParams.set("lon", String(center.lon));
		}

		try {
			const response = await fetch(`/api/search/places?${searchParams}`, {
				signal: searchAbortController.signal,
			});
			if (!response.ok) throw new Error("Search API error");
			// `total` is the server's full match count, which can exceed the
			// rows it returned — the panel reports the gap rather than hiding
			// the truncation.
			const { places: results, total }: { places: Place[]; total: number } =
				await response.json();
			// The panel/sheet may have been closed while we were awaiting the
			// response (abort only rejects the fetch, not the json() window).
			// Don't let a late result reopen it.
			if (!get(store).isOpen) return;
			// The user kept typing while this request was in flight, so it
			// answers a query that is no longer on screen. Continuous typing
			// keeps re-arming the debounce, so no newer request dispatched to
			// abort this one. Dropping it here matters beyond stale results:
			// applySearchResults writes `query` back into searchQuery, which
			// feeds the search input's `value` prop — applying it would
			// rewrite the input mid-word and reset the caret.
			if (get(store).searchQuery !== query) return;
			applySearchResults(query, results, total);
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") return;
			// Same staleness check as the success path. The user has typed
			// past this query, so a newer request is already scheduled or in
			// flight: toasting would report a failure for a query that is no
			// longer on screen, and setSearchModeOpen(false) below would clear
			// the spinner out from under the newer search. That search reports
			// its own failure if it also fails.
			if (get(store).searchQuery !== query) return;
			console.error("Search error:", error);
			errToast(get(_)("errors.searchUnavailable"));
			// Mirror the success-path guard: if the panel was closed/collapsed
			// while the request was in flight, a non-abort failure must not
			// pop it back open.
			if (!get(store).isOpen) return;
			// Keep the user's typed query (and search mode) — a transient
			// failure shouldn't wipe the input or silently drop them back to
			// nearby.
			setSearchModeOpen(false);
		}
	};

	const debouncedExecuteSearch = debounce(
		(query: string, getCenter?: SearchCenterGetter) => {
			void executeSearch(query, getCenter);
		},
		300,
	);

	function cancelSearchSession() {
		debouncedExecuteSearch.cancel();
		cancelSearchRequest();
	}

	return {
		subscribe,

		open() {
			update((state) => ({ ...state, isOpen: true }));
		},

		// Hide the panel, reset category filter and search state, but keep merchant data (count visible on button)
		close() {
			// Closing/collapsing discards any pending or in-flight worldwide
			// search — a late response must not pop the panel (or the mobile
			// sheet) back open on its own.
			cancelSearchSession();
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
			const { selectedCategory, verifiedWithinYears, paymentMethods } =
				get(store);
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
				issueCodes: null,
				issuesReady: true,
				// Bulk-feed rows lack payment tags until the lazy enrichment
				// lands; inert until then (same gate the markers use).
				paymentMethods,
				paymentsReady: paymentMethods == null || get(paymentTagsLoaded),
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
				listError: false,
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
				const { selectedCategory, verifiedWithinYears, paymentMethods } =
					get(store);
				const { selection, preCategory, counts, effectiveCategory } =
					selectVisiblePlaces({
						places: validPlaces,
						mode: "nearby",
						category: selectedCategory,
						recency: verifiedWithinYears,
						recencyReady: true,
						boostsOnly: false,
						issueCodes: null,
						issuesReady: true,
						// Radius rows carry the payment tags natively (LIST_ITEM),
						// but the gate mirrors the pins' anyway: while the bulk
						// markers are still inert (enrichment pending or failed) a
						// narrowed list would contradict the unfiltered map — the
						// #1158-#1162 disagreement class this pipeline exists to
						// prevent.
						paymentMethods,
						paymentsReady: paymentMethods == null || get(paymentTagsLoaded),
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
						listError: false,
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
						listError: false,
						categoryCounts: counts,
						selectedCategory: effectiveCategory,
					}));
				}
			} catch (error) {
				const failed = error instanceof Error && !isCancellation(error);
				if (failed) {
					console.warn("Failed to fetch merchant list:", error.message);
					errToast(get(_)("errors.loadFailed"));
				}
				// A cancellation is not a failure: the superseding request owns
				// the flag, so leave whatever it decides untouched.
				update((state) => ({
					...state,
					isLoadingList: false,
					listError: failed || state.listError,
				}));
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
			const { verifiedWithinYears, paymentMethods } = get(store);
			// The badge narrows by payment only while the pins do (same
			// readiness flag): before the tag enrichment lands — or after it
			// failed — the markers show everything, and a narrowed count over
			// an unfiltered map would contradict it.
			const activePaymentMethods = get(paymentTagsLoaded)
				? paymentMethods
				: null;
			// Widen the lean payload with exactly the fields the active filters
			// need: verified_at for the recency window, the payment tags for
			// the ?onchain&lightning&nfc embed filter (#1269).
			const fields = [
				"id",
				...(verifiedWithinYears == null ? [] : ["verified_at"]),
				...(activePaymentMethods == null
					? []
					: [
							"osm:payment:onchain",
							"osm:payment:lightning",
							"osm:payment:lightning_contactless",
						]),
			].join(",");

			try {
				// Typed to the payload actually requested — these rows are not
				// full Places and must not be handed to anything expecting one.
				const validItems = await searchPlacesInRadius<
					Pick<Place, "id"> & Pick<Place, "verified_at"> & PaymentTaggedPlace
				>(center, radiusKm, fields, listAbortController.signal);
				let counted = filterPlacesByRecency(validItems, verifiedWithinYears);
				if (activePaymentMethods) {
					counted = counted.filter((p) =>
						placeMatchesPaymentMethods(p, activePaymentMethods),
					);
				}

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
					totalCount: counted.length,
					isLoadingList: false,
					listError: false,
					// Preserve existing categoryCounts since we don't have actual merchant data to recalculate them
				}));
			} catch (error) {
				const failed = error instanceof Error && !isCancellation(error);
				if (failed) {
					console.warn("Failed to fetch merchant count:", error.message);
				}
				update((state) => ({
					...state,
					isLoadingList: false,
					listError: failed || state.listError,
				}));
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
			applySearchResults(query, results, total);
		},

		// Open panel in search mode, optionally showing spinner
		// Use openSearchMode() to open panel ready for input (no spinner)
		// Use openSearchMode(true) when a search is in progress (shows spinner)
		openSearchMode(isSearching: boolean = false) {
			setSearchModeOpen(isSearching);
		},

		// Single entry point for the search input (#1173) — and the sole
		// live writer of searchQuery (see the searchSession note above).
		// Writes the RAW query: the staleness guards compare verbatim, so
		// trimming here would silently drop results for queries typed with
		// leading whitespace.
		search(query: string, opts: { getCenter?: SearchCenterGetter } = {}) {
			update((state) => ({ ...state, searchQuery: query }));
			if (query.trim().length >= 3) {
				debouncedExecuteSearch(query, opts.getCenter);
				return;
			}
			// Too short / empty → abort any search and return to nearby
			// browse, keeping whatever the user has typed so far in the
			// input. No isOpen guard and no result clearing: the page's
			// search → nearby watcher owns the refresh, close() owns the
			// reset.
			cancelSearchSession();
			if (get(store).mode !== "nearby") {
				update((state) => ({ ...state, mode: "nearby" }));
			}
		},

		// Discard any pending or in-flight worldwide search without touching
		// list/details requests. Escape hatch for teardown paths outside the
		// session; close() and reset() cancel internally, so today only
		// tests exercise this directly.
		cancelSearch() {
			cancelSearchSession();
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
						issueCodes: null,
						issuesReady: true,
						paymentMethods: state.paymentMethods,
						// Search rows carry the payment tags natively (LIST_ITEM).
						paymentsReady: true,
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

		// Seed the ?onchain&lightning&nfc embed filter (#1269). Session-only:
		// the page parses the URL once at init and calls this — no persistence,
		// no user-facing toggle. Pass null to turn the filter off.
		setPaymentMethods(methods: ReadonlySet<PaymentMethod> | null) {
			update((state) => ({ ...state, paymentMethods: methods }));
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
			cancelSearchSession();
			set(initialState);
		},
	};
}

export const merchantList = createMerchantListStore();

<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import MapLoadingMain from '$components/MapLoadingMain.svelte';
	import TileLoadingIndicator from './components/TileLoadingIndicator.svelte';
	import MerchantDrawerHash from './components/MerchantDrawerHash.svelte';
	import MerchantListPanel from './components/MerchantListPanel.svelte';
	import MapSearchBar from './components/MapSearchBar.svelte';
	import { merchantDrawer } from '$lib/merchantDrawerStore';
	import type { MerchantListMode } from '$lib/merchantListStore';
	import { merchantList } from '$lib/merchantListStore';
	import type { CategoryKey } from '$lib/categoryMapping';
	import { placeMatchesCategory } from '$lib/categoryMapping';
	import { trackEvent } from '$lib/analytics';
	import {
		BREAKPOINTS,
		MERCHANT_LIST_WIDTH,
		MERCHANT_DRAWER_WIDTH,
		MAP_FIT_BOUNDS_PADDING,
		CLUSTERING_DISABLED_ZOOM,
		BOOSTED_CLUSTERING_MAX_ZOOM,
		MERCHANT_LIST_LOW_ZOOM,
		MERCHANT_LIST_MAX_ITEMS,
		NEARBY_RADIUS_MULTIPLIER,
		MAX_LOADED_MARKERS,
		VIEWPORT_BATCH_SIZE,
		VIEWPORT_BUFFER_PERCENT,
		MAP_DEBOUNCE_DELAY,
		MARKER_CLICK_THROTTLE,
		DEFAULT_MAP_LAT,
		DEFAULT_MAP_LNG,
		DEFAULT_MAP_ZOOM
	} from '$lib/constants';
	import {
		calculateRadiusKm,
		getBufferedBounds,
		getVisiblePlaces,
		getZoomBehavior
	} from '$lib/map/viewport';
	import {
		clearMarkerSelection,
		highlightMarker,
		cleanupOutOfBoundsMarkers,
		type LoadedMarkers
	} from '$lib/map/markers';
	import {
		processPlaces,
		isSupported as isWorkerSupported,
		terminate as terminateWorker
	} from '$lib/workers/worker-manager';
	import type { ProcessedPlace } from '$lib/workers/map-worker';
	import { loadMapDependencies } from '$lib/map/imports';
	import {
		attribution,
		changeDefaultIcons,
		dataRefresh,
		generateIcon,
		generateMarker,
		geolocate,
		homeMarkerButtons,
		layers,
		scaleBars,
		support,
		updateMapHash
	} from '$lib/map/setup';
	import { detectTheme } from '$lib/utils';
	import {
		placesError,
		places,
		placesById,
		placesSyncCount,
		mapUpdates,
		lastUpdatedPlaceId,
		placesLoadingStatus,
		placesLoadingProgress
	} from '$lib/store';
	import type { Leaflet, Place } from '$lib/types';
	import { debounce, errToast, isBoosted } from '$lib/utils';
	import type { Control, LatLng, LatLngBounds, Map, Marker, MarkerClusterGroup } from 'leaflet';
	import localforage from 'localforage';
	import { onDestroy, onMount } from 'svelte';
	import type { FeatureGroup } from 'leaflet';
	import type { PageData } from './$types';

	export let data: PageData;

	let mapLoading = 1;
	let mapLoadingStatus = 'Loading map...';

	// Combine map loading progress with places loading progress
	$: {
		// Priority 1: Places are actively loading (1-99%)
		if ($placesLoadingProgress > 0 && $placesLoadingProgress < 100) {
			mapLoading = $placesLoadingProgress;
			mapLoadingStatus = $placesLoadingStatus;
		}
		// Priority 2: Places complete (100%), map ready, initializing markers
		else if ($placesLoadingProgress === 100 && !elementsLoaded) {
			mapLoading = 100;
			mapLoadingStatus = $placesLoadingStatus;
		}
		// Priority 3: Loading initial markers (only during first load, not viewport updates)
		else if (isLoadingMarkers && !elementsLoaded) {
			mapLoading = 100;
			mapLoadingStatus = 'Loading places...';
		}
		// Priority 4: Waiting for map tiles to render
		else if (elementsLoaded && !mapTilesLoaded) {
			mapLoading = 100;
			mapLoadingStatus = 'Preparing map...';
		}
		// Reset when everything is done
		else if (elementsLoaded && mapTilesLoaded) {
			mapLoading = 0;
			mapLoadingStatus = '';
		}
	}

	let currentZoom = DEFAULT_MAP_ZOOM;
	let previousZoom = DEFAULT_MAP_ZOOM;

	// Throttled marker drawer opening to prevent freeze on rapid clicks
	let lastMarkerClickTime = 0;

	function openMerchantDrawer(id: number) {
		// Skip if same marker already selected
		if (selectedMarkerId === id) return;

		// Throttle rapid clicks
		const now = Date.now();
		if (now - lastMarkerClickTime < MARKER_CLICK_THROTTLE) return;
		lastMarkerClickTime = now;

		// Batch DOM operations with requestAnimationFrame
		requestAnimationFrame(() => {
			if (selectedMarkerId) {
				clearMarkerSelection(loadedMarkers, selectedMarkerId);
			}
			selectedMarkerId = id;
			highlightMarker(loadedMarkers, id);
		});

		merchantDrawer.open(id, 'details');
	}

	let leaflet: Leaflet;
	let DomEvent: typeof import('leaflet/src/dom/DomEvent');
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	let controlLayers: Control.Layers;
	let currentLayerName: string | null = null;

	let mapElement: HTMLDivElement;
	let map: Map;
	let mapLoaded = false;
	let elementsLoaded = false;
	let mapTilesLoaded = false;
	let tilesLoading = true;
	let tilesLoadingTimer: ReturnType<typeof setTimeout> | null = null;
	let tilesLoadingFallback: ReturnType<typeof setTimeout> | null = null;
	let glMapPollingTimer: ReturnType<typeof setTimeout> | null = null;

	let markers: MarkerClusterGroup;
	let upToDateLayer: FeatureGroup.SubGroup;
	let boostedLayer: FeatureGroup;
	let loadedMarkers: LoadedMarkers = {};
	let boostedLayerMarkerIds: Set<string> = new Set();
	let selectedMarkerId: number | null = null;

	let isLoadingMarkers = false;
	let isZooming = false;

	let mapCenter: LatLng;

	// Track selected category for marker filtering
	let previousCategory: CategoryKey = 'all';
	$: selectedCategory = $merchantList.selectedCategory;

	// Track mode transitions for search filtering
	let previousMode: MerchantListMode = 'nearby';
	let searchResultsRevision = 0;
	let previousSearchResultsRevision = 0;
	$: currentMode = $merchantList.mode;

	// Set of search result IDs for efficient marker filtering (respects category filter)
	let searchResultIds: Set<number> = new Set();

	// Update search result IDs when search results or category filter changes
	$: {
		if (
			$merchantList.mode === 'search' &&
			$merchantList.searchResults.length > 0 &&
			$merchantList.isOpen
		) {
			// Filter by category if one is selected
			const filtered =
				selectedCategory === 'all'
					? $merchantList.searchResults
					: $merchantList.searchResults.filter((p) => placeMatchesCategory(p, selectedCategory));
			searchResultIds = new Set(filtered.map((p) => p.id));
			searchResultsRevision++;
		} else {
			// Reset filtering when: switching to nearby, clearing search, closing panel, or 0 results
			searchResultIds = new Set();
			searchResultsRevision++;
		}
	}

	// Check if boosted markers should be clustered at current zoom level
	// At zoom 1-5: boosted markers cluster with regular markers
	// At zoom 6+: boosted markers are in separate non-clustered layer
	const shouldClusterBoostedMarkers = () => currentZoom <= BOOSTED_CLUSTERING_MAX_ZOOM;

	const handleHashChange = () => {
		if (!browser) return;

		// Sync store from hash - single source of truth
		merchantDrawer.syncFromHash();

		const hash = window.location.hash.substring(1);
		const hasDrawer = hash.includes('merchant=');

		if (!hasDrawer && selectedMarkerId) {
			clearMarkerSelection(loadedMarkers, selectedMarkerId);
			selectedMarkerId = null;
		} else if (hasDrawer) {
			const params = new URLSearchParams(hash.substring(hash.indexOf('&') + 1));
			const merchantParam = params.get('merchant');
			if (merchantParam) {
				const merchantId = Number(merchantParam);
				if (merchantId !== selectedMarkerId) {
					if (selectedMarkerId) {
						clearMarkerSelection(loadedMarkers, selectedMarkerId);
					}
					selectedMarkerId = merchantId;
					highlightMarker(loadedMarkers, merchantId);
				}
			}
		}
	};

	// Track current search request for cancellation
	let searchAbortController: AbortController | null = null;

	// Core search function
	const executeSearch = async (query: string) => {
		// Cancel any in-flight search request
		searchAbortController?.abort();

		if (query.length < 3) {
			return;
		}

		trackEvent('search_query');
		searchAbortController = new AbortController();

		// Close any open merchant drawer so it doesn't cover the search results
		merchantDrawer.close();
		merchantList.openSearchMode(true);

		try {
			const response = await fetch(`/api/search/places?name=${encodeURIComponent(query)}`, {
				signal: searchAbortController.signal
			});

			if (!response.ok) {
				throw new Error('Search API error');
			}

			const places: Place[] = await response.json();
			merchantList.openWithSearchResults(query, places);
		} catch (error) {
			// Ignore aborted requests (user typed new query)
			if (error instanceof Error && error.name === 'AbortError') {
				return;
			}
			console.error('Search error:', error);
			errToast('Search temporarily unavailable');
			merchantList.exitSearchMode();
		}
	};

	// Debounced search for panel input
	const debouncedPanelSearch = debounce((query: string) => executeSearch(query), 300);

	// Handler for panel search input
	const handlePanelSearch = (query: string) => {
		debouncedPanelSearch(query);
	};

	const handleModeChange = (mode: MerchantListMode) => {
		// Panel already handled the mode change via exitSearchMode(), just update the list
		if (mode === 'nearby') {
			searchAbortController?.abort();
			updateMerchantList();
		}
	};

	// allows for users to set initial view in a URL query
	const urlLat = $page.url.searchParams.getAll('lat');
	const urlLong = $page.url.searchParams.getAll('long');

	// allow to view map with only boosted locations
	const boosts = $page.url.searchParams.has('boosts');

	// displays a button in controls if there is new data available
	const showDataRefresh = () => {
		const refreshDiv: HTMLDivElement | null = document.querySelector('.data-refresh-div');
		if (!refreshDiv) return;
		refreshDiv.style.display = 'block';
	};

	$: map && mapLoaded && $mapUpdates && $placesSyncCount > 1 && showDataRefresh();

	// Reload markers and update merchant list when places sync completes after initial load
	$: if (elementsLoaded && $places.length && currentZoom >= MERCHANT_LIST_LOW_ZOOM) {
		debouncedLoadMarkers();
		debouncedUpdateMerchantList();
	}

	// Filter map markers when category filter changes
	$: if (elementsLoaded && upToDateLayer && selectedCategory !== previousCategory) {
		previousCategory = selectedCategory;
		clearNonMatchingMarkers(selectedCategory);
		debouncedLoadMarkers();
	}

	// Consolidated reactive block for search mode transitions and result changes
	// Handles: entering search mode, exiting search mode, and search results changing
	$: if (elementsLoaded && upToDateLayer) {
		const searchResultCount = searchResultIds.size;
		const modeChanged = currentMode !== previousMode;
		const resultsChanged = searchResultsRevision !== previousSearchResultsRevision;

		if (modeChanged) {
			previousMode = currentMode;
			if (currentMode === 'search' && searchResultCount > 0) {
				// Entering search mode with results
				clearNonSearchResultMarkers();
				loadSearchResultMarkers();
			} else if (currentMode === 'nearby') {
				// Exiting search mode: reload markers for current viewport
				debouncedLoadMarkers();
			}
		} else if (currentMode === 'search' && resultsChanged && searchResultCount > 0) {
			// Already in search mode but results changed (new search or category filter)
			clearNonSearchResultMarkers();
			loadSearchResultMarkers();
		}

		previousSearchResultsRevision = searchResultsRevision;
	}

	// alert for map errors
	$: $placesError && errToast($placesError);

	// Update marker icon when place is updated (boost or comment)
	$: if ($lastUpdatedPlaceId && leaflet && loadedMarkers) {
		const placeIdStr = $lastUpdatedPlaceId.toString();
		const marker = loadedMarkers[placeIdStr];

		if (marker) {
			// Find the updated place in the store
			const updatedPlace = $placesById.get($lastUpdatedPlaceId);

			if (updatedPlace) {
				// Regenerate icon with fresh data
				const commentsCount = typeof updatedPlace.comments === 'number' ? updatedPlace.comments : 0;
				const placeIsBoosted = isBoosted(updatedPlace) ? true : false;
				const markerInBoostedLayer = boostedLayerMarkerIds.has(placeIdStr);

				const newIcon = generateIcon(
					leaflet,
					updatedPlace.icon || 'question_mark',
					placeIsBoosted,
					commentsCount
				);

				// Update the marker icon
				marker.setIcon(newIcon);

				// Handle layer transition if boost status changed
				// At zoom 1-5, boosted markers stay clustered, so no layer change needed
				if (placeIsBoosted && !markerInBoostedLayer && !shouldClusterBoostedMarkers()) {
					// Place became boosted at zoom 6+ - move to non-clustered layer
					upToDateLayer.removeLayer(marker);
					markers.removeLayer(marker);
					boostedLayer.addLayer(marker);
					boostedLayerMarkerIds.add(placeIdStr);
					console.info(`Moved marker ${placeIdStr} to boosted layer`);
				} else if (!placeIsBoosted && markerInBoostedLayer) {
					// Boost expired - move to clustered layer
					boostedLayer.removeLayer(marker);
					boostedLayerMarkerIds.delete(placeIdStr);
					upToDateLayer.addLayer(marker);
					console.info(`Moved marker ${placeIdStr} to clustered layer`);
				} else {
					console.info(`Updated marker icon for place ${$lastUpdatedPlaceId}`);
				}
			}
		}

		// Reset the signal
		lastUpdatedPlaceId.set(undefined);
	}

	// Shared helper to remove markers by predicate
	const removeMarkersByPredicate = (shouldRemove: (placeId: string) => boolean): number => {
		const markersToRemove: string[] = [];

		Object.entries(loadedMarkers).forEach(([placeId, marker]) => {
			if (shouldRemove(placeId)) {
				upToDateLayer.removeLayer(marker);
				markers.removeLayer(marker);
				boostedLayer.removeLayer(marker);
				boostedLayerMarkerIds.delete(placeId);
				markersToRemove.push(placeId);
			}
		});

		markersToRemove.forEach((placeId) => {
			delete loadedMarkers[placeId];
		});

		return markersToRemove.length;
	};

	// Remove markers that don't match the selected category filter
	const clearNonMatchingMarkers = (category: CategoryKey) => {
		if (category === 'all') return;

		removeMarkersByPredicate((placeId) => {
			const place = $placesById.get(Number(placeId));
			return place ? !placeMatchesCategory(place, category) : false;
		});
	};

	// Check if a place ID is in the current search results
	const placeInSearchResults = (placeId: number): boolean => {
		return searchResultIds.has(placeId);
	};

	// Apply search filter to places if in search mode
	const applySearchFilter = (places: Place[]): Place[] => {
		return currentMode === 'search' && searchResultIds.size > 0
			? places.filter((place) => placeInSearchResults(place.id))
			: places;
	};

	// Remove markers that are not in the search results
	const clearNonSearchResultMarkers = () => {
		if (searchResultIds.size === 0) return;

		const removedCount = removeMarkersByPredicate(
			(placeId) => !placeInSearchResults(Number(placeId))
		);

		console.debug(
			`[SEARCH] Filtered to ${searchResultIds.size} search results, removed ${removedCount} markers`
		);
	};

	// Load markers for search results matching the current category filter
	const loadSearchResultMarkers = () => {
		if (searchResultIds.size === 0) return;

		// Only load markers that are in the filtered search results and not already loaded
		const placesToLoad = $merchantList.searchResults.filter(
			(place) => searchResultIds.has(place.id) && !loadedMarkers[place.id.toString()]
		);

		if (placesToLoad.length === 0) return;

		placesToLoad.forEach((place: Place) => {
			const commentsCount = place.comments || 0;
			const icon = place.icon;
			const boosted = place.boosted_until ? Date.parse(place.boosted_until) > Date.now() : false;

			const divIcon = generateIcon(leaflet, icon, boosted, commentsCount);

			const marker = generateMarker({
				lat: place.lat,
				long: place.lon,
				icon: divIcon,
				placeId: place.id,
				leaflet,
				verify: true,
				onMarkerClick: (id) => openMerchantDrawer(Number(id))
			});

			if (boosted && !shouldClusterBoostedMarkers()) {
				boostedLayer.addLayer(marker);
				boostedLayerMarkerIds.add(place.id.toString());
			} else {
				upToDateLayer.addLayer(marker);
			}
			loadedMarkers[place.id.toString()] = marker;

			if (selectedMarkerId === place.id) {
				highlightMarker(loadedMarkers, place.id);
			}
		});

		console.debug(`[SEARCH] Loaded ${placesToLoad.length} search result markers`);
	};

	// Helper to validate coordinates
	const isValidCoordinate = (lat: number, lon: number): boolean =>
		isFinite(lat) && isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;

	// Fit map bounds to show all search results (respects category filter)
	const fitBoundsToSearchResults = () => {
		if (!map || $merchantList.searchResults.length === 0) return;

		try {
			// Filter by category if one is selected
			const categoryFiltered =
				selectedCategory === 'all'
					? $merchantList.searchResults
					: $merchantList.searchResults.filter((p) => placeMatchesCategory(p, selectedCategory));

			// Validate coordinates to prevent map errors
			const results = categoryFiltered.filter((p) => isValidCoordinate(p.lat, p.lon));

			if (results.length === 0) return;

			// Single result: zoom to it
			if (results.length === 1) {
				map.setView([results[0].lat, results[0].lon], 17, { animate: true });
				return;
			}

			// Multiple results: calculate bounds
			const lats = results.map((p) => p.lat);
			const lons = results.map((p) => p.lon);
			const minLat = Math.min(...lats);
			const maxLat = Math.max(...lats);
			const minLon = Math.min(...lons);
			const maxLon = Math.max(...lons);

			const bounds = leaflet.latLngBounds([minLat, minLon], [maxLat, maxLon]);

			// Account for panel width when open (desktop only)
			const { panelWidth } = getPanelOffset();
			const paddingRight = MAP_FIT_BOUNDS_PADDING + panelWidth;

			map.fitBounds(bounds, {
				paddingTopLeft: [MAP_FIT_BOUNDS_PADDING, MAP_FIT_BOUNDS_PADDING],
				paddingBottomRight: [paddingRight, MAP_FIT_BOUNDS_PADDING],
				animate: true,
				maxZoom: 17
			});
		} catch (error) {
			console.debug('[SEARCH] Error fitting bounds to search results:', error);
		}
	};

	// Move boosted markers between layers when zoom crosses the threshold
	const handleBoostedLayerTransition = (fromZoom: number, toZoom: number) => {
		const crossedThreshold =
			(fromZoom <= BOOSTED_CLUSTERING_MAX_ZOOM && toZoom > BOOSTED_CLUSTERING_MAX_ZOOM) ||
			(fromZoom > BOOSTED_CLUSTERING_MAX_ZOOM && toZoom <= BOOSTED_CLUSTERING_MAX_ZOOM);

		if (!crossedThreshold || !markers || !boostedLayer) return;

		const shouldClusterBoosted = toZoom <= BOOSTED_CLUSTERING_MAX_ZOOM;

		if (shouldClusterBoosted) {
			// Moving from zoom 6+ to zoom 5-: move boosted markers to cluster layer
			const markersToMove: Marker[] = [];
			boostedLayerMarkerIds.forEach((placeId) => {
				const marker = loadedMarkers[placeId];
				if (marker) {
					boostedLayer.removeLayer(marker);
					markersToMove.push(marker);
				}
			});
			if (markersToMove.length > 0) {
				markers.addLayers(markersToMove);
				boostedLayerMarkerIds.clear();
				console.info(`Moved ${markersToMove.length} boosted markers to clustered layer`);
			}
		} else {
			// Moving from zoom 5- to zoom 6+: move boosted markers to non-clustered layer
			const markersToMove: Array<{ marker: Marker; placeId: string }> = [];
			Object.entries(loadedMarkers).forEach(([placeId, marker]) => {
				const place = $placesById.get(Number(placeId));
				if (place && isBoosted(place)) {
					markersToMove.push({ marker, placeId });
				}
			});
			markersToMove.forEach(({ marker, placeId }) => {
				markers.removeLayer(marker);
				upToDateLayer.removeLayer(marker);
				boostedLayer.addLayer(marker);
				boostedLayerMarkerIds.add(placeId);
			});
			if (markersToMove.length > 0) {
				console.info(`Moved ${markersToMove.length} boosted markers to non-clustered layer`);
			}
		}
	};

	// Load markers for places in current viewport using web workers
	const loadMarkersInViewport = async () => {
		// Skip if zooming, not ready, or already loading
		if (!map || !$places.length || isLoadingMarkers || isZooming) {
			return;
		}

		isLoadingMarkers = true;

		// Check if map has valid bounds (center and zoom are set)
		let bounds;
		try {
			bounds = map.getBounds();
			if (!bounds) {
				isLoadingMarkers = false;
				return;
			}
		} catch (error) {
			console.warn('Error getting map bounds, map not ready yet:', error);
			isLoadingMarkers = false;
			return;
		}

		try {
			// Get visible places (viewport + category filtering)
			const visiblePlaces = getVisiblePlaces(leaflet, $places, bounds, VIEWPORT_BUFFER_PERCENT);
			const categoryFiltered =
				selectedCategory === 'all'
					? visiblePlaces
					: visiblePlaces.filter((place) => placeMatchesCategory(place, selectedCategory));

			// Apply search filter if in search mode
			const searchFiltered = applySearchFilter(categoryFiltered);

			// Filter out places that already have markers loaded
			const placesToLoad = searchFiltered.filter((place) => !loadedMarkers[place.id.toString()]);

			if (placesToLoad.length === 0) {
				isLoadingMarkers = false;
				return;
			}

			// Clean up markers outside viewport if we have many loaded
			if (Object.keys(loadedMarkers).length > MAX_LOADED_MARKERS) {
				cleanupOutOfBoundsMarkers({
					loadedMarkers,
					upToDateLayer,
					boostedLayer,
					boostedLayerMarkerIds,
					bounds
				});
			}

			// Check if web workers are supported before trying to use them
			if (isWorkerSupported()) {
				// Process places using web worker
				await processPlaces(
					placesToLoad,
					VIEWPORT_BATCH_SIZE,
					(progress: number, batch?: ProcessedPlace[]) => {
						// Process batch on main thread (DOM operations)
						if (batch) {
							processBatchOnMainThread(batch, upToDateLayer);
						}
					}
				);
			} else {
				console.warn('Web workers not supported, using synchronous fallback');
				// Fallback to synchronous processing
				loadMarkersInViewportFallback(bounds);
				return;
			}

			console.info(`[VIEWPORT] Successfully loaded ${placesToLoad.length} markers`);
		} catch (error) {
			console.error('[VIEWPORT] Error loading markers:', error);
			// Fallback to synchronous processing for viewport
			loadMarkersInViewportFallback(bounds);
		} finally {
			isLoadingMarkers = false;
		}
	};

	// Fallback synchronous loading for viewport (much smaller dataset)
	const loadMarkersInViewportFallback = (bounds: LatLngBounds) => {
		const visiblePlaces = getVisiblePlaces(leaflet, $places, bounds, VIEWPORT_BUFFER_PERCENT);
		const categoryFiltered =
			selectedCategory === 'all'
				? visiblePlaces
				: visiblePlaces.filter((place) => placeMatchesCategory(place, selectedCategory));
		const searchFiltered = applySearchFilter(categoryFiltered);
		const placesToLoad = searchFiltered.filter((place) => !loadedMarkers[place.id.toString()]);

		placesToLoad.forEach((place: Place) => {
			const commentsCount = place.comments || 0;
			const icon = place.icon;
			const boosted = place.boosted_until ? Date.parse(place.boosted_until) > Date.now() : false;

			const divIcon = generateIcon(leaflet, icon, boosted, commentsCount);

			const marker = generateMarker({
				lat: place.lat,
				long: place.lon,
				icon: divIcon,
				placeId: place.id,
				leaflet,
				verify: true,
				onMarkerClick: (id) => openMerchantDrawer(Number(id))
			});

			// Route to appropriate layer based on boost status and zoom level
			if (boosted && !shouldClusterBoostedMarkers()) {
				boostedLayer.addLayer(marker);
				boostedLayerMarkerIds.add(place.id.toString());
			} else {
				upToDateLayer.addLayer(marker);
			}
			loadedMarkers[place.id.toString()] = marker;

			// Highlight if this is the selected marker (may be pending from search result click)
			if (selectedMarkerId === place.id) {
				highlightMarker(loadedMarkers, place.id);
			}
		});
	};

	// Debounced version to prevent excessive loading during rapid pan/zoom
	const debouncedLoadMarkers = debounce(loadMarkersInViewport, MAP_DEBOUNCE_DELAY);

	// Debounced coords caching to prevent IndexedDB overflow during continuous movement
	const debouncedCacheCoords = debounce((coords: LatLngBounds) => {
		localforage.setItem('coords', coords).catch(function (err) {
			console.error('Error caching coords:', err);
		});
	}, 1000); // 1 second debounce for IndexedDB writes

	// Zoom 15+: Use locally loaded markers, optionally enrich with API data
	const updateListLocalMarkers = (
		center: LatLng,
		bounds: LatLngBounds,
		allowHeavyFetch: boolean
	) => {
		// Expand bounds by 25% on each edge (equivalent to 1.5x radius for API calls)
		const expandedBounds = getBufferedBounds(leaflet, bounds, 0.25);
		const allVisiblePlaces = $places.filter((place) =>
			expandedBounds.contains([place.lat, place.lon])
		);

		merchantList.setMerchants(allVisiblePlaces, center.lat, center.lng);

		if ($merchantList.isOpen && allowHeavyFetch) {
			const radiusKm = calculateRadiusKm(bounds) * NEARBY_RADIUS_MULTIPLIER;
			merchantList.fetchEnrichedDetails({ lat: center.lat, lon: center.lng }, radiusKm);
		}
	};

	// Zoom 11-14: Fetch from API with result limit (may show "zoom in" message)
	const updateListApiWithLimit = (
		center: LatLng,
		bounds: LatLngBounds,
		allowHeavyFetch: boolean
	) => {
		const radiusKm = calculateRadiusKm(bounds) * NEARBY_RADIUS_MULTIPLIER;

		if (!$merchantList.isOpen || !allowHeavyFetch) {
			merchantList.fetchCountOnly({ lat: center.lat, lon: center.lng }, radiusKm);
		} else {
			merchantList.fetchAndReplaceList({ lat: center.lat, lon: center.lng }, radiusKm, {
				hideIfExceeds: MERCHANT_LIST_MAX_ITEMS
			});
		}
	};

	// Update merchant list panel based on zoom level and visible places
	const updateMerchantList = (opts?: { force?: boolean }) => {
		if (!browser || !map) return;

		// Skip updates in search mode - search results are independent of map viewport
		if ($merchantList.mode === 'search') return;

		const bounds = map.getBounds();
		const center = map.getCenter();
		const behavior = getZoomBehavior(currentZoom);
		const isDesktop = window.innerWidth >= BREAKPOINTS.md;

		// Determine if we should fetch full data or just count
		// - Desktop: always fetch full data (list panel visible alongside map)
		// - Force flag: explicit user action (e.g., button click)
		// - List open: user is actively viewing the list (mobile or desktop)
		const allowHeavyFetch = isDesktop || opts?.force || $merchantList.isOpen;

		switch (behavior) {
			case 'local-markers':
				updateListLocalMarkers(center, bounds, allowHeavyFetch);
				break;
			case 'api-with-limit':
				updateListApiWithLimit(center, bounds, allowHeavyFetch);
				break;
			case 'none':
			default:
				merchantList.setMerchants([], 0, 0);
		}
	};

	// Debounced version to prevent excessive updates during pan/zoom
	const debouncedUpdateMerchantList = debounce(updateMerchantList, MAP_DEBOUNCE_DELAY);

	// Calculate panel width for map offset (desktop only - mobile panels are at bottom)
	// Accounts for both MerchantListPanel (left) and MerchantDrawer (stacked to its right)
	const getPanelOffset = () => {
		const mapSize = map!.getSize();
		const isDesktop = mapSize.x >= BREAKPOINTS.md;
		const listWidth = isDesktop && $merchantList.isOpen ? MERCHANT_LIST_WIDTH : 0;
		const drawerWidth = isDesktop && $merchantDrawer.isOpen ? MERCHANT_DRAWER_WIDTH : 0;
		const panelWidth = listWidth + drawerWidth;
		const visibleCenterX = (mapSize.x - panelWidth) / 2;
		return { panelWidth, visibleCenterX, mapSize };
	};

	// Shared helper: navigate map to a place with drawer offset compensation
	const navigateToPlace = (
		place: Place,
		options: { targetZoom?: number; spiderfyCluster?: boolean } = {}
	) => {
		if (!map || !browser) return;

		const { visibleCenterX, mapSize } = getPanelOffset();
		const { targetZoom, spiderfyCluster = false } = options;

		if (targetZoom !== undefined) {
			// Zoom to specific level: calculate offset at target zoom
			const offsetX = mapSize.x / 2 - visibleCenterX;
			const targetPoint = map.project([place.lat, place.lon], targetZoom);
			const offsetPoint = leaflet.point(targetPoint.x + offsetX, targetPoint.y);
			const offsetLatLng = map.unproject(offsetPoint, targetZoom);
			map.setView(offsetLatLng, targetZoom, { animate: true, duration: 0.3 });
		} else {
			// Pan only: calculate offset at current zoom
			const targetPoint = map.latLngToContainerPoint([place.lat, place.lon]);
			const offsetX = targetPoint.x - visibleCenterX;
			const offsetY = targetPoint.y - mapSize.y / 2;

			const currentCenter = map.getCenter();
			const currentCenterPoint = map.latLngToContainerPoint(currentCenter);
			const newCenterPoint = leaflet.point(
				currentCenterPoint.x + offsetX,
				currentCenterPoint.y + offsetY
			);
			const newCenter = map.containerPointToLatLng(newCenterPoint);
			map.panTo(newCenter, { animate: true, duration: 0.3 });
		}

		// Optionally spiderfy cluster containing the marker
		// Skip only if marker is in boosted layer (not clustered)
		const isInBoostedLayer =
			boostedLayerMarkerIds.has(place.id.toString()) && !shouldClusterBoostedMarkers();
		if (spiderfyCluster && !isInBoostedLayer) {
			const marker = loadedMarkers[place.id.toString()];
			if (marker && markers) {
				const cluster = markers.getVisibleParent(marker);
				if (cluster && cluster !== marker && 'spiderfy' in cluster) {
					(cluster as { spiderfy: () => void }).spiderfy();
				}
			}
		}
	};

	// Pan to a nearby merchant (user is already zoomed in, just center the marker)
	const panToNearbyMerchant = (place: Place) => {
		navigateToPlace(place, { spiderfyCluster: true });
	};

	// Zoom to a search result (user may be far away, fly to the location)
	const zoomToSearchResult = (place: Place) => {
		navigateToPlace(place, { targetZoom: 19 });
	};

	const initializeElements = async () => {
		if (elementsLoaded) {
			return;
		}

		mapLoadingStatus = 'Initializing markers...';

		// create marker cluster group and layers
		/* eslint-disable no-undef */
		// @ts-expect-error - L is global from Leaflet
		markers = L.markerClusterGroup({
			maxClusterRadius: 80,
			disableClusteringAtZoom: CLUSTERING_DISABLED_ZOOM,
			chunkedLoading: true,
			chunkInterval: 50,
			chunkDelay: 50
		});
		/* eslint-enable no-undef */
		upToDateLayer = leaflet.featureGroup.subGroup(markers);
		boostedLayer = leaflet.featureGroup();

		// Add layers to map immediately so batches can be added
		map.addLayer(markers);
		map.addLayer(upToDateLayer);
		map.addLayer(boostedLayer); // Added last to render on top of clusters

		// Set up zoom guard - prevent marker loading during zoom animation
		map.on('zoomstart', () => {
			isZooming = true;
		});

		// Consolidated map event listener - moveend fires after both pan and zoom
		map.on('moveend', () => {
			isZooming = false;
			const coords = map.getBounds();
			mapCenter = map.getCenter();
			const newZoom = map.getZoom();

			// Handle boosted marker layer transitions when crossing zoom threshold
			handleBoostedLayerTransition(previousZoom, newZoom);
			previousZoom = newZoom;
			currentZoom = newZoom;

			// Update hash if not using URL parameters
			if (!urlLat.length && !urlLong.length) {
				updateMapHash(currentZoom, mapCenter);
			}

			// Debounced operations
			debouncedCacheCoords(coords);
			debouncedLoadMarkers();
			debouncedUpdateMerchantList();
		});

		mapLoadingStatus = 'Loading places in view...';

		// Initialize mapCenter and zoom for merchant list panel and marker layer decisions
		mapCenter = map.getCenter();
		currentZoom = map.getZoom();
		previousZoom = currentZoom;

		// Load initial markers for current viewport
		// NOTE: Don't set isLoadingMarkers=true here, let loadMarkersInViewport handle it
		await loadMarkersInViewport();

		// eslint-disable-next-line svelte/infinite-reactive-loop -- this breaks the loop, not causes it
		elementsLoaded = true;

		if (browser) {
			const hash = window.location.hash.substring(1);
			if (hash.includes('merchant=')) {
				const params = new URLSearchParams(hash.substring(hash.indexOf('&') + 1));
				const merchantParam = params.get('merchant');
				if (merchantParam) {
					const merchantId = Number(merchantParam);
					selectedMarkerId = merchantId;
					highlightMarker(loadedMarkers, merchantId);
				}
			}

			// Initialize merchant list if already zoomed in
			updateMerchantList();
		}
	};

	// Process a batch of places on the main thread (DOM operations only)
	const processBatchOnMainThread = (batch: ProcessedPlace[], _layer: FeatureGroup.SubGroup) => {
		const regularMarkersToAdd: Marker[] = [];
		const boostedMarkersToAdd: Marker[] = [];

		batch.forEach((element: ProcessedPlace) => {
			const { iconData } = element;
			const placeId = element.id.toString();

			// Skip if marker already loaded (double-check)
			if (loadedMarkers[placeId]) return;

			// Generate icon using pre-calculated data from worker
			const divIcon = generateIcon(
				leaflet,
				iconData.iconTmp,
				iconData.boosted,
				iconData.commentsCount
			);

			const marker = generateMarker({
				lat: element.lat,
				long: element.lon,
				icon: divIcon,
				placeId: element.id,
				leaflet,
				verify: true,
				onMarkerClick: (id) => openMerchantDrawer(Number(id))
			});

			// Route to appropriate layer based on boost status and zoom level
			if (iconData.boosted && !shouldClusterBoostedMarkers()) {
				boostedMarkersToAdd.push(marker);
				boostedLayerMarkerIds.add(placeId);
			} else {
				regularMarkersToAdd.push(marker);
			}
			loadedMarkers[placeId] = marker;
		});

		// Batch add regular markers to cluster group
		if (regularMarkersToAdd.length > 0 && markers) {
			markers.addLayers(regularMarkersToAdd);
		}

		// Add boosted markers to non-clustered layer (only at zoom > 5)
		if (boostedMarkersToAdd.length > 0 && boostedLayer) {
			boostedMarkersToAdd.forEach((m) => boostedLayer.addLayer(m));
		}

		// Highlight the selected marker if it was just loaded (may be pending from search result click)
		if ((regularMarkersToAdd.length > 0 || boostedMarkersToAdd.length > 0) && selectedMarkerId) {
			highlightMarker(loadedMarkers, selectedMarkerId);
		}
	};

	// Initialize elements when places data is ready and map is loaded
	// The guard inside initializeElements() prevents multiple calls
	$: if ($places?.length && mapLoaded && !elementsLoaded) {
		// eslint-disable-next-line svelte/infinite-reactive-loop -- elementsLoaded=true stops the loop
		initializeElements();
	}

	onMount(async () => {
		if (browser) {
			const deps = await loadMapDependencies();
			leaflet = deps.leaflet;
			DomEvent = deps.DomEvent;
			const LocateControl = deps.LocateControl;

			// add map and tiles
			map = window.L.map(mapElement, { maxZoom: 19, zoomControl: false });
			leaflet.control.zoom({ position: 'topright' }).addTo(map);

			// Helper function to set mapLoaded after view is set
			const setMapViewAndMarkLoaded = () => {
				mapCenter = map.getCenter();
				mapLoaded = true;
			};

			// use url hash if present
			if (location.hash) {
				try {
					// Extract only the map coordinates part (before any & parameters)
					const hashPart = location.hash.split('&')[0];
					const coords = hashPart.split('/');
					map.setView([Number(coords[1]), Number(coords[2])], Number(coords[0].slice(1)));
					setMapViewAndMarkLoaded();
				} catch (error) {
					map.setView([DEFAULT_MAP_LAT, DEFAULT_MAP_LNG], DEFAULT_MAP_ZOOM);
					setMapViewAndMarkLoaded();
					errToast(
						'Could not set map view to provided coordinates, please try again or contact BTC Map.'
					);
					console.error(error);
				}
			}

			// set URL lat/long query view if it exists and is valid
			else if (urlLat.length && urlLong.length) {
				try {
					if (urlLat.length > 1 && urlLong.length > 1) {
						map.fitBounds([
							[Number(urlLat[0]), Number(urlLong[0])],
							[Number(urlLat[1]), Number(urlLong[1])]
						]);
						setMapViewAndMarkLoaded();
					} else {
						map.fitBounds([[Number(urlLat[0]), Number(urlLong[0])]]);
						setMapViewAndMarkLoaded();
					}
				} catch (error) {
					map.setView([DEFAULT_MAP_LAT, DEFAULT_MAP_LNG], DEFAULT_MAP_ZOOM);
					setMapViewAndMarkLoaded();
					errToast(
						'Could not set map view to provided coordinates, please try again or contact BTC Map.'
					);
					console.error(error);
				}
			}

			// set view to last location if it is present in the cache
			else {
				localforage
					.getItem<LatLngBounds>('coords')
					.then(function (value) {
						if (value) {
							map.fitBounds([
								// @ts-expect-error - LatLngBounds internal structure access
								[value._northEast.lat, value._northEast.lng],
								// @ts-expect-error - LatLngBounds internal structure access
								[value._southWest.lat, value._southWest.lng]
							]);
						} else if (data.geo?.lat != null && data.geo?.lng != null) {
							// Use IP-based geolocation for first-time visitors
							map.setView([data.geo.lat, data.geo.lng], DEFAULT_MAP_ZOOM);
						} else {
							map.setView([DEFAULT_MAP_LAT, DEFAULT_MAP_LNG], DEFAULT_MAP_ZOOM);
						}
						setMapViewAndMarkLoaded();
					})
					.catch(function (err) {
						if (data.geo?.lat != null && data.geo?.lng != null) {
							map.setView([data.geo.lat, data.geo.lng], DEFAULT_MAP_ZOOM);
						} else {
							map.setView([DEFAULT_MAP_LAT, DEFAULT_MAP_LNG], DEFAULT_MAP_ZOOM);
						}
						setMapViewAndMarkLoaded();
						errToast(
							'Could not set map view to cached coords, please try again or contact BTC Map.'
						);
						console.error(err);
					});
			}

			// add tiles and basemaps
			const { baseMaps, activeLayer } = layers(leaflet, map);

			// Initialize current layer name for deduplication tracking
			currentLayerName = detectTheme() === 'dark' ? 'Carto Dark Matter' : 'OpenFreeMap Liberty';

			// Hook into MapLibre GL tile loading events
			if (activeLayer && activeLayer.getMaplibreMap) {
				// MapLibre GL map might not be ready immediately, poll for it
				const checkGlMap = () => {
					const glMap = activeLayer.getMaplibreMap();
					if (glMap) {
						// Clear polling timer now that GL map is ready
						if (glMapPollingTimer) {
							clearTimeout(glMapPollingTimer);
							glMapPollingTimer = null;
						}
						glMap.on('idle', () => {
							if (tilesLoadingTimer) {
								clearTimeout(tilesLoadingTimer);
								tilesLoadingTimer = null;
							}
							if (tilesLoadingFallback) {
								clearTimeout(tilesLoadingFallback);
								tilesLoadingFallback = null;
							}
							mapTilesLoaded = true;
							tilesLoading = false;
						});
					} else {
						// GL map not ready yet, check again after a short delay
						glMapPollingTimer = setTimeout(checkGlMap, 100);
					}
				};
				checkGlMap();
			} else {
				// Fallback: if not using MapLibre GL layer, mark tiles as loaded immediately
				mapTilesLoaded = true;
				tilesLoading = false;
			}

			// Show tile loading indicator on pan/zoom (debounced to prevent flickering)
			map.on('movestart', () => {
				if (tilesLoadingTimer) clearTimeout(tilesLoadingTimer);
				if (tilesLoadingFallback) clearTimeout(tilesLoadingFallback);

				// Only show indicator if loading takes > 150ms
				tilesLoadingTimer = setTimeout(() => {
					tilesLoading = true;
				}, 150);

				// Fallback: hide indicator after 5s if idle never fires
				tilesLoadingFallback = setTimeout(() => {
					tilesLoading = false;
				}, 5000);
			});

			// Close drawer when clicking on map (not on markers)
			map.on('click', () => {
				if ($merchantDrawer.isOpen) {
					if (selectedMarkerId) {
						clearMarkerSelection(loadedMarkers, selectedMarkerId);
						selectedMarkerId = null;
					}
					merchantDrawer.close();
				}
			});

			// change broken marker image path in prod
			leaflet.Icon.Default.prototype.options.imagePath = '/icons/';

			// add support attribution
			support();

			// add OSM attribution
			attribution(leaflet, map);

			// add scale
			scaleBars(leaflet, map);

			// add locate button to map
			geolocate(leaflet, map, LocateControl);

			// add boost button control
			const customControls = leaflet.Control.extend({
				options: {
					position: 'topright'
				},
				onAdd: () => {
					const addControlDiv = leaflet.DomUtil.create('div');
					addControlDiv.classList.add('leaflet-control-boost', 'leaflet-bar', 'leaflet-control');

					// Boost layer button
					const boostLayerButton = leaflet.DomUtil.create('a');
					boostLayerButton.classList.add('leaflet-control-boost-layer');
					boostLayerButton.title = 'Boosted locations';
					boostLayerButton.role = 'button';
					boostLayerButton.ariaLabel = 'Boosted locations';
					boostLayerButton.ariaDisabled = 'false';
					boostLayerButton.innerHTML = `<img src='${boosts ? '/icons/boost-solid.svg' : '/icons/boost.svg'}' alt='boost' id='boost-layer' style='width: 16px; height: 16px;'/>`;
					boostLayerButton.onclick = function toggleLayer() {
						trackEvent('boost_layer_toggle');
						if (boosts) {
							$page.url.searchParams.delete('boosts');
							location.search = $page.url.search;
						} else {
							$page.url.searchParams.append('boosts', 'true');
							location.search = $page.url.search;
						}
					};
					addControlDiv.append(boostLayerButton);

					return addControlDiv;
				}
			});

			map.addControl(new customControls());
			const boostLayer = document.querySelector('.leaflet-control-boost-layer');
			if (boostLayer) {
				DomEvent.disableClickPropagation(boostLayer as HTMLElement);
			}

			// add home and marker buttons to map
			homeMarkerButtons(leaflet, map, DomEvent, true);

			// add data refresh button to map
			dataRefresh(leaflet, map, DomEvent);

			controlLayers = leaflet.control
				.layers(baseMaps, undefined, { position: 'topright' })
				.addTo(map);

			// track layer changes (with deduplication to avoid tracking same layer selection)
			map.on('baselayerchange', (e: { name: string }) => {
				if (e.name !== currentLayerName) {
					trackEvent('layer_change', { layer: e.name });
					currentLayerName = e.name;
				}
			});

			// change default icons
			changeDefaultIcons(true, leaflet, mapElement, DomEvent);

			// final map setup
			map.on('load', () => {
				mapCenter = map.getCenter();
				mapLoaded = true;
			});

			// Watch for hash changes to clear marker selection when drawer closes
			window.addEventListener('hashchange', handleHashChange);

			// Sync drawer state from URL hash on initial page load
			merchantDrawer.syncFromHash();
		}
	});

	onDestroy(async () => {
		// Cancel pending debounced operations to prevent memory leaks
		if (debouncedLoadMarkers?.cancel) debouncedLoadMarkers.cancel();
		if (debouncedCacheCoords?.cancel) debouncedCacheCoords.cancel();
		if (tilesLoadingTimer) clearTimeout(tilesLoadingTimer);
		if (tilesLoadingFallback) clearTimeout(tilesLoadingFallback);
		if (glMapPollingTimer) clearTimeout(glMapPollingTimer);
		if (debouncedUpdateMerchantList?.cancel) debouncedUpdateMerchantList.cancel();
		if (debouncedPanelSearch?.cancel) debouncedPanelSearch.cancel();
		searchAbortController?.abort();

		// Reset merchant list
		merchantList.reset();

		if (map) {
			console.info('Unloading Leaflet map.');
			map.remove();
		}
		// Clean up web worker
		terminateWorker();

		// Reset loading progress when leaving map page to avoid stale states
		placesLoadingProgress.set(0);
		placesLoadingStatus.set('');

		// Remove hash change listener
		if (browser) {
			window.removeEventListener('hashchange', handleHashChange);
		}
	});
</script>

<svelte:head>
	<title>BTC Map</title>
	<meta property="og:image" content="https://btcmap.org/images/og/map.png" />
	<meta property="twitter:title" content="BTC Map" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/map.png" />
</svelte:head>

<main class="relative h-screen w-full">
	<h1 class="hidden">Map</h1>

	<MapLoadingMain progress={mapLoading} status={mapLoadingStatus} />

	<!-- Map takes full space -->
	<div bind:this={mapElement} class="map-fullscreen absolute inset-0 !bg-teal dark:!bg-dark" />

	<!-- Floating search bar - desktop: top-left, mobile: bottom-center -->
	{#if mapLoaded}
		<div
			class="pointer-events-none absolute z-[1002] max-md:right-3 max-md:bottom-20 max-md:left-3 md:top-3 md:left-3"
		>
			<MapSearchBar
				onSearch={handlePanelSearch}
				onFocus={() => {
					merchantList.open();
					updateMerchantList({ force: true });
				}}
				onNearbyClick={() => {
					merchantList.open();
					updateMerchantList({ force: true });
				}}
				nearbyCount={$merchantList.totalCount}
				isLoadingCount={$merchantList.isLoadingList}
			/>
		</div>
	{/if}

	<!-- Merchant list panel (overlays map, search input at same position as floating bar) -->
	<MerchantListPanel
		onPanToNearbyMerchant={panToNearbyMerchant}
		onZoomToSearchResult={zoomToSearchResult}
		onFitSearchResultBounds={fitBoundsToSearchResults}
		onHoverStart={(place) => highlightMarker(loadedMarkers, place.id)}
		onHoverEnd={(place) => {
			// Don't clear if this is the selected marker
			if (selectedMarkerId !== place.id) {
				clearMarkerSelection(loadedMarkers, place.id);
			}
		}}
		onSearch={handlePanelSearch}
		onModeChange={handleModeChange}
		onRefresh={() => updateMerchantList({ force: true })}
		{currentZoom}
	/>

	<MerchantDrawerHash />

	<TileLoadingIndicator visible={tilesLoading} />
</main>

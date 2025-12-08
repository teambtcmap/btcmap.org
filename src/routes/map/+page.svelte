<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import Icon from '$components/Icon.svelte';
	import LoadingSpinner from '$components/LoadingSpinner.svelte';
	import MapLoadingMain from '$components/MapLoadingMain.svelte';
	import TileLoadingIndicator from './components/TileLoadingIndicator.svelte';
	import MerchantDrawerHash from './components/MerchantDrawerHash.svelte';
	import MerchantListPanel from './components/MerchantListPanel.svelte';
	import { merchantDrawer } from '$lib/merchantDrawerStore';
	import { merchantList, type MerchantListMode } from '$lib/merchantListStore';
	import {
		BREAKPOINTS,
		MERCHANT_DRAWER_WIDTH,
		CLUSTERING_DISABLED_ZOOM,
		MERCHANT_LIST_MIN_ZOOM,
		MERCHANT_LIST_LOW_ZOOM,
		MERCHANT_LIST_MAX_ITEMS,
		HIGH_ZOOM_RADIUS_MULTIPLIER,
		MIN_SEARCH_RADIUS_KM
	} from '$lib/constants';
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
	import { debounce, detectTheme, errToast, isBoosted } from '$lib/utils';
	import type { Control, LatLng, LatLngBounds, Map, Marker, MarkerClusterGroup } from 'leaflet';
	import localforage from 'localforage';
	import { onDestroy, onMount, tick } from 'svelte';
	import type { FeatureGroup } from 'leaflet';

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

	const MAX_LOADED_MARKERS = 200;
	const VIEWPORT_BATCH_SIZE = 25;
	const VIEWPORT_BUFFER_PERCENT = 0.2;
	const DEBOUNCE_DELAY = 300;

	const DEFAULT_LAT = 12.11209;
	const DEFAULT_LNG = -68.91119;
	const DEFAULT_ZOOM = 15;

	let currentZoom = DEFAULT_ZOOM;

	// Throttled marker drawer opening to prevent freeze on rapid clicks
	let lastMarkerClickTime = 0;
	const MARKER_CLICK_THROTTLE = 100; // ms

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
				clearMarkerSelection(selectedMarkerId);
			}
			selectedMarkerId = id;
			highlightMarker(id);
		});

		merchantDrawer.open(id, 'details');
	}

	let leaflet: Leaflet;
	let DomEvent: typeof import('leaflet/src/dom/DomEvent');
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	let controlLayers: Control.Layers;

	let mapElement: HTMLDivElement;
	let map: Map;
	let mapLoaded = false;
	let elementsLoaded = false;
	let mapTilesLoaded = false;
	let tilesLoading = true;
	let tilesLoadingTimer: ReturnType<typeof setTimeout> | null = null;
	let tilesLoadingFallback: ReturnType<typeof setTimeout> | null = null;

	let markers: MarkerClusterGroup;
	let upToDateLayer: FeatureGroup.SubGroup;
	let loadedMarkers: Record<string, Marker> = {};
	let selectedMarkerId: number | null = null;

	let isLoadingMarkers = false;
	let isZooming = false;

	let mapCenter: LatLng;

	// Calculate radius from map center to corner (Haversine formula)
	const calculateRadiusKm = (bounds: LatLngBounds): number => {
		const center = bounds.getCenter();
		const corner = bounds.getNorthEast();

		const R = 6371; // Earth radius in km
		const dLat = ((corner.lat - center.lat) * Math.PI) / 180;
		const dLon = ((corner.lng - center.lng) * Math.PI) / 180;
		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos((center.lat * Math.PI) / 180) *
				Math.cos((corner.lat * Math.PI) / 180) *
				Math.sin(dLon / 2) *
				Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		return R * c * 1.1; // Add 10% buffer
	};

	const clearMarkerSelection = (markerId: number) => {
		const marker = loadedMarkers[markerId.toString()];
		if (!marker) return;

		const markerIcon = marker.getElement();
		if (markerIcon) {
			markerIcon.classList.remove('selected-marker', 'selected-marker-boosted');
		}
	};

	const highlightMarker = (markerId: number) => {
		const marker = loadedMarkers[markerId.toString()];
		if (!marker) return;

		const markerIcon = marker.getElement();
		if (markerIcon) {
			const isBoosted = markerIcon.classList.contains('boosted-icon');
			markerIcon.classList.add(isBoosted ? 'selected-marker-boosted' : 'selected-marker');
		}
	};

	const handleHashChange = () => {
		if (!browser) return;

		// Sync store from hash - single source of truth
		merchantDrawer.syncFromHash();

		const hash = window.location.hash.substring(1);
		const hasDrawer = hash.includes('merchant=');

		if (!hasDrawer && selectedMarkerId) {
			clearMarkerSelection(selectedMarkerId);
			selectedMarkerId = null;
		} else if (hasDrawer) {
			const params = new URLSearchParams(hash.substring(hash.indexOf('&') + 1));
			const merchantParam = params.get('merchant');
			if (merchantParam) {
				const merchantId = Number(merchantParam);
				if (merchantId !== selectedMarkerId) {
					if (selectedMarkerId) {
						clearMarkerSelection(selectedMarkerId);
					}
					selectedMarkerId = merchantId;
					highlightMarker(merchantId);
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
			// Clear results but keep search mode (user is still typing)
			merchantList.clearSearchResults();
			return;
		}

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
			merchantList.clearSearch();
		}
	};

	// Debounced search for panel input
	const debouncedPanelSearch = debounce((query: string) => executeSearch(query), 300);

	// Handler for panel search input
	const handlePanelSearch = (query: string) => {
		debouncedPanelSearch(query);
	};

	const clearSearchInput = () => {
		// Abort any in-flight search request when clearing input
		searchAbortController?.abort();
		merchantList.clearSearchResults();
	};

	const handleModeChange = (mode: MerchantListMode) => {
		// Abort any in-flight search when switching away from search mode
		if (mode === 'nearby') {
			searchAbortController?.abort();
		}
		merchantList.setMode(mode);
		if (mode === 'nearby') {
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
				const boosted = isBoosted(updatedPlace) ? true : false;

				const newIcon = generateIcon(
					leaflet,
					updatedPlace.icon || 'question_mark',
					boosted,
					commentsCount
				);

				// Update the marker icon
				marker.setIcon(newIcon);
				console.info(`Updated marker icon for place ${$lastUpdatedPlaceId}`);
			}
		}

		// Reset the signal
		$lastUpdatedPlaceId = undefined;
	}

	// Get places visible in current viewport with buffer
	const getVisiblePlaces = (
		places: Place[],
		bounds: LatLngBounds,
		bufferPercent = VIEWPORT_BUFFER_PERCENT
	): Place[] => {
		if (!bounds) return [];

		// Add buffer to bounds to preload markers slightly outside viewport
		const latDiff = bounds.getNorth() - bounds.getSouth();
		const lngDiff = bounds.getEast() - bounds.getWest();
		const latBuffer = latDiff * bufferPercent;
		const lngBuffer = lngDiff * bufferPercent;

		const bufferedBounds = leaflet.latLngBounds([
			[bounds.getSouth() - latBuffer, bounds.getWest() - lngBuffer],
			[bounds.getNorth() + latBuffer, bounds.getEast() + lngBuffer]
		]);

		return places.filter((place) => bufferedBounds.contains([place.lat, place.lon]));
	};

	// Remove markers that are no longer in viewport
	const cleanupOutOfBoundsMarkers = (bounds: LatLngBounds) => {
		const markersToRemove: string[] = [];

		Object.entries(loadedMarkers).forEach(([placeId, marker]) => {
			const markerLatLng = marker.getLatLng();
			if (!bounds.contains(markerLatLng)) {
				upToDateLayer.removeLayer(marker);
				markersToRemove.push(placeId);
			}
		});

		markersToRemove.forEach((placeId) => {
			delete loadedMarkers[placeId];
		});

		if (markersToRemove.length > 0) {
			console.info(`Cleaned up ${markersToRemove.length} out-of-bounds markers`);
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
			// Get visible places (viewport filtering)
			const visiblePlaces = getVisiblePlaces($places, bounds);

			// Filter out places that already have markers loaded
			const newPlaces = visiblePlaces.filter((place) => !loadedMarkers[place.id.toString()]);

			if (newPlaces.length === 0) {
				isLoadingMarkers = false;
				return;
			}

			// Clean up markers outside viewport if we have many loaded
			if (Object.keys(loadedMarkers).length > MAX_LOADED_MARKERS) {
				cleanupOutOfBoundsMarkers(bounds);
			}

			// Check if web workers are supported before trying to use them
			if (isWorkerSupported()) {
				// Process new places using web worker
				await processPlaces(
					newPlaces,
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

			console.info(`[VIEWPORT] Successfully loaded ${newPlaces.length} markers`);
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
		const visiblePlaces = getVisiblePlaces($places, bounds);
		const newPlaces = visiblePlaces.filter((place) => !loadedMarkers[place.id.toString()]);

		newPlaces.forEach((place: Place) => {
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

			upToDateLayer.addLayer(marker);
			loadedMarkers[place.id.toString()] = marker;

			// Highlight if this is the selected marker (may be pending from search result click)
			if (selectedMarkerId === place.id) {
				highlightMarker(place.id);
			}
		});
	};

	// Debounced version to prevent excessive loading during rapid pan/zoom
	const debouncedLoadMarkers = debounce(loadMarkersInViewport, DEBOUNCE_DELAY);

	// Debounced coords caching to prevent IndexedDB overflow during continuous movement
	const debouncedCacheCoords = debounce((coords: LatLngBounds) => {
		localforage.setItem('coords', coords).catch(function (err) {
			console.error('Error caching coords:', err);
		});
	}, 1000); // 1 second debounce for IndexedDB writes

	// Determines which fetch strategy to use based on current zoom level
	// See constants.ts for zoom behavior documentation
	type ZoomBehavior = 'none' | 'api-with-limit' | 'local-markers' | 'api-extended';

	function getZoomBehavior(zoom: number): ZoomBehavior {
		if (zoom >= CLUSTERING_DISABLED_ZOOM) return 'api-extended'; // Zoom 17+
		if (zoom >= MERCHANT_LIST_MIN_ZOOM) return 'local-markers'; // Zoom 15-16
		if (zoom >= MERCHANT_LIST_LOW_ZOOM) return 'api-with-limit'; // Zoom 11-14
		return 'none'; // Below zoom 11
	}

	// Zoom 17+: Fetch full merchant data from API with extended radius
	const updateListApiExtended = (
		center: LatLng,
		bounds: LatLngBounds,
		allowHeavyFetch: boolean
	) => {
		const viewportRadius = calculateRadiusKm(bounds);
		const radiusKm = Math.max(viewportRadius * HIGH_ZOOM_RADIUS_MULTIPLIER, MIN_SEARCH_RADIUS_KM);
		if (!$merchantList.isOpen && !allowHeavyFetch) {
			merchantList.fetchCountOnly({ lat: center.lat, lon: center.lng }, radiusKm);
		} else {
			merchantList.fetchAndReplaceList({ lat: center.lat, lon: center.lng }, radiusKm);
		}
	};

	// Zoom 15-16: Use locally loaded markers, optionally enrich with API data
	const updateListLocalMarkers = (
		center: LatLng,
		bounds: LatLngBounds,
		allowHeavyFetch: boolean
	) => {
		const visiblePlaces = $places.filter((place) => {
			const markerId = place.id.toString();
			if (!loadedMarkers[markerId]) return false;
			return bounds.contains([place.lat, place.lon]);
		});

		merchantList.setMerchants(visiblePlaces, center.lat, center.lng);

		if ($merchantList.isOpen && allowHeavyFetch) {
			const radiusKm = calculateRadiusKm(bounds);
			merchantList.fetchEnrichedDetails({ lat: center.lat, lon: center.lng }, radiusKm);
		}
	};

	// Zoom 11-14: Fetch from API with result limit (may show "zoom in" message)
	const updateListApiWithLimit = (
		center: LatLng,
		bounds: LatLngBounds,
		allowHeavyFetch: boolean
	) => {
		const radiusKm = calculateRadiusKm(bounds);

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
			case 'api-extended':
				updateListApiExtended(center, bounds, allowHeavyFetch);
				break;
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
	const debouncedUpdateMerchantList = debounce(updateMerchantList, DEBOUNCE_DELAY);

	// Calculate drawer width for map offset (desktop only - mobile drawer is at bottom)
	const getDrawerOffset = () => {
		const mapSize = map!.getSize();
		const isDesktop = mapSize.x >= BREAKPOINTS.md;
		const drawerWidth = isDesktop && $merchantDrawer.isOpen ? MERCHANT_DRAWER_WIDTH : 0;
		const visibleCenterX = (mapSize.x - drawerWidth) / 2;
		return { drawerWidth, visibleCenterX, mapSize };
	};

	// Shared helper: navigate map to a place with drawer offset compensation
	const navigateToPlace = (
		place: Place,
		options: { targetZoom?: number; spiderfyCluster?: boolean } = {}
	) => {
		if (!map || !browser) return;

		const { visibleCenterX, mapSize } = getDrawerOffset();
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
		if (spiderfyCluster) {
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

		// Add layers to map immediately so batches can be added
		map.addLayer(markers);
		map.addLayer(upToDateLayer);

		// Set up zoom guard - prevent marker loading during zoom animation
		map.on('zoomstart', () => {
			isZooming = true;
		});

		// Consolidated map event listener - moveend fires after both pan and zoom
		map.on('moveend', () => {
			isZooming = false;
			const coords = map.getBounds();
			mapCenter = map.getCenter();
			currentZoom = map.getZoom();

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

		// Initialize mapCenter for merchant list panel
		mapCenter = map.getCenter();

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
					highlightMarker(merchantId);
				}
			}

			// Initialize merchant list if already zoomed in
			currentZoom = map.getZoom();
			updateMerchantList();
		}
	};

	// Process a batch of places on the main thread (DOM operations only)
	const processBatchOnMainThread = (batch: ProcessedPlace[], _layer: FeatureGroup.SubGroup) => {
		const markersToAdd: Marker[] = [];

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

			markersToAdd.push(marker);
			loadedMarkers[placeId] = marker;
		});

		// Batch add markers - use parent cluster group's addLayers for efficiency
		if (markersToAdd.length > 0 && markers) {
			markers.addLayers(markersToAdd);

			// Highlight the selected marker if it was just loaded (may be pending from search result click)
			if (selectedMarkerId) {
				highlightMarker(selectedMarkerId);
			}
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
			const theme = detectTheme();

			const deps = await loadMapDependencies();
			leaflet = deps.leaflet;
			DomEvent = deps.DomEvent;
			const LocateControl = deps.LocateControl;

			// add map and tiles
			map = window.L.map(mapElement, { maxZoom: 19 });

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
					map.setView([DEFAULT_LAT, DEFAULT_LNG], DEFAULT_ZOOM);
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
					map.setView([DEFAULT_LAT, DEFAULT_LNG], DEFAULT_ZOOM);
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
						} else {
							map.setView([DEFAULT_LAT, DEFAULT_LNG], DEFAULT_ZOOM);
						}
						setMapViewAndMarkLoaded();
					})
					.catch(function (err) {
						map.setView([DEFAULT_LAT, DEFAULT_LNG], DEFAULT_ZOOM);
						setMapViewAndMarkLoaded();
						errToast(
							'Could not set map view to cached coords, please try again or contact BTC Map.'
						);
						console.error(err);
					});
			}

			// add tiles and basemaps
			const { baseMaps, activeLayer } = layers(leaflet, map);

			// Hook into MapLibre GL tile loading events
			if (activeLayer && activeLayer.getMaplibreMap) {
				// MapLibre GL map might not be ready immediately, poll for it
				const checkGlMap = () => {
					const glMap = activeLayer.getMaplibreMap();
					if (glMap) {
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
						setTimeout(checkGlMap, 100);
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
				if (selectedMarkerId) {
					clearMarkerSelection(selectedMarkerId);
					selectedMarkerId = null;

					const hash = window.location.hash.substring(1);
					const ampIndex = hash.indexOf('&');
					const mapPart = ampIndex !== -1 ? hash.substring(0, ampIndex) : hash;

					// Remove merchant parameter and reset hash to just map location
					if (mapPart) {
						window.location.hash = mapPart;
					} else {
						window.location.hash = '';
					}
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

			// add new control container for search and boost
			const customControls = leaflet.Control.extend({
				options: {
					position: 'topleft'
				},
				onAdd: () => {
					const addControlDiv = leaflet.DomUtil.create('div');
					addControlDiv.style.border = 'none';
					addControlDiv.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';
					addControlDiv.classList.add(
						'leaflet-control-search-boost',
						'leaflet-bar',
						'leaflet-control'
					);

					// Search button - opens panel in search mode
					const searchButton = leaflet.DomUtil.create('a');
					searchButton.classList.add('leaflet-control-search-toggle');
					searchButton.title = 'Search';
					searchButton.role = 'button';
					searchButton.ariaLabel = 'Search';
					searchButton.ariaDisabled = 'false';
					searchButton.innerHTML = `<img src=${
						theme === 'dark' ? '/icons/search-white.svg' : '/icons/search.svg'
					} alt='search' class='inline' id='search-button'/>`;
					searchButton.style.borderRadius = '8px 8px 0 0';
					searchButton.onclick = function openSearch() {
						// Open panel in search mode (will auto-focus input)
						merchantList.openSearchMode();
					};
					if (theme === 'light') {
						searchButton.onmouseenter = () => {
							// @ts-expect-error
							document.querySelector('#search-button').src = '/icons/search-black.svg';
						};
						searchButton.onmouseleave = () => {
							// @ts-expect-error
							document.querySelector('#search-button').src = '/icons/search.svg';
						};
					}
					searchButton.classList.add(
						'dark:!bg-dark',
						'dark:hover:!bg-dark/75',
						'dark:border',
						'dark:border-white/95'
					);

					addControlDiv.append(searchButton);

					// add boost layer button
					const boostLayerButton = leaflet.DomUtil.create('a');
					boostLayerButton.classList.add('leaflet-control-boost-layer');
					boostLayerButton.title = 'Boosted locations';
					boostLayerButton.role = 'button';
					boostLayerButton.ariaLabel = 'Boosted locations';
					boostLayerButton.ariaDisabled = 'false';
					boostLayerButton.innerHTML = `<img src=${
						boosts
							? theme === 'dark'
								? '/icons/boost-solid-white.svg'
								: '/icons/boost-solid.svg'
							: theme === 'dark'
								? '/icons/boost-white.svg'
								: '/icons/boost.svg'
					} alt='boost' class='inline' id='boost-layer'/>`;
					boostLayerButton.style.borderRadius = '0 0 8px 8px';
					boostLayerButton.style.borderBottom = '1px solid #ccc';
					boostLayerButton.onclick = function toggleLayer() {
						if (boosts) {
							$page.url.searchParams.delete('boosts');
							location.search = $page.url.search;
						} else {
							$page.url.searchParams.append('boosts', 'true');
							location.search = $page.url.search;
						}
					};
					if (theme === 'light') {
						boostLayerButton.onmouseenter = () => {
							// @ts-expect-error - LatLngBounds internal structure access
							document.querySelector('#boost-layer').src = boosts
								? '/icons/boost-solid-black.svg'
								: '/icons/boost-black.svg';
						};
						boostLayerButton.onmouseleave = () => {
							// @ts-expect-error - LatLngBounds internal structure access
							document.querySelector('#boost-layer').src = boosts
								? '/icons/boost-solid.svg'
								: '/icons/boost.svg';
						};
					}
					boostLayerButton.classList.add(
						'dark:!bg-dark',
						'dark:hover:!bg-dark/75',
						'dark:border',
						'dark:border-white/95'
					);

					addControlDiv.append(boostLayerButton);

					return addControlDiv;
				}
			});

			map.addControl(new customControls());
			const boostLayer = document.querySelector('.leaflet-control-boost-layer');
			if (boostLayer) {
				DomEvent.disableClickPropagation(boostLayer as HTMLElement);
			}

			// Search bar control - re-enabled for API-based search
			// @ts-expect-error
			map._controlCorners['topcenter'] = leaflet.DomUtil.create(
				'div',
				'leaflet-top leaflet-center',
				// @ts-expect-error
				map._controlContainer
			);

			// disable map events for search toggle
			const searchToggle = document.querySelector('.leaflet-control-search-toggle');
			if (searchToggle) {
				DomEvent.disableClickPropagation(searchToggle as HTMLElement);
			}

			// add home and marker buttons to map
			homeMarkerButtons(leaflet, map, DomEvent, true);

			// add data refresh button to map
			dataRefresh(leaflet, map, DomEvent);

			controlLayers = leaflet.control.layers(baseMaps).addTo(map);

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

<main class="flex h-screen w-full">
	<h1 class="hidden">Map</h1>

	<MapLoadingMain progress={mapLoading} status={mapLoadingStatus} />

	<!-- Merchant list panel (search results + nearby merchants) -->
	<MerchantListPanel
		onPanToNearbyMerchant={panToNearbyMerchant}
		onZoomToSearchResult={zoomToSearchResult}
		onHoverStart={(place) => highlightMarker(place.id)}
		onHoverEnd={(place) => {
			// Don't clear if this is the selected marker
			if (selectedMarkerId !== place.id) {
				clearMarkerSelection(place.id);
			}
		}}
		onSearch={handlePanelSearch}
		onClearSearch={clearSearchInput}
		onModeChange={handleModeChange}
		{currentZoom}
	/>

	<!-- Map container -->
	<div class="relative flex-1">
		<!-- Floating toggle button for merchant list (responsive positioning) -->
		<!-- Desktop: hide when list is open and expanded -->
		<!-- Mobile: hide when list is open or drawer is open -->
		{#if mapLoaded && !($merchantList.isOpen && $merchantList.isExpanded)}
			<button
				on:click={async () => {
					if ($merchantList.isOpen) {
						merchantList.expand();
					} else {
						merchantList.open();
					}
					// Reset to nearby mode when opening via toggle button
					merchantList.setMode('nearby');
					// Wait for store update to propagate before fetching
					await tick();
					updateMerchantList({ force: true });
				}}
				class="fixed right-4 bottom-[40px] z-[1000] flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-medium
					shadow-lg transition-colors hover:bg-gray-50 md:top-[10px] md:right-auto
					md:bottom-auto md:left-[60px] md:rounded-lg md:px-3 md:py-2 dark:bg-dark dark:hover:bg-white/10
					{($merchantList.isOpen && $merchantList.isExpanded) || $merchantDrawer.isOpen
					? 'max-md:hidden'
					: ''}"
				style="filter: drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3));"
				aria-label={$merchantList.isOpen ? 'Expand merchant list' : 'Open merchant list'}
				aria-expanded={$merchantList.isOpen}
			>
				<Icon w="18" h="18" icon="menu" type="material" style="text-primary dark:text-white" />
				{#if currentZoom >= MERCHANT_LIST_LOW_ZOOM && $merchantList.isLoadingList}
					<LoadingSpinner size="h-4 w-4" color="text-primary dark:text-white" />
					<span class="text-primary dark:text-white">Nearby</span>
				{:else if currentZoom >= MERCHANT_LIST_LOW_ZOOM && $merchantList.totalCount > 0}
					<span class="text-primary dark:text-white">{$merchantList.totalCount} Nearby</span>
				{:else}
					<span class="text-primary dark:text-white">Nearby</span>
				{/if}
			</button>
		{/if}

		<div bind:this={mapElement} class="absolute inset-0 !bg-teal dark:!bg-dark" />
	</div>

	<MerchantDrawerHash />

	<TileLoadingIndicator visible={tilesLoading} />
</main>

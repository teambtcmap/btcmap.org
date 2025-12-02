<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import Icon from '$components/Icon.svelte';
	import LoadingSpinner from '$components/LoadingSpinner.svelte';
	import MapLoadingMain from '$components/MapLoadingMain.svelte';
	import TileLoadingIndicator from '$components/TileLoadingIndicator.svelte';
	import MerchantDrawerHash from '$components/MerchantDrawerHash.svelte';
	import MerchantListPanel from '$components/MerchantListPanel.svelte';
	import { merchantDrawer } from '$lib/merchantDrawerStore';
	import { merchantList } from '$lib/merchantListStore';
	import {
		BREAKPOINTS,
		MERCHANT_DRAWER_WIDTH,
		CLUSTERING_DISABLED_ZOOM,
		MERCHANT_LIST_MIN_ZOOM
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
	import type { Leaflet, Place, SearchItem } from '$lib/types';
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

	let searchContainer: HTMLDivElement;
	let clearSearchButton: HTMLButtonElement;
	let showSearch = false;
	let search: string;
	let searchStatus: boolean;
	let searchResults: SearchItem[] = [];
	let isDropdownOpen = false;

	// API-based search functions using documented places search API
	const apiSearch = async () => {
		if (search.length < 3) {
			searchResults = [];
			searchStatus = false;
			isDropdownOpen = false;
			return;
		}

		searchStatus = true;
		isDropdownOpen = true;

		try {
			const response = await fetch(`/api/search/places?name=${encodeURIComponent(search)}`);

			if (!response.ok) {
				throw new Error('Search API error');
			}

			const places: Place[] = await response.json();

			// Convert Place[] to SearchItem[] format expected by UI
			searchResults = places.map((place) => ({
				type: 'element' as const,
				id: place.id,
				name: place.name || 'Unknown',
				address: place.address,
				icon: place.icon
			}));
		} catch (error) {
			console.error('Search error:', error);
			errToast('Search temporarily unavailable');
			searchResults = [];
		}

		searchStatus = false;
	};

	const searchDebounce = debounce(() => apiSearch(), 300);

	const clearSearch = () => {
		search = '';
		searchResults = [];
		isDropdownOpen = false;
	};

	const handleSearchKeyDown = (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			e.preventDefault();
			if (isDropdownOpen) {
				isDropdownOpen = false;
			} else {
				clearSearch();
			}
		}
	};

	const handleSearchFocusOut = (_e: FocusEvent) => {
		// Small timeout to allow click events to fire first
		setTimeout(() => {
			if (searchContainer && !searchContainer.contains(document.activeElement)) {
				isDropdownOpen = false;
			}
		}, 200);
	};

	// Helper function to validate coordinate values
	const isValidCoordinate = (lat: unknown, lon: unknown): lat is number => {
		return (
			typeof lat === 'number' &&
			typeof lon === 'number' &&
			!isNaN(lat) &&
			!isNaN(lon) &&
			lat >= -90 &&
			lat <= 90 &&
			lon >= -180 &&
			lon <= 180
		);
	};

	const searchSelect = async (result: SearchItem) => {
		clearSearch();

		// Use the numeric ID from the API response
		const placeId = result.id;

		// First, try to find the place in our local places store
		const localPlace = $placesById.get(placeId);

		if (localPlace && isValidCoordinate(localPlace.lat, localPlace.lon)) {
			// Use local data if available
			map.setView([localPlace.lat, localPlace.lon], 19);
			return;
		}

		// If not in local store, fetch from v4/places API
		try {
			const response = await fetch(`https://api.btcmap.org/v4/places/${result.id}?fields=lat,lon`);

			// Handle different HTTP status codes
			if (!response.ok) {
				if (response.status === 404) {
					console.error(`Place not found: ${result.id}`);
					errToast('Location not found');
				} else if (response.status >= 500) {
					console.error(`Server error: ${response.status}`);
					errToast('Server temporarily unavailable');
				} else {
					console.error(`API error: ${response.status}`);
					errToast('Location data unavailable');
				}
				return;
			}

			// Parse and validate response
			let placeData: Pick<Place, 'lat' | 'lon'>;
			try {
				placeData = await response.json();
			} catch (parseError) {
				console.error('Failed to parse place coordinates response:', parseError);
				errToast('Invalid location data received');
				return;
			}

			// Validate coordinates
			if (!isValidCoordinate(placeData.lat, placeData.lon)) {
				console.error('Invalid coordinates received:', placeData);
				errToast('Invalid location coordinates');
				return;
			}

			// Navigate to location
			map.setView([placeData.lat, placeData.lon], 19);
		} catch (error) {
			// Differentiate between network errors and other errors
			if (error instanceof TypeError && error.message.includes('fetch')) {
				console.error('Network error fetching place coordinates:', error);
				errToast('Network connection error');
			} else {
				console.error('Unexpected error fetching place coordinates:', error);
				errToast('Could not navigate to location');
			}
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
	$: if (elementsLoaded && $places.length && currentZoom >= MERCHANT_LIST_MIN_ZOOM) {
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

	// Update merchant list panel based on zoom level and visible places
	const updateMerchantList = () => {
		if (!browser) return;

		// Only show list on desktop
		if (window.innerWidth < BREAKPOINTS.md) {
			merchantList.close();
			return;
		}

		// Update merchant data when zoomed in enough (for toggle button count)
		if (currentZoom >= MERCHANT_LIST_MIN_ZOOM) {
			const bounds = map.getBounds();
			const center = map.getCenter();
			// Get places that are loaded and within current viewport
			const visiblePlaces = $places.filter((place) => {
				const markerId = place.id.toString();
				if (!loadedMarkers[markerId]) return false;
				return bounds.contains([place.lat, place.lon]);
			});

			merchantList.setMerchants(visiblePlaces, center.lat, center.lng);

			// Fetch enriched data if panel is open (debounced via this function)
			if ($merchantList.isOpen) {
				const radiusKm = calculateRadiusKm(bounds);
				merchantList.fetchByRadius({ lat: center.lat, lon: center.lng }, radiusKm);
			}
		} else {
			// Clear merchants when below min zoom, but don't close (user might have it open manually)
			merchantList.setMerchants([], 0, 0);
		}
	};

	// Debounced version to prevent excessive updates during pan/zoom
	const debouncedUpdateMerchantList = debounce(updateMerchantList, DEBOUNCE_DELAY);

	// Pan map to center selected merchant when clicked from list
	const panToMerchantIfNeeded = (place: Place) => {
		if (!map || !browser) return;

		const panToPlace = () => {
			// Always center the map on the merchant for clear visual feedback
			// Account for drawer width by offsetting the center point
			const drawerWidth = $merchantDrawer.isOpen ? MERCHANT_DRAWER_WIDTH : 0;
			const mapSize = map.getSize();

			// Calculate the center of the visible area (excluding drawer)
			const visibleCenterX = (mapSize.x - drawerWidth) / 2;
			const targetPoint = map.latLngToContainerPoint([place.lat, place.lon]);

			// Calculate offset to center merchant in visible area
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
		};

		// If marker exists and is in a cluster, spiderfy the cluster to show the marker
		const marker = loadedMarkers[place.id.toString()];
		if (marker && markers) {
			const cluster = markers.getVisibleParent(marker);
			// If marker is inside a cluster (not directly visible), spiderfy it
			if (cluster && cluster !== marker && 'spiderfy' in cluster) {
				(cluster as { spiderfy: () => void }).spiderfy();
			}
		}
		panToPlace();
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
		}
	};

	// Reactive statement to initialize elements when data is ready
	// Use a more controlled approach to prevent infinite loops
	let shouldInitialize = false;
	$: {
		if ($places && $places.length && mapLoaded && !elementsLoaded) {
			shouldInitialize = true;
		}
	}

	// Watch for shouldInitialize flag and run initialization once
	$: if (shouldInitialize) {
		shouldInitialize = false;
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

					// Search button - re-enabled with API-based search
					const searchButton = leaflet.DomUtil.create('a');
					searchButton.classList.add('leaflet-control-search-toggle');
					searchButton.title = 'Search toggle';
					searchButton.role = 'button';
					searchButton.ariaLabel = 'Search toggle';
					searchButton.ariaDisabled = 'false';
					searchButton.innerHTML = `<img src=${
						theme === 'dark' ? '/icons/search-white.svg' : '/icons/search.svg'
					} alt='search' class='inline' id='search-button'/>`;
					searchButton.style.borderRadius = '8px 8px 0 0';
					searchButton.onclick = async function toggleSearch() {
						showSearch = !showSearch;
						if (showSearch) {
							await tick();
							const searchInput: HTMLInputElement | null = document.querySelector('#search-input');
							searchInput?.focus();
						} else {
							search = '';
							searchResults = [];
						}
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

			// @ts-expect-error
			leaflet.Control.Search = leaflet.Control.extend({
				options: {
					position: 'topcenter'
				},
				onAdd: () => {
					const searchBarDiv = leaflet.DomUtil.create('div');
					searchBarDiv.classList.add('leaflet-control', 'search-bar-div');

					searchBarDiv.append(searchContainer);

					return searchBarDiv;
				}
			});

			// @ts-expect-error
			new leaflet.Control.Search().addTo(map);

			// disable map events for search controls
			if (searchContainer) {
				DomEvent.disableClickPropagation(searchContainer as HTMLElement);
				DomEvent.disableScrollPropagation(searchContainer as HTMLElement);
			}
			const searchToggle = document.querySelector('.leaflet-control-search-toggle');
			if (searchToggle) {
				DomEvent.disableClickPropagation(searchToggle as HTMLElement);
			}
			if (clearSearchButton) {
				DomEvent.disableClickPropagation(clearSearchButton as HTMLElement);
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

	<!-- Desktop: Merchant list panel (flexbox, not overlay) -->
	<MerchantListPanel
		onPanToPlace={panToMerchantIfNeeded}
		onHoverStart={(place) => highlightMarker(place.id)}
		onHoverEnd={(place) => {
			// Don't clear if this is the selected marker
			if (selectedMarkerId !== place.id) {
				clearMarkerSelection(place.id);
			}
		}}
		{currentZoom}
	/>

	<!-- Map container -->
	<div class="relative flex-1">
		<!-- Search UI - re-enabled with API-based search -->
		<div
			id="search-div"
			bind:this={searchContainer}
			class="absolute top-0 left-[60px] z-[1000] w-[50vw] md:w-[350px] {showSearch
				? 'block'
				: 'hidden'}"
			on:focusout={handleSearchFocusOut}
		>
			<div class="relative">
				<input
					id="search-input"
					type="search"
					aria-label="Search for Bitcoin merchants"
					class="text-mapButton w-full rounded-lg bg-white px-5 py-2.5 text-[16px] drop-shadow-[0px_0px_4px_rgba(0,0,0,0.2)] focus:outline-hidden focus:drop-shadow-[0px_2px_6px_rgba(0,0,0,0.3)] dark:border dark:bg-dark dark:text-white [&::-webkit-search-cancel-button]:hidden"
					placeholder="Search..."
					on:keyup={searchDebounce}
					on:keydown={handleSearchKeyDown}
					bind:value={search}
					disabled={!mapLoaded}
				/>

				<button
					type="button"
					aria-label="Clear search"
					bind:this={clearSearchButton}
					on:click={clearSearch}
					class="text-mapButton absolute top-[10px] right-[8px] bg-white hover:text-black dark:bg-dark dark:text-white dark:hover:text-white/80 {search
						? 'block'
						: 'hidden'}"
				>
					<svg
						width="20"
						height="20"
						viewBox="0 0 20 20"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M14.1668 5.8335L5.8335 14.1668M5.8335 5.8335L14.1668 14.1668"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</button>
			</div>

			{#if isDropdownOpen}
				<div
					class="mt-0.5 w-full rounded-lg bg-white drop-shadow-[0px_2px_6px_rgba(0,0,0,0.15)] dark:bg-dark"
				>
					{#if !searchStatus && searchResults.length > 0}
						<div
							class="border-b border-gray-200 px-4 py-2 text-xs text-gray-600 dark:border-white/10 dark:text-white/70"
						>
							{searchResults.length} result{searchResults.length === 1 ? '' : 's'}
						</div>
					{/if}

					<ul class="max-h-[204px] w-full overflow-y-scroll">
						{#if searchStatus}
							<li role="status" aria-live="polite" class="w-full px-4 py-6">
								<LoadingSpinner color="text-link dark:text-white" size="h-6 w-6" />
							</li>
						{:else if searchResults.length > 0}
							{#each searchResults as result (result.id)}
								<li>
									<button
										on:click={() => searchSelect(result)}
										class="hover:bg-searchHover block w-full cursor-pointer border-b border-gray-200 px-4 py-2 text-left dark:border-white/10 dark:hover:bg-white/[0.15]"
									>
										<div class="flex items-start space-x-2">
											<Icon
												w="20"
												h="20"
												style="mt-1 text-mapButton dark:text-white opacity-50"
												icon={result.icon && result.icon !== 'question_mark'
													? result.icon
													: 'currency_bitcoin'}
												type="material"
											/>

											<div class="max-w-[280px]">
												<p
													class="text-mapButton text-sm dark:text-white {result.name?.match(
														'([^ ]{21})'
													)
														? 'break-all'
														: ''}"
												>
													{result.name || 'Unknown'}
												</p>
												{#if result.address}
													<p class="text-searchSubtext text-xs dark:text-white/70">
														{result.address}
													</p>
												{/if}
											</div>
										</div>
									</button>
								</li>
							{/each}
						{:else}
							<li
								class="text-searchSubtext w-full px-4 py-2 text-center text-sm dark:text-white/70"
							>
								No results found.
							</li>
						{/if}
					</ul>
				</div>
			{/if}
		</div>

		<!-- Floating toggle button for merchant list (always visible on desktop) -->
		{#if !($merchantList.isOpen && $merchantList.isExpanded)}
			<button
				on:click={() => {
					if ($merchantList.isOpen) {
						merchantList.expand();
					} else {
						merchantList.open();
					}
					// Trigger immediate update to fetch enriched data
					updateMerchantList();
				}}
				class="absolute top-[10px] left-[60px] z-[1000] hidden items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium shadow-lg transition-colors hover:bg-gray-50 md:flex dark:bg-dark dark:hover:bg-white/10"
				style="filter: drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3));"
				aria-label="Open merchant list"
			>
				<Icon w="18" h="18" icon="menu" type="material" style="text-primary dark:text-white" />
				{#if currentZoom >= MERCHANT_LIST_MIN_ZOOM && $merchantList.merchants.length > 0}
					<span class="text-primary dark:text-white">{$merchantList.merchants.length} Nearby</span>
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

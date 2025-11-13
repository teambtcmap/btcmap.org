<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { Boost, Icon, MapLoadingMain, ShowTags, TaggingIssues } from '$lib/comp';
	import {
		processPlaces,
		isSupported as isWorkerSupported,
		terminate as terminateWorker
	} from '$lib/workers/worker-manager';
	import type { ProcessedPlace } from '$lib/workers/map-worker';
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
	import OutClick from 'svelte-outclick';
	import type { FeatureGroup } from 'leaflet';

	let mapLoading = 0;
	let mapLoadingStatus = '';

	// Log all loading state changes for debugging
	$: if (mapLoading !== undefined || mapLoadingStatus !== undefined) {
		console.log(
			`[LOADING STATE] Progress: ${mapLoading}% | Status: "${mapLoadingStatus}" | elementsLoaded: ${elementsLoaded} | isLoadingMarkers: ${isLoadingMarkers} | placesProgress: ${$placesLoadingProgress}% | placesStatus: "${$placesLoadingStatus}"`
		);
	}

	// Combine map loading progress with places loading progress
	// Using independent checks to avoid stuck states when progress resets
	$: {
		// Priority 1: Places are actively loading
		if ($placesLoadingProgress > 0 && $placesLoadingProgress < 100) {
			mapLoading = $placesLoadingProgress;
			mapLoadingStatus = $placesLoadingStatus;
		}
		// Priority 2: Places loading complete but map not initialized
		else if ($placesLoadingProgress === 100 && !elementsLoaded) {
			mapLoading = $placesLoadingProgress;
			mapLoadingStatus = $placesLoadingStatus;
		}
		// Priority 3: Map tiles loaded, waiting to initialize markers (even after places progress resets)
		else if (mapLoaded && !elementsLoaded && $places.length > 0) {
			mapLoading = 40;
			mapLoadingStatus = 'Preparing map...';
		}
		// Priority 4: Loading markers progressively
		else if (isLoadingMarkers) {
			mapLoading = 70;
			mapLoadingStatus = 'Loading places...';
		}
		// Reset when everything is done
		else if (elementsLoaded && !isLoadingMarkers) {
			mapLoading = 0;
			mapLoadingStatus = '';
		}
	}

	// Configuration constants for viewport-based loading
	const MAX_LOADED_MARKERS = 200; // Maximum markers to keep in memory before cleanup
	const VIEWPORT_BATCH_SIZE = 25; // Batch size for processing markers in viewport
	const VIEWPORT_BUFFER_PERCENT = 0.2; // Buffer around viewport (20%)
	const DEBOUNCE_DELAY = 300; // Debounce delay for map movement (ms)

	// Default map view constants
	const DEFAULT_LAT = 12.11209;
	const DEFAULT_LNG = -68.91119;
	const DEFAULT_ZOOM = 15;

	let leaflet: Leaflet;
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	let controlLayers: Control.Layers;

	let mapElement: HTMLDivElement;
	let map: Map;
	let mapLoaded = false;
	let elementsLoaded = false;

	// Viewport-based loading state
	let markers: MarkerClusterGroup;
	let upToDateLayer: FeatureGroup.SubGroup;
	let loadedMarkers: Record<string, Marker> = {}; // placeId -> marker

	let isLoadingMarkers = false;

	let mapCenter: LatLng;

	// Search functionality re-enabled with API-based search
	let customSearchBar: HTMLDivElement;
	let clearSearchButton: HTMLButtonElement;
	let showSearch = false;
	let search: string;
	let searchStatus: boolean;
	let searchResults: SearchItem[] = [];

	// API-based search functions using documented places search API
	const apiSearch = async () => {
		if (search.length < 3) {
			searchResults = [];
			searchStatus = false;
			return;
		}

		searchStatus = true;

		try {
			const response = await fetch(
				`https://api.btcmap.org/v4/places/search/?name=${encodeURIComponent(search)}`
			);

			if (!response.ok) {
				throw new Error('Search API error');
			}

			const places: Place[] = await response.json();

			// Convert Place[] to SearchItem[] format expected by UI
			searchResults = places.map((place) => ({
				type: 'element' as const,
				id: place.id,
				name: place.name || 'Unknown'
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
		const localPlace = $places.find((p) => p.id === placeId);

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

	// alert for map errors
	$: $placesError && errToast($placesError);

	// Update marker icon when place is updated (boost or comment)
	$: if ($lastUpdatedPlaceId && leaflet && loadedMarkers) {
		const placeIdStr = $lastUpdatedPlaceId.toString();
		const marker = loadedMarkers[placeIdStr];

		if (marker) {
			// Find the updated place in the store
			const updatedPlace = $places.find((p) => p.id === $lastUpdatedPlaceId);

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
		if (!map || !$places.length || isLoadingMarkers) {
			console.warn(
				`[VIEWPORT] Skipping load - map: ${!!map} | places: ${$places.length} | isLoadingMarkers: ${isLoadingMarkers}`
			);
			return;
		}

		console.info('[VIEWPORT] Starting viewport marker load');
		isLoadingMarkers = true;
		const bounds = map.getBounds();

		try {
			// Get visible places (viewport filtering)
			const visiblePlaces = getVisiblePlaces($places, bounds);
			console.info(
				`[VIEWPORT] Found ${visiblePlaces.length} places in viewport (filtered from ${$places.length} total)`
			);

			// Filter out places that already have markers loaded
			const newPlaces = visiblePlaces.filter((place) => !loadedMarkers[place.id.toString()]);

			console.info(
				`[VIEWPORT] ${newPlaces.length} new markers to load (${Object.keys(loadedMarkers).length} already loaded)`
			);

			if (newPlaces.length === 0) {
				console.info('[VIEWPORT] No new markers to load');
				isLoadingMarkers = false;
				return;
			}

			// Clean up markers outside viewport if we have many loaded
			if (Object.keys(loadedMarkers).length > MAX_LOADED_MARKERS) {
				console.info(
					`[VIEWPORT] Cleaning up markers (current: ${Object.keys(loadedMarkers).length} > max: ${MAX_LOADED_MARKERS})`
				);
				cleanupOutOfBoundsMarkers(bounds);
			}

			// Check if web workers are supported before trying to use them
			if (isWorkerSupported()) {
				console.info(`[VIEWPORT] Loading ${newPlaces.length} markers using web worker`);

				// Process new places using web worker
				await processPlaces(
					newPlaces,
					VIEWPORT_BATCH_SIZE,
					(progress: number, batch?: ProcessedPlace[]) => {
						// Process batch on main thread (DOM operations)
						if (batch) {
							console.info(`[VIEWPORT] Processing batch of ${batch.length} markers`);
							processBatchOnMainThread(batch, upToDateLayer);
						}
					}
				);
			} else {
				console.info(
					`[VIEWPORT] Loading ${newPlaces.length} markers synchronously (no worker support)`
				);
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
			console.info(
				`[VIEWPORT COMPLETE] Total loaded: ${Object.keys(loadedMarkers).length} markers | isLoadingMarkers: ${isLoadingMarkers}`
			);
		}
	};

	// Fallback synchronous loading for viewport (much smaller dataset)
	const loadMarkersInViewportFallback = (bounds: LatLngBounds) => {
		console.warn('Falling back to synchronous viewport loading');

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
				verify: true
			});

			upToDateLayer.addLayer(marker);
			loadedMarkers[place.id.toString()] = marker;
		});

		console.info(`Fallback: loaded ${newPlaces.length} markers synchronously`);
	};

	// Debounced version to prevent excessive loading during rapid pan/zoom
	const debouncedLoadMarkers = debounce(loadMarkersInViewport, DEBOUNCE_DELAY);

	const initializeElements = async () => {
		if (elementsLoaded) {
			console.warn('[INIT] Already initialized, skipping');
			return;
		}

		console.info(
			`[INIT] Starting initialization for ${$places.length} places | isLoadingMarkers: ${isLoadingMarkers}`
		);

		mapLoadingStatus = 'Initializing markers...';

		// create marker cluster group and layers
		/* eslint-disable no-undef */
		// @ts-expect-error - L is global from Leaflet
		markers = L.markerClusterGroup({ maxClusterRadius: 80, disableClusteringAtZoom: 17 });
		/* eslint-enable no-undef */
		upToDateLayer = leaflet.featureGroup.subGroup(markers);

		console.info('[INIT] Created marker cluster group and layers');

		// Add layers to map immediately so batches can be added
		map.addLayer(markers);
		map.addLayer(upToDateLayer);

		console.info('[INIT] Added layers to map');

		// Set up map event listeners for viewport loading
		map.on('moveend', debouncedLoadMarkers);
		map.on('zoomend', debouncedLoadMarkers);

		console.info('[INIT] Set up map event listeners');

		mapLoadingStatus = 'Loading places in view...';

		// Load initial markers for current viewport
		// NOTE: Don't set isLoadingMarkers=true here, let loadMarkersInViewport handle it
		console.info('[INIT] About to call loadMarkersInViewport()...');
		await loadMarkersInViewport();

		elementsLoaded = true;

		console.info(
			`[INIT COMPLETE] Markers initialized | elementsLoaded: ${elementsLoaded} | isLoadingMarkers: ${isLoadingMarkers}`
		);

		// Status will be cleared by reactive statement above
		// No manual timeout needed - reactive state management handles it
	};

	// Process a batch of places on the main thread (DOM operations only)
	const processBatchOnMainThread = (batch: ProcessedPlace[], layer: FeatureGroup.SubGroup) => {
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
				verify: true
			});

			layer.addLayer(marker);
			loadedMarkers[placeId] = marker;
		});
	};

	// Reactive statement to initialize elements when data is ready
	// Use a more controlled approach to prevent infinite loops
	let shouldInitialize = false;
	$: {
		if ($places && $places.length && mapLoaded && !elementsLoaded) {
			console.info(
				`[INIT TRIGGER] places: ${$places.length} | mapLoaded: ${mapLoaded} | elementsLoaded: ${elementsLoaded} → Setting shouldInitialize = true`
			);
			shouldInitialize = true;
		}
	}

	// Watch for shouldInitialize flag and run initialization once
	$: if (shouldInitialize) {
		shouldInitialize = false;
		console.info(
			'[INIT START] Triggering initializeElements() - places loaded, map ready, starting marker initialization'
		);
		initializeElements();
	}

	onMount(async () => {
		if (browser) {
			const theme = detectTheme();

			//import packages
			leaflet = await import('leaflet');
			const DomEvent = leaflet.DomEvent;
			/* eslint-disable @typescript-eslint/no-unused-vars */
			const maplibreGl = await import('maplibre-gl');
			const maplibreGlLeaflet = await import('@maplibre/maplibre-gl-leaflet');
			const leafletLocateControl = await import('leaflet.locatecontrol');
			const leafletMarkerCluster = await import('leaflet.markercluster');
			const leafletFeaturegroupSubgroup = await import('leaflet.featuregroup.subgroup');
			/* eslint-enable @typescript-eslint/no-unused-vars */

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
					const coords = location.hash.split('/');
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
			const baseMaps = layers(leaflet, map);

			// add events to cache last viewed location so it can be used on next map launch
			map.on('zoomend', () => {
				const coords = map.getBounds();

				mapCenter = map.getCenter();

				localforage.setItem('coords', coords).catch(function (err) {
					console.error(err);
				});
			});

			map.on('moveend', () => {
				const coords = map.getBounds();

				mapCenter = map.getCenter();

				if (!urlLat.length && !urlLong.length) {
					const zoom = map.getZoom();
					updateMapHash(zoom, mapCenter);
				}

				localforage.setItem('coords', coords).catch(function (err) {
					console.error(err);
				});
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
			geolocate(leaflet, map);

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

					searchBarDiv.append(customSearchBar);

					return searchBarDiv;
				}
			});

			// @ts-expect-error
			new leaflet.Control.Search().addTo(map);

			// disable map events for search controls
			if (customSearchBar) {
				DomEvent.disableClickPropagation(customSearchBar as HTMLElement);
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
			});

			mapLoading = 40;
			mapLoadingStatus = 'Map loaded';
			mapLoaded = true;
		}
	});

	onDestroy(async () => {
		if (map) {
			console.info('Unloading Leaflet map.');
			map.remove();
		}
		// Clean up web worker
		terminateWorker();
	});
</script>

<svelte:head>
	<title>BTC Map</title>
	<meta property="og:image" content="https://btcmap.org/images/og/map.png" />
	<meta property="twitter:title" content="BTC Map" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/map.png" />
</svelte:head>

<main>
	<h1 class="hidden">Map</h1>

	<MapLoadingMain progress={mapLoading} status={mapLoadingStatus} />

	<!-- Search UI - re-enabled with API-based search -->
	<div
		id="search-div"
		bind:this={customSearchBar}
		class="absolute top-0 left-[60px] w-[50vw] md:w-[350px] {showSearch ? 'block' : 'hidden'}"
	>
		<div class="relative">
			<input
				id="search-input"
				type="text"
				class="text-mapButton w-full rounded-lg px-5 py-2.5 text-[16px] drop-shadow-[0px_0px_4px_rgba(0,0,0,0.2)] focus:outline-hidden focus:drop-shadow-[0px_2px_6px_rgba(0,0,0,0.3)] dark:border dark:bg-dark dark:text-white"
				placeholder="Search..."
				on:keyup={searchDebounce}
				on:keydown={(e) => {
					searchStatus = true;
					if (e.key === 'Escape') {
						clearSearch();
					}
				}}
				bind:value={search}
				disabled={!mapLoaded}
			/>

			<button
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

		{#if search && search.length > 2}
			<OutClick
				excludeQuerySelectorAll="#search-button, #search-div, #search-input"
				on:outclick={clearSearch}
			>
				<div
					class="hide-scroll mt-0.5 max-h-[204px] w-full overflow-y-scroll rounded-lg bg-white drop-shadow-[0px_2px_6px_rgba(0,0,0,0.15)] dark:bg-dark"
				>
					{#each searchResults as result (result.id)}
						<button
							on:click={() => searchSelect(result)}
							class="hover:bg-searchHover block w-full justify-between px-4 py-2 md:flex md:text-left dark:border-b dark:hover:bg-white/[0.15]"
						>
							<div class="items-start md:flex md:space-x-2">
								<Icon
									w="20"
									h="20"
									style="mx-auto md:mx-0 mt-1 text-mapButton dark:text-white opacity-50"
									icon="currency_bitcoin"
									type="material"
								/>

								<div class="mx-auto md:max-w-[280px]">
									<p
										class="text-mapButton text-sm dark:text-white {result.name?.match('([^ ]{21})')
											? 'break-all'
											: ''}"
									>
										{result.name || 'Unknown'}
									</p>
									<p class="text-searchSubtext text-xs">
										{result.type === 'element' ? 'Bitcoin merchant' : result.type}
									</p>
								</div>
							</div>
						</button>
					{/each}

					{#if !searchStatus && searchResults.length === 0}
						<p class="text-searchSubtext w-full px-4 py-2 text-center text-sm">No results found.</p>
					{/if}
				</div>
			</OutClick>
		{/if}
	</div>

	{#if browser}
		<Boost />
	{/if}

	<ShowTags />
	<TaggingIssues />

	<div bind:this={mapElement} class="absolute h-[100%] w-full !bg-teal dark:!bg-dark" />
</main>

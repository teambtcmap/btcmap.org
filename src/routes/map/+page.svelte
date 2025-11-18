<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import Icon from '$components/Icon.svelte';
	import MapLoadingMain from '$components/MapLoadingMain.svelte';
	import MerchantDrawerHash from '$components/MerchantDrawerHash.svelte';
	import { updateMerchantHash } from '$lib/merchantDrawerHash';
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

	function openMerchantDrawer(id: number) {
		if (selectedMarkerId) {
			clearMarkerSelection(selectedMarkerId);
		}

		selectedMarkerId = id;
		highlightMarker(id);
		updateMerchantHash(id, 'details');
	}

	let leaflet: Leaflet;
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	let controlLayers: Control.Layers;

	let mapElement: HTMLDivElement;
	let map: Map;
	let mapLoaded = false;
	let elementsLoaded = false;
	let mapTilesLoaded = false;

	let markers: MarkerClusterGroup;
	let upToDateLayer: FeatureGroup.SubGroup;
	let loadedMarkers: Record<string, Marker> = {};
	let selectedMarkerId: number | null = null;

	let isLoadingMarkers = false;

	let mapCenter: LatLng;

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
			const response = await fetch(`/api/search/places?name=${encodeURIComponent(search)}`);

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

	const initializeElements = async () => {
		if (elementsLoaded) {
			return;
		}

		mapLoadingStatus = 'Initializing markers...';

		// create marker cluster group and layers
		/* eslint-disable no-undef */
		// @ts-expect-error - L is global from Leaflet
		markers = L.markerClusterGroup({ maxClusterRadius: 80, disableClusteringAtZoom: 17 });
		/* eslint-enable no-undef */
		upToDateLayer = leaflet.featureGroup.subGroup(markers);

		// Add layers to map immediately so batches can be added
		map.addLayer(markers);
		map.addLayer(upToDateLayer);

		// Set up consolidated map event listeners
		map.on('moveend', () => {
			const coords = map.getBounds();
			mapCenter = map.getCenter();

			// Update hash if not using URL parameters
			if (!urlLat.length && !urlLong.length) {
				const zoom = map.getZoom();
				updateMapHash(zoom, mapCenter);
			}

			// Debounced operations
			debouncedCacheCoords(coords);
			debouncedLoadMarkers();
		});

		map.on('zoomend', () => {
			const coords = map.getBounds();
			mapCenter = map.getCenter();

			// Debounced operations
			debouncedCacheCoords(coords);
			debouncedLoadMarkers();
		});

		mapLoadingStatus = 'Loading places in view...';

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
		}
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
				verify: true,
				onMarkerClick: (id) => openMerchantDrawer(Number(id))
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
							mapTilesLoaded = true;
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
			}

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
				mapLoaded = true;
			});

			// Watch for hash changes to clear marker selection when drawer closes
			window.addEventListener('hashchange', handleHashChange);
		}
	});

	onDestroy(async () => {
		// Cancel pending debounced operations to prevent memory leaks
		if (debouncedLoadMarkers?.cancel) debouncedLoadMarkers.cancel();
		if (debouncedCacheCoords?.cancel) debouncedCacheCoords.cancel();

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

	<MerchantDrawerHash />

	<div bind:this={mapElement} class="absolute h-[100%] w-full !bg-teal dark:!bg-dark" />
</main>

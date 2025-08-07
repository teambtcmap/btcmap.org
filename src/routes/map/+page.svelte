<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { Boost, Icon, MapLoadingMain, ShowTags, TaggingIssues } from '$lib/comp';
	import {
		attribution,
		calcVerifiedDate,
		changeDefaultIcons,
		checkAddress,
		dataRefresh,
		generateIcon,
		generateMarker,
		geolocate,
		homeMarkerButtons,
		latCalc,
		layers,
		longCalc,
		scaleBars,
		support,
		verifiedArr
	} from '$lib/map/setup';
	import { placesError, places, placesSyncCount, mapUpdates } from '$lib/store';
	import type {
		Leaflet,
		MapGroups,
		OSMTags,
		Place,
		SearchPlaceResult,
		SearchResponse
	} from '$lib/types';
	import { debounce, detectTheme, errToast } from '$lib/utils';
	import type { Control, LatLng, LatLngBounds, Map } from 'leaflet';
	import localforage from 'localforage';
	import { onDestroy, onMount, tick } from 'svelte';
	import OutClick from 'svelte-outclick';

	let mapLoading = 0;

	let leaflet: Leaflet;
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	let controlLayers: Control.Layers;

	let mapElement: HTMLDivElement;
	let map: Map;
	let mapLoaded = false;
	let elementsLoaded = false;

	let mapCenter: LatLng;

	// Search functionality re-enabled with API-based search
	let customSearchBar: HTMLDivElement;
	let clearSearchButton: HTMLButtonElement;
	let showSearch = false;
	let search: string;
	let searchStatus: boolean;
	let searchResults: SearchPlaceResult[] = [];

	// API-based search functions
	const apiSearch = async () => {
		if (search.length < 3) {
			searchResults = [];
			searchStatus = false;
			return;
		}

		searchStatus = true;

		try {
			const response = await fetch(`/api/search?query=${encodeURIComponent(search)}`);
			const data: SearchResponse = await response.json();

			if (!response.ok) {
				throw new Error('Search API error');
			}

			// Calculate distances and create SearchPlaceResult objects
			const resultsWithDistance: SearchPlaceResult[] = data.results.map((place) => {
				const latLng = leaflet.latLng(place.lat, place.lon);
				const distanceKm = Number((mapCenter.distanceTo(latLng) / 1000).toFixed(1));
				const distanceMi = Number((distanceKm * 0.6213712).toFixed(1));

				return {
					...place,
					distanceKm,
					distanceMi,
					latLng
				};
			});

			// Sort by distance and limit to 50 results
			searchResults = resultsWithDistance.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 50);
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

	const searchSelect = (result: SearchPlaceResult) => {
		clearSearch();
		if (result.latLng) {
			map.flyTo(result.latLng, 19);
			// Note: We'll need to find the marker for this place to open popup
			// This will be implemented when we add marker integration
		}
	};

	// allows for users to set initial view in a URL query
	const urlLat = $page.url.searchParams.getAll('lat');
	const urlLong = $page.url.searchParams.getAll('long');

	// alow for users to query by payment method with URL search params
	const onchain = $page.url.searchParams.has('onchain');
	const lightning = $page.url.searchParams.has('lightning');
	const nfc = $page.url.searchParams.has('nfc');

	// allow to view map with only legacy nodes
	const legacy = $page.url.searchParams.has('legacy');

	// allow to view map with only outdated nodes
	const outdated = $page.url.searchParams.has('outdated');

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

	const initializeElements = () => {
		if (elementsLoaded) return;

		// get date from 1 year ago to add verified check if survey is current
		let verifiedDate = calcVerifiedDate();

		// create marker cluster group and layers
		/* eslint-disable no-undef */
		// @ts-expect-error
		let markers = L.markerClusterGroup({ maxClusterRadius: 80, disableClusteringAtZoom: 17 });
		/* eslint-enable no-undef */
		let upToDateLayer = leaflet.featureGroup.subGroup(markers);

		// add location information
		$places.forEach((element: Place) => {
			const commentsCount = element.comments || 0;
			const icon = element.icon;
			const boosted = element.boosted_until
				? Date.parse(element.boosted_until) > Date.now()
				: false;

			let divIcon = generateIcon(leaflet, icon, boosted ? true : false, commentsCount);

			let marker = generateMarker({
				lat: element.lat,
				long: element.lon,
				icon: divIcon,
				placeId: element.id,
				leaflet,
				verify: true
			});

			upToDateLayer.addLayer(marker);
		});

		map.addLayer(markers);
		map.addLayer(upToDateLayer);
		mapLoading = 100;

		elementsLoaded = true;
	};

	$: $places && $places.length && mapLoaded && !elementsLoaded && initializeElements();

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

			// use url hash if present
			if (location.hash) {
				try {
					const coords = location.hash.split('/');
					map.setView([Number(coords[1]), Number(coords[2])], Number(coords[0].slice(1)));
					mapCenter = map.getCenter();
				} catch (error) {
					map.setView([0, 0], 3);
					mapCenter = map.getCenter();
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
						mapCenter = map.getCenter();
					} else {
						map.fitBounds([[Number(urlLat[0]), Number(urlLong[0])]]);
						mapCenter = map.getCenter();
					}
				} catch (error) {
					map.setView([0, 0], 3);
					mapCenter = map.getCenter();
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
								// @ts-expect-error
								[value._northEast.lat, value._northEast.lng],
								// @ts-expect-error
								[value._southWest.lat, value._southWest.lng]
							]);
						} else {
							map.setView([0, 0], 3);
						}
					})
					.catch(function (err) {
						map.setView([0, 0], 3);
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
					location.hash = zoom + '/' + mapCenter.lat.toFixed(5) + '/' + mapCenter.lng.toFixed(5);
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
					searchButton.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');

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
							// @ts-expect-error
							document.querySelector('#boost-layer').src = boosts
								? '/icons/boost-solid-black.svg'
								: '/icons/boost-black.svg';
						};
						boostLayerButton.onmouseleave = () => {
							// @ts-expect-error
							document.querySelector('#boost-layer').src = boosts
								? '/icons/boost-solid.svg'
								: '/icons/boost.svg';
						};
					}
					boostLayerButton.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');

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

			mapLoaded = true;
		}
	});

	onDestroy(async () => {
		if (map) {
			console.info('Unloading Leaflet map.');
			map.remove();
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

	<MapLoadingMain progress={mapLoading} />

	<!-- Search UI - re-enabled with API-based search -->
	<div
		id="search-div"
		bind:this={customSearchBar}
		class="absolute left-[60px] top-0 w-[50vw] md:w-[350px] {showSearch ? 'block' : 'hidden'}"
	>
		<div class="relative">
			<input
				id="search-input"
				type="text"
				class="w-full rounded-lg px-5 py-2.5 text-[16px] text-mapButton drop-shadow-[0px_0px_4px_rgba(0,0,0,0.2)] focus:outline-none focus:drop-shadow-[0px_2px_6px_rgba(0,0,0,0.3)] dark:border dark:bg-dark dark:text-white"
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
				class="absolute right-[8px] top-[10px] bg-white text-mapButton hover:text-black dark:bg-dark dark:text-white dark:hover:text-white/80 {search
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
							class="block w-full justify-between px-4 py-2 hover:bg-searchHover dark:border-b dark:hover:bg-white/[0.15] md:flex md:text-left"
						>
							<div class="items-start md:flex md:space-x-2">
								<Icon
									w="20"
									h="20"
									style="mx-auto md:mx-0 mt-1 {result.boosted
										? 'text-bitcoin animate-wiggle'
										: 'text-mapButton dark:text-white opacity-50'}"
									icon={result.icon !== 'question_mark' ? result.icon : 'currency_bitcoin'}
									type="material"
								/>

								<div class="mx-auto md:max-w-[210px]">
									<p
										class="text-sm {result.boosted
											? 'font-semibold text-bitcoin'
											: 'text-mapButton dark:text-white'} {result.name.match('([^ ]{21})')
											? 'break-all'
											: ''}"
									>
										{result.name}
									</p>
									<p
										class="text-xs {result.boosted
											? 'text-bitcoin'
											: 'text-searchSubtext'} {result.address && result.address.match('([^ ]{21})')
											? 'break-all'
											: ''}"
									>
										{result.address || 'No address available'}
									</p>
								</div>
							</div>

							<div
								class="text-xs {result.boosted
									? 'text-bitcoin'
									: 'text-searchSubtext'} mx-auto w-[80px] text-center md:mx-0 md:text-right"
							>
								<p>{result.distanceKm} km</p>
								<p>{result.distanceMi} mi</p>
							</div>
						</button>
					{/each}

					{#if !searchStatus && searchResults.length === 0}
						<p class="w-full px-4 py-2 text-center text-sm text-searchSubtext">No results found.</p>
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

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
	import { elementError, elements, elementsSyncCount, mapUpdates } from '$lib/store';
	import type { Leaflet, MapGroups, OSMTags, SearchElement, SearchResult } from '$lib/types';
	import { debounce, detectTheme, errToast } from '$lib/utils';
	import type { Control, LatLng, LatLngBounds, Map } from 'leaflet';
	import localforage from 'localforage';
	import { onDestroy, onMount, tick } from 'svelte';
	import OutClick from 'svelte-outclick';

	let mapLoading = 0;

	let leaflet: Leaflet;
	let controlLayers: Control.Layers;

	let mapElement: HTMLDivElement;
	let map: Map;
	let mapLoaded = false;
	let elementsLoaded = false;

	let mapCenter: LatLng;
	let elementsCopy: SearchElement[] = [];

	let customSearchBar: HTMLDivElement;
	let clearSearchButton: HTMLButtonElement;
	let showSearch = false;
	let search: string;
	let searchStatus: boolean;
	let searchResults: SearchResult[] = [];

	//search functions
	const elementSearch = () => {
		if (search.length < 3) {
			searchResults = [];
			searchStatus = false;
			return;
		}

		let filter = elementsCopy.filter((element) => {
			let tags = element.tags;

			if (tags && tags.name) {
				let splitWords = search.split(' ').filter((word) => word);

				let values = Object.values(tags);

				return values.some((value: OSMTags) =>
					splitWords.some((word) => value.toLowerCase().includes(word.toLowerCase()))
				);
			}
		});

		let distance: SearchResult[] = [];
		filter.forEach((element) => {
			const distanceKm = Number((mapCenter.distanceTo(element.latLng) / 1000).toFixed(1));
			const distanceMi = Number((distanceKm * 0.6213712).toFixed(1));
			distance.push({ ...element, distanceKm, distanceMi });
		});

		let sorted = distance.sort((a, b) => a.distanceKm - b.distanceKm);

		searchResults = sorted.slice(0, 50);

		searchStatus = false;
	};

	const searchDebounce = debounce(() => elementSearch());

	const clearSearch = () => {
		search = '';
		searchResults = [];
	};

	const searchSelect = (result: SearchResult) => {
		clearSearch();
		map.flyTo(result.latLng, 19);
		map.once('moveend', () => {
			result.marker.openPopup();
		});
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

	$: map && mapLoaded && $mapUpdates && $elementsSyncCount > 1 && showDataRefresh();

	// alert for map errors
	$: $elementError && errToast($elementError);

	const initializeElements = () => {
		if (elementsLoaded) return;

		// get date from 1 year ago to add verified check if survey is current
		let verifiedDate = calcVerifiedDate();

		// create marker cluster group and layers
		 
		// @ts-expect-error
<<<<<<< HEAD
		let markers = L.markerClusterGroup({ maxClusterRadius: 80, disableClusteringAtZoom: 17 });
		/* eslint-enable no-undef */
=======
		let markers = L.markerClusterGroup({ maxClusterRadius: 60 });
		 
>>>>>>> 596ae90 (chore: update eslint and related deps, update rules and some linting)
		let upToDateLayer = leaflet.featureGroup.subGroup(markers);
		let outdatedLayer = leaflet.featureGroup.subGroup(markers);
		let legacyLayer = leaflet.featureGroup.subGroup(markers);
		let thirdPartyLayer = leaflet.featureGroup.subGroup(markers);
		let categories: MapGroups = {};

		// add location information
		$elements.forEach((element) => {
			let category = element.tags.category;
			let icon = element.tags['icon:android'];
			let payment = element.tags['payment:uri']
				? { type: 'uri', url: element.tags['payment:uri'] }
				: element.tags['payment:pouch']
					? { type: 'pouch', username: element.tags['payment:pouch'] }
					: element.tags['payment:coinos']
						? { type: 'coinos', username: element.tags['payment:coinos'] }
						: undefined;
			let boosted =
				element.tags['boost:expires'] && Date.parse(element.tags['boost:expires']) > Date.now()
					? element.tags['boost:expires']
					: undefined;

			const elementOSM = element['osm_json'];

			let verified = verifiedArr(elementOSM);
			let upToDate = verified.length && Date.parse(verified[0]) > verifiedDate;

			if (
				(onchain ? elementOSM.tags && elementOSM.tags['payment:onchain'] === 'yes' : true) &&
				(lightning ? elementOSM.tags && elementOSM.tags['payment:lightning'] === 'yes' : true) &&
				(nfc
					? elementOSM.tags && elementOSM.tags['payment:lightning_contactless'] === 'yes'
					: true) &&
				(legacy ? elementOSM.tags && elementOSM.tags['payment:bitcoin'] === 'yes' : true) &&
				(outdated ? !upToDate : true) &&
				(boosts ? boosted : true)
			) {
				const lat = latCalc(elementOSM);
				const long = longCalc(elementOSM);

				let divIcon = generateIcon(leaflet, icon, boosted ? true : false);

				let marker = generateMarker(
					lat,
					long,
					divIcon,
					elementOSM,
					payment,
					leaflet,
					verifiedDate,
					true,
					boosted,
					element.tags.issues
				);

				if (upToDate) {
					upToDateLayer.addLayer(marker);
				} else {
					outdatedLayer.addLayer(marker);
				}

				if (elementOSM.tags && elementOSM.tags['payment:bitcoin']) {
					legacyLayer.addLayer(marker);
				}

				if (
					elementOSM.tags &&
					elementOSM.tags['payment:lightning:requires_companion_app'] === 'yes' &&
					elementOSM.tags['payment:lightning:companion_app_url'] &&
					!(
						elementOSM.tags['payment:onchain'] ||
						elementOSM.tags['payment:lightning'] ||
						elementOSM.tags['payment:lightning_contactless']
					)
				) {
					thirdPartyLayer.addLayer(marker);
				}

				if (!categories[category]) {
					categories[category] = leaflet.featureGroup.subGroup(markers);
				}

				categories[category].addLayer(marker);

				elementsCopy.push({
					...elementOSM,
					latLng: leaflet.latLng(lat, long),
					marker,
					icon,
					boosted
				});
			}
		});

		map.addLayer(markers);

		let overlayMaps: MapGroups = {
			...(!outdated ? { 'Up-To-Date': upToDateLayer } : {}),
			Outdated: outdatedLayer,
			Legacy: legacyLayer,
			'Third Party App': thirdPartyLayer
		};

		if (!outdated) {
			map.addLayer(upToDateLayer);
		}

		map.addLayer(outdatedLayer);
		map.addLayer(legacyLayer);
		map.addLayer(thirdPartyLayer);

		Object.keys(categories)
			.sort()
			.forEach((category) => {
				overlayMaps[
					category === 'atm'
						? category.toUpperCase()
						: category.charAt(0).toUpperCase() + category.slice(1)
				] = categories[category];
				map.addLayer(categories[category]);
			});

		Object.entries(overlayMaps).forEach((layer) => controlLayers.addOverlay(layer[1], layer[0]));

		map.removeLayer(categories['atm']);

		mapLoading = 100;

		elementsLoaded = true;
	};

	$: $elements && $elements.length && mapLoaded && !elementsLoaded && initializeElements();

	onMount(async () => {
		if (browser) {
			const theme = detectTheme();

			//import packages
			leaflet = await import('leaflet');
			// @ts-expect-error
			const DomEvent = await import('leaflet/src/dom/DomEvent');
<<<<<<< HEAD
			/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
			const maplibreGl = await import('maplibre-gl');
			const maplibreGlLeaflet = await import('@maplibre/maplibre-gl-leaflet');
=======
			/* eslint-disable @typescript-eslint/no-unused-vars */
>>>>>>> 596ae90 (chore: update eslint and related deps, update rules and some linting)
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
					console.log(error);
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
					console.log(error);
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
						console.log(err);
					});
			}

			// add tiles and basemaps
			const baseMaps = layers(leaflet, map);

			// add events to cache last viewed location so it can be used on next map launch
			map.on('zoomend', () => {
				const coords = map.getBounds();

				mapCenter = map.getCenter();

				localforage.setItem('coords', coords).catch(function (err) {
					console.log(err);
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
					console.log(err);
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

					// add search button to map
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
			DomEvent.disableClickPropagation(document.querySelector('.leaflet-control-boost-layer'));

			// add search bar to map
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
					searchBarDiv.classList.add('leafet-control', 'search-bar-div');

					searchBarDiv.append(customSearchBar);

					return searchBarDiv;
				}
			});

			// @ts-expect-error
			new leaflet.Control.Search().addTo(map);

			// disable map events
			DomEvent.disableScrollPropagation(customSearchBar);
			DomEvent.disableClickPropagation(customSearchBar);
			DomEvent.disableClickPropagation(document.querySelector('.leaflet-control-search-toggle'));
			DomEvent.disableClickPropagation(clearSearchButton);

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
			console.log('Unloading Leaflet map.');
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
				disabled={!elementsLoaded}
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
					{#each searchResults as result}
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
											: 'text-mapButton dark:text-white'} {result.tags?.name.match('([^ ]{21})')
											? 'break-all'
											: ''}"
									>
										{result.tags?.name}
									</p>
									<p
										class="text-xs {result.boosted ? 'text-bitcoin' : 'text-searchSubtext'} {(result
											.tags?.['addr:street'] &&
											result.tags['addr:street'].match('([^ ]{21})')) ||
										(result.tags?.['addr:city'] && result.tags['addr:city'].match('([^ ]{21})'))
											? 'break-all'
											: ''}"
									>
										{result.tags ? checkAddress(result.tags) : ''}
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

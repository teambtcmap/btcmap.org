<script>
	import localforage from 'localforage';
	import OutClick from 'svelte-outclick';
	import { tick } from 'svelte';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { elements, mapUpdates, elementError } from '$lib/store';
	import {
		attribution,
		support,
		scaleBars,
		changeDefaultIcons,
		fullscreenButton,
		geolocate,
		homeMarkerButtons,
		dataRefresh,
		calcVerifiedDate,
		checkAddress,
		latCalc,
		longCalc,
		generateIcon,
		generateMarker
	} from '$lib/map/setup';
	import { errToast } from '$lib/utils';
	import { MapLoading, Icon } from '$comp';

	let mapElement;
	let map;
	let mapLoaded;

	let mapCenter;
	let elementsCopy = [];

	let customSearchBar;
	let clearSearchButton;
	let showSearch;
	let search;
	let searchStatus;
	let searchResults = [];

	//search functions
	function debounce(func, timeout = 500) {
		let timer;
		return (...args) => {
			clearTimeout(timer);
			timer = setTimeout(() => {
				func.apply(this, args);
			}, timeout);
		};
	}

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

				return values.some((value) =>
					splitWords.some((word) => value.toLowerCase().includes(word.toLowerCase()))
				);
			}
		});

		let distance = [];
		filter.forEach((element) => {
			element.distanceKm = (mapCenter.distanceTo(element.latLng) / 1000).toFixed(1);
			element.distanceMi = (element.distanceKm * 0.6213712).toFixed(1);
			distance.push(element);
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

	const searchSelect = (result) => {
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

	// displays a button in controls if there is new data available
	const showDataRefresh = () => {
		document.querySelector('.data-refresh-div').style.display = 'block';
	};

	$: map && mapLoaded && $mapUpdates && showDataRefresh();

	// alert for map errors
	$: $elementError && errToast($elementError);

	onMount(async () => {
		if (browser) {
			//import packages
			const leaflet = await import('leaflet');
			const DomEvent = await import('leaflet/src/dom/DomEvent');
			const leafletLocateControl = await import('leaflet.locatecontrol');
			const leafletMarkerCluster = await import('leaflet.markercluster');
			const leafletFeaturegroupSubgroup = await import('leaflet.featuregroup.subgroup');

			// add map and tiles
			map = leaflet.map(mapElement);

			// set URL lat/long query view if it exists and is valid
			if (urlLat.length && urlLong.length) {
				try {
					if (urlLat.length > 1 && urlLong.length > 1) {
						map.fitBounds([
							[urlLat[0], urlLong[0]],
							[urlLat[1], urlLong[1]]
						]);
						mapCenter = map.getCenter();
					} else {
						map.fitBounds([[urlLat[0], urlLong[0]]]);
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
					.getItem('coords')
					.then(function (value) {
						if (value) {
							map.fitBounds([
								[value._northEast.lat, value._northEast.lng],
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
			const osm = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				noWrap: true,
				maxZoom: 19
			});

			const osmDE = leaflet.tileLayer('https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png', {
				noWrap: true,
				maxZoom: 18
			});

			const osmFR = leaflet.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
				noWrap: true,
				maxZoom: 20
			});
			const topo = leaflet.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
				noWrap: true,
				maxZoom: 17
			});

			const imagery = leaflet.tileLayer(
				'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
				{
					noWrap: true
				}
			);

			const toner = leaflet.tileLayer(
				'https://stamen-tiles-{s}.a.ssl.fastly.net/toner/{z}/{x}/{y}{r}.{ext}',
				{
					noWrap: true,
					maxZoom: 20,
					ext: 'png'
				}
			);

			const tonerLite = leaflet.tileLayer(
				'https://stamen-tiles-{s}.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}{r}.{ext}',
				{
					noWrap: true,
					maxZoom: 20,
					ext: 'png'
				}
			);

			const watercolor = leaflet.tileLayer(
				'https://stamen-tiles-{s}.a.ssl.fastly.net/watercolor/{z}/{x}/{y}.{ext}',
				{
					noWrap: true,
					maxZoom: 16,
					ext: 'jpg'
				}
			);

			const terrain = leaflet.tileLayer(
				'https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}{r}.{ext}',
				{
					noWrap: true,
					maxZoom: 18,
					ext: 'png'
				}
			);

			const baseMaps = {
				OpenStreetMap: osm,
				Imagery: imagery,
				Terrain: terrain,
				Topo: topo,
				Toner: toner,
				'Toner Lite': tonerLite,
				Watercolor: watercolor,
				OpenStreetMapDE: osmDE,
				OpenStreetMapFR: osmFR
			};

			// create marker cluster group and layers
			let markers = L.markerClusterGroup({ maxClusterRadius: 80 });

			let merchants = L.featureGroup.subGroup(markers);
			let ATMs = L.featureGroup.subGroup(markers);

			const overlayMaps = {
				Merchants: merchants,
				ATMs: ATMs
			};

			const layerControl = L.control.layers(baseMaps, overlayMaps).addTo(map);

			osm.addTo(map);

			// add click event to help devs find lat/long of desired location for iframe embeds
			map.on('click', () => {
				const coords = map.getBounds();
				console.log(`Here is your iframe embed URL: https://btcmap.org/map?lat=${coords._northEast.lat}&long=${coords._northEast.lng}&lat=${coords._southWest.lat}&long=${coords._southWest.lng}
Thanks for using BTC Map!`);
			});

			// add events to cache last viewed location so it can be used on next map launch
			map.on('zoomend', () => {
				const coords = map.getBounds();

				mapCenter = map.getCenter();

				localforage
					.setItem('coords', coords)
					.then(function (value) {})
					.catch(function (err) {
						console.log(err);
					});
			});

			map.on('moveend', () => {
				const coords = map.getBounds();

				mapCenter = map.getCenter();

				localforage
					.setItem('coords', coords)
					.then(function (value) {})
					.catch(function (err) {
						console.log(err);
					});
			});

			// change broken marker image path in prod
			L.Icon.Default.prototype.options.imagePath = '/icons/';

			// add support attribution
			support();

			// add OSM attribution
			attribution(L, map);

			// add scale
			scaleBars(L, map);

			// change default icons
			changeDefaultIcons('layers');

			// add fullscreen button to map
			fullscreenButton(L, mapElement, map, DomEvent);

			// add locate button to map
			geolocate(L, map);

			// add search button to map
			const customSearchButton = L.Control.extend({
				options: {
					position: 'topleft'
				},
				onAdd: () => {
					const searchButtonDiv = L.DomUtil.create('div');
					searchButtonDiv.classList.add('leaflet-bar');
					searchButtonDiv.style.border = 'none';
					searchButtonDiv.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';

					const searchButton = L.DomUtil.create('a');
					searchButton.classList.add('leaflet-control-search-toggle');
					searchButton.href = '#';
					searchButton.title = 'Search toggle';
					searchButton.role = 'button';
					searchButton.ariaLabel = 'Search toggle';
					searchButton.ariaDisabled = 'false';
					searchButton.innerHTML = `<img src='/icons/search.svg' alt='search' class='inline' id='search-button'/>`;
					searchButton.style.borderRadius = '8px';
					searchButton.onclick = async function toggleSearch() {
						showSearch = !showSearch;
						if (showSearch) {
							await tick();
							document.querySelector('#search-input').focus();
						} else {
							search = '';
							searchResults = [];
						}
					};
					searchButton.onmouseenter = () => {
						document.querySelector('#search-button').src = '/icons/search-black.svg';
					};
					searchButton.onmouseleave = () => {
						document.querySelector('#search-button').src = '/icons/search.svg';
					};

					searchButtonDiv.append(searchButton);

					return searchButtonDiv;
				}
			});

			map.addControl(new customSearchButton());

			// add search bar to map
			map._controlCorners['topcenter'] = L.DomUtil.create(
				'div',
				'leaflet-top leaflet-center',
				map._controlContainer
			);

			L.Control.Search = L.Control.extend({
				options: {
					position: 'topcenter'
				},
				onAdd: () => {
					const searchBarDiv = L.DomUtil.create('div');
					searchBarDiv.classList.add('leafet-control', 'search-bar-div');

					searchBarDiv.append(customSearchBar);

					return searchBarDiv;
				}
			});

			new L.Control.Search().addTo(map);

			// disable map events
			DomEvent.disableScrollPropagation(customSearchBar);
			DomEvent.disableClickPropagation(customSearchBar);
			DomEvent.disableClickPropagation(document.querySelector('.leaflet-control-search-toggle'));
			DomEvent.disableClickPropagation(clearSearchButton);

			// add home and marker buttons to map
			homeMarkerButtons(L, map, DomEvent);

			// add data refresh button to map
			dataRefresh(L, map, DomEvent);

			// get date from 1 year ago to add verified check if survey is current
			let verifiedDate = calcVerifiedDate();

			// add location information
			$elements.forEach((element) => {
				if (element['deleted_at']) {
					return;
				}

				let category = element.tags.category;
				let icon = element.tags['icon:android'];
				element = element['osm_json'];

				if (
					(onchain ? element.tags && element.tags['payment:onchain'] === 'yes' : true) &&
					(lightning ? element.tags && element.tags['payment:lightning'] === 'yes' : true) &&
					(nfc ? element.tags && element.tags['payment:lightning_contactless'] === 'yes' : true)
				) {
					const lat = latCalc(element);
					const long = longCalc(element);

					let divIcon = generateIcon(L, icon);

					let marker = generateMarker(lat, long, divIcon, element, L, verifiedDate, 'verify');

					if (category === 'atm') {
						ATMs.addLayer(marker);
					} else {
						merchants.addLayer(marker);
					}

					element.latLng = L.latLng(lat, long);
					element.marker = marker;
					element.icon = icon;
					elementsCopy.push(element);
				}
			});

			map.addLayer(markers);
			map.addLayer(merchants);
			map.addLayer(ATMs);

			// final map setup
			map.on('load', () => {
				mapCenter = map.getCenter();
			});

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

<main>
	{#if !mapLoaded}
		<MapLoading type="main" message="Rendering map..." style="absolute top-0 left-0 z-[10000]" />
	{/if}

	<div
		id="search-div"
		bind:this={customSearchBar}
		class="w-[50vw] md:w-[350px] absolute top-0 left-[60px] {showSearch ? 'block' : 'hidden'}"
	>
		<div class="relative">
			<input
				id="search-input"
				type="text"
				class="w-full drop-shadow-[0px_0px_4px_rgba(0,0,0,0.2)] focus:drop-shadow-[0px_2px_6px_rgba(0,0,0,0.3)] rounded-lg p-2.5 focus:outline-none text-mapButton text-[16px]"
				placeholder="Search..."
				on:keyup={searchDebounce}
				on:keydown={(e) => {
					searchStatus = true;
					if (e.key === 'Escape') {
						clearSearch();
					}
				}}
				bind:value={search}
			/>

			<button
				bind:this={clearSearchButton}
				on:click={clearSearch}
				class="text-mapButton hover:text-black absolute top-[10px] right-[8px] bg-white {search
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
				excludeByQuerySelector={['#search-button', '#search-div']}
				on:outclick={clearSearch}
			>
				<div
					class="w-full drop-shadow-[0px_2px_6px_rgba(0,0,0,0.15)] bg-white rounded-lg mt-0.5 max-h-[204px] overflow-y-scroll hide-scroll"
				>
					{#each searchResults as result}
						<button
							on:click={() => searchSelect(result)}
							class="block hover:bg-searchHover w-full md:text-left md:flex justify-between px-4 py-2"
						>
							<div class="md:flex items-start md:space-x-2">
								<Icon
									width="20"
									height="20"
									style="mx-auto md:mx-0 mt-1 opacity-50 text-mapButton"
									icon={result.icon !== 'question_mark' ? result.icon : 'currency_bitcoin'}
									type="material"
								/>

								<div class="md:max-w-[200px] mx-auto">
									<p
										class="text-sm text-mapButton {result.tags.name.match('([^ ]{21})')
											? 'break-all'
											: ''}"
									>
										{result.tags.name}
									</p>
									<p
										class="text-xs text-searchSubtext {(result.tags['addr:street'] &&
											result.tags['addr:street'].match('([^ ]{21})')) ||
										(result.tags['addr:city'] && result.tags['addr:city'].match('([^ ]{21})'))
											? 'break-all'
											: ''}"
									>
										{checkAddress(result.tags)}
									</p>
								</div>
							</div>

							<div
								class="text-xs text-searchSubtext text-center md:text-right w-[80px] mx-auto md:mx-0"
							>
								<p>{result.distanceKm} km</p>
								<p>{result.distanceMi} mi</p>
							</div>
						</button>
					{/each}

					{#if !searchStatus && searchResults.length === 0}
						<p class="text-sm text-searchSubtext text-center w-full px-4 py-2">No results found.</p>
					{/if}
				</div>
			</OutClick>
		{/if}
	</div>

	<div bind:this={mapElement} class="!bg-teal h-[100vh]" />
</main>

<style>
	@import 'leaflet/dist/leaflet.css';
	@import 'leaflet.locatecontrol/dist/L.Control.Locate.min.css';
	@import 'leaflet.markercluster/dist/MarkerCluster.css';
	@import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
</style>

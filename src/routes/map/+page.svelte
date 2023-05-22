<script>
	import localforage from 'localforage';
	import OutClick from 'svelte-outclick';
	import rewind from '@mapbox/geojson-rewind';
	import { geoArea } from 'd3-geo';
	import { tick } from 'svelte';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import {
		elements,
		mapUpdates,
		elementError,
		elementsSyncCount,
		areas,
		areaError,
		reports,
		reportError
	} from '$lib/store';
	import {
		layers,
		attribution,
		support,
		scaleBars,
		changeDefaultIcons,
		geolocate,
		homeMarkerButtons,
		dataRefresh,
		calcVerifiedDate,
		checkAddress,
		latCalc,
		longCalc,
		generateIcon,
		generateMarker,
		verifiedArr
	} from '$lib/map/setup';
	import { errToast, detectTheme } from '$lib/utils';
	import { MapLoading, Icon, Boost, ShowTags, Socials } from '$comp';

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

	// allow to view map with only legacy nodes
	const legacy = $page.url.searchParams.has('legacy');

	// allow to view map with only boosted locations
	const boosts = $page.url.searchParams.has('boosts');

	// allow to view map centered on a community
	const community = $page.url.searchParams.get('community');
	const communitySelected = $areas.find((area) => area.id === community);

	// allow to view map with communities only
	const communitiesOnly = $page.url.searchParams.has('communitiesOnly');

	// allow to view map with only certain language communities
	const language = $page.url.searchParams.get('language');

	// allow to view map with only certain org communities
	const organization = $page.url.searchParams.get('organization');

	// filter communities
	let communities = $areas.filter(
		(area) =>
			area.tags.type === 'community' &&
			area.tags.geo_json &&
			area.tags.name &&
			area.tags['icon:square'] &&
			area.tags.continent &&
			Object.keys(area.tags).find((key) => key.includes('contact')) &&
			$reports.find((report) => report.area_id === area.id) &&
			(language ? area.tags.language === language : true) &&
			(organization ? area.tags.organization === organization : true)
	);

	// sort communities by largest to smallest
	communities.forEach((community) => {
		rewind(community.tags.geo_json, true);
		community.area = geoArea(community.tags.geo_json);
	});

	communities.sort((a, b) => b.area - a.area);

	// displays a button in controls if there is new data available
	const showDataRefresh = () => {
		document.querySelector('.data-refresh-div').style.display = 'block';
	};

	$: map && mapLoaded && $mapUpdates && $elementsSyncCount > 1 && showDataRefresh();

	// alert for map errors
	$: $elementError && errToast($elementError);

	// alert for area errors
	$: $areaError && errToast($areaError);

	// alert for report errors
	$: $reportError && errToast($reportError);

	onMount(async () => {
		if (browser) {
			const theme = detectTheme();

			//import packages
			const leaflet = await import('leaflet');
			const DomEvent = await import('leaflet/src/dom/DomEvent');
			/* eslint-disable no-unused-vars */
			const leafletLocateControl = await import('leaflet.locatecontrol');
			const leafletMarkerCluster = await import('leaflet.markercluster');
			const leafletFeaturegroupSubgroup = await import('leaflet.featuregroup.subgroup');
			/* eslint-enable no-unused-vars */

			// add map and tiles
			map = leaflet.map(mapElement);

			// use url hash if present
			if (location.hash) {
				try {
					const coords = location.hash.split('/');
					map.setView([coords[1], coords[2]], coords[0].slice(1));
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

			// set view to community if in url params
			else if (community && communitySelected) {
				try {
					// eslint-disable-next-line no-undef
					map.fitBounds(L.geoJSON(communitySelected.tags.geo_json).getBounds());
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

			// set view to communities if in url params
			else if (communitiesOnly && communities.length) {
				try {
					map.fitBounds(
						// eslint-disable-next-line no-undef
						communities.map((community) => L.geoJSON(community.tags.geo_json).getBounds())
					);
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
			const baseMaps = layers(leaflet, map);

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
					// eslint-disable-next-line no-unused-vars
					.then(function (value) {})
					.catch(function (err) {
						console.log(err);
					});
			});

			map.on('moveend', () => {
				const coords = map.getBounds();

				mapCenter = map.getCenter();

				if (!community && !communitiesOnly && !urlLat.length && !urlLong.length) {
					const zoom = map.getZoom();
					location.hash = zoom + '/' + mapCenter.lat.toFixed(5) + '/' + mapCenter.lng.toFixed(5);
				}

				localforage
					.setItem('coords', coords)
					// eslint-disable-next-line no-unused-vars
					.then(function (value) {})
					.catch(function (err) {
						console.log(err);
					});
			});

			// change broken marker image path in prod
			// eslint-disable-next-line no-undef
			L.Icon.Default.prototype.options.imagePath = '/icons/';

			// add support attribution
			support();

			// add OSM attribution
			// eslint-disable-next-line no-undef
			attribution(L, map);

			// add scale
			// eslint-disable-next-line no-undef
			scaleBars(L, map);

			// add locate button to map
			// eslint-disable-next-line no-undef
			geolocate(L, map);

			// add search button to map
			// eslint-disable-next-line no-undef
			const customSearchButton = L.Control.extend({
				options: {
					position: 'topleft'
				},
				onAdd: () => {
					// eslint-disable-next-line no-undef
					const searchButtonDiv = L.DomUtil.create('div');
					searchButtonDiv.classList.add('leaflet-bar');
					searchButtonDiv.style.border = 'none';
					searchButtonDiv.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';

					// eslint-disable-next-line no-undef
					const searchButton = L.DomUtil.create('a');
					searchButton.classList.add('leaflet-control-search-toggle');
					searchButton.title = 'Search toggle';
					searchButton.role = 'button';
					searchButton.ariaLabel = 'Search toggle';
					searchButton.ariaDisabled = 'false';
					searchButton.innerHTML = `<img src=${
						theme === 'dark' ? '/icons/search-white.svg' : '/icons/search.svg'
					} alt='search' class='inline' id='search-button'/>`;
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
					if (theme === 'light') {
						searchButton.onmouseenter = () => {
							document.querySelector('#search-button').src = '/icons/search-black.svg';
						};
						searchButton.onmouseleave = () => {
							document.querySelector('#search-button').src = '/icons/search.svg';
						};
					}
					searchButton.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');

					searchButtonDiv.append(searchButton);

					return searchButtonDiv;
				}
			});

			map.addControl(new customSearchButton());

			// add search bar to map
			// eslint-disable-next-line no-undef
			map._controlCorners['topcenter'] = L.DomUtil.create(
				'div',
				'leaflet-top leaflet-center',
				map._controlContainer
			);

			// eslint-disable-next-line no-undef
			L.Control.Search = L.Control.extend({
				options: {
					position: 'topcenter'
				},
				onAdd: () => {
					// eslint-disable-next-line no-undef
					const searchBarDiv = L.DomUtil.create('div');
					searchBarDiv.classList.add('leafet-control', 'search-bar-div');

					searchBarDiv.append(customSearchBar);

					return searchBarDiv;
				}
			});

			// eslint-disable-next-line no-undef
			new L.Control.Search().addTo(map);

			// disable map events
			DomEvent.disableScrollPropagation(customSearchBar);
			DomEvent.disableClickPropagation(customSearchBar);
			DomEvent.disableClickPropagation(document.querySelector('.leaflet-control-search-toggle'));
			DomEvent.disableClickPropagation(clearSearchButton);

			// add boost layer button

			// eslint-disable-next-line no-undef
			const customBoostLayerButton = L.Control.extend({
				options: {
					position: 'topleft'
				},
				onAdd: () => {
					// eslint-disable-next-line no-undef
					const boostLayerDiv = L.DomUtil.create('div');
					boostLayerDiv.classList.add('leaflet-bar');
					boostLayerDiv.style.border = 'none';
					boostLayerDiv.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';

					// eslint-disable-next-line no-undef
					const boostLayerButton = L.DomUtil.create('a');
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
					boostLayerButton.style.borderRadius = '8px';
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
							document.querySelector('#boost-layer').src = boosts
								? '/icons/boost-solid-black.svg'
								: '/icons/boost-black.svg';
						};
						boostLayerButton.onmouseleave = () => {
							document.querySelector('#boost-layer').src = boosts
								? '/icons/boost-solid.svg'
								: '/icons/boost.svg';
						};
					}
					boostLayerButton.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');

					boostLayerDiv.append(boostLayerButton);

					return boostLayerDiv;
				}
			});

			map.addControl(new customBoostLayerButton());
			DomEvent.disableClickPropagation(document.querySelector('.leaflet-control-boost-layer'));

			// add home and marker buttons to map
			// eslint-disable-next-line no-undef
			homeMarkerButtons(L, map, DomEvent);

			// add data refresh button to map
			// eslint-disable-next-line no-undef
			dataRefresh(L, map, DomEvent);

			// get date from 1 year ago to add verified check if survey is current
			let verifiedDate = calcVerifiedDate();

			// create marker cluster group and layers
			/* eslint-disable no-undef */
			let communitiesLayer = L.layerGroup();
			let markers = L.markerClusterGroup({ maxClusterRadius: 60 });
			let upToDateLayer = L.featureGroup.subGroup(markers);
			let outdatedLayer = L.featureGroup.subGroup(markers);
			let legacyLayer = L.featureGroup.subGroup(markers);
			/* eslint-enable no-undef */
			let categories = {};

			// add communities to map
			communities.forEach((community) => {
				const popupContainer = L.DomUtil.create('div');

				popupContainer.innerHTML = `
				<div class='text-center space-y-2'>
					<img src=${
						community.tags['icon:square']
					} alt='avatar' class='w-24 h-24 rounded-full mx-auto' title='Community icon' decoding="sync" fetchpriority="high" onerror="this.src='/images/communities/bitcoin.svg'" />

					<span class='text-primary dark:text-white font-semibold text-xl' title='Community name'>${
						community.tags.name
					}</span>

					${
						community.tags.organization
							? `<span
						class="mx-auto whitespace-nowrap w-fit block rounded-full bg-[#10B981] px-3.5 py-1 text-xs font-semibold uppercase text-white" title='Organization'
					>
					${community.tags.organization}
					</span>`
							: ''
					}

					${
						community.tags.sponsor
							? `<span class="block gradient-bg w-32 mx-auto py-1 text-xs text-white font-semibold rounded-full" title='Supporter'>
						BTC Map Sponsor
					</span>`
							: ''
					}

					<div id='socials'>
					</div>

					<a href='/community/${
						community.id
					}' class='block bg-link hover:bg-hover !text-white text-center font-semibold py-3 rounded-xl transition-colors' title='Community page'>View Community</a>
				</div>

				${
					theme === 'dark'
						? `
							<style>
								.leaflet-popup-content-wrapper, .leaflet-popup-tip {
									background-color: #06171C;
									border: 1px solid #e5e7eb
							}

								.leaflet-popup-close-button {
									font-size: 24px !important;
									top: 4px !important;
									right: 4px !important;
							}
							</style>`
						: ''
				}`;

				const socials = popupContainer.querySelector('#socials');
				new Socials({
					target: socials,
					props: {
						website: community.tags['contact:website'],
						email: community.tags['contact:email'],
						nostr: community.tags['contact:nostr'],
						twitter: community.tags['contact:twitter'],
						secondTwitter: community.tags['contact:secondTwitter'],
						meetup: community.tags['contact:meetup'],
						eventbrite: community.tags['contact:eventbrite'],
						telegram: community.tags['contact:telegram'],
						discord: community.tags['contact:discord'],
						youtube: community.tags['contact:youtube'],
						github: community.tags['contact:github'],
						reddit: community.tags['contact:reddit'],
						instagram: community.tags['contact:instagram'],
						whatsapp: community.tags['contact:whatsapp'],
						facebook: community.tags['contact:facebook'],
						linkedin: community.tags['contact:linkedin'],
						rss: community.tags['contact:rss'],
						signal: community.tags['contact:signal']
					}
				});

				// eslint-disable-next-line no-undef
				let communityLayer = L.geoJSON(community.tags.geo_json, {
					style: { color: '#000000', fillColor: '#F7931A', fillOpacity: 0.5 }
				}).bindPopup(popupContainer, { minWidth: 300 });

				communityLayer.on('click', () => communityLayer.bringToBack());

				communityLayer.addTo(communitiesLayer);
			});

			if ((community && communitySelected) || communitiesOnly) {
				communitiesLayer.addTo(map);
			}

			// add location information
			$elements.forEach((element) => {
				if (element['deleted_at']) {
					return;
				}

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
				element = element['osm_json'];

				if (
					(onchain ? element.tags && element.tags['payment:onchain'] === 'yes' : true) &&
					(lightning ? element.tags && element.tags['payment:lightning'] === 'yes' : true) &&
					(nfc ? element.tags && element.tags['payment:lightning_contactless'] === 'yes' : true) &&
					(legacy ? element.tags && element.tags['payment:bitcoin'] === 'yes' : true) &&
					(boosts ? boosted : true)
				) {
					const lat = latCalc(element);
					const long = longCalc(element);

					// eslint-disable-next-line no-undef
					let divIcon = generateIcon(L, icon, boosted);

					let marker = generateMarker(
						lat,
						long,
						divIcon,
						element,
						payment,
						// eslint-disable-next-line no-undef
						L,
						verifiedDate,
						'verify',
						boosted
					);

					let verified = verifiedArr(element);

					if (verified.length && Date.parse(verified[0]) > verifiedDate) {
						upToDateLayer.addLayer(marker);
					} else {
						outdatedLayer.addLayer(marker);
					}

					if (element.tags && element.tags['payment:bitcoin']) {
						legacyLayer.addLayer(marker);
					}

					if (!categories[category]) {
						// eslint-disable-next-line no-undef
						categories[category] = L.featureGroup.subGroup(markers);
					}

					categories[category].addLayer(marker);

					// eslint-disable-next-line no-undef
					element.latLng = L.latLng(lat, long);
					element.marker = marker;
					element.icon = icon;
					element.boosted = boosted;
					elementsCopy.push(element);
				}
			});

			map.addLayer(markers);

			let overlayMaps = {
				Communities: communitiesLayer,
				'Up-To-Date': upToDateLayer,
				Outdated: outdatedLayer,
				Legacy: legacyLayer
			};

			Object.keys(categories)
				.sort()
				.map((category) => {
					overlayMaps[
						category === 'atm'
							? category.toUpperCase()
							: category.charAt(0).toUpperCase() + category.slice(1)
					] = categories[category];
					if (!communitiesOnly) {
						map.addLayer(upToDateLayer);
						map.addLayer(outdatedLayer);
						map.addLayer(legacyLayer);
						map.addLayer(categories[category]);
					}
				});

			// eslint-disable-next-line no-unused-vars, no-undef
			const layerControl = L.control.layers(baseMaps, overlayMaps).addTo(map);

			// treasure hunt event
			if (Date.now() < new Date('April 30, 2023 00:00:00')) {
				// eslint-disable-next-line no-undef
				const treasureIcon = L.divIcon({
					className: 'treasure-icon',
					iconSize: [24, 24],
					html: `<a href='https://dublinbitcoiners.com/treasure-hunt' target='_blank' rel='noreferrer'>
							<span class="relative flex h-6 w-6">
								<span
									class="animate-ping absolute inline-flex h-full w-full rounded-full bg-bitcoin opacity-75"
								/>
								<span
									class="relative inline-flex h-6 w-6 rounded-full bg-bitcoin"
								/>
							</span>
						  </a>`
				});

				// eslint-disable-next-line no-undef
				L.marker([53.37225, -6.17711], { icon: treasureIcon })
					.bindTooltip(
						`<p class='text-primary dark:text-white text-lg text-center p-2'>
							<i class="fa-solid fa-coins text-bitcoin"></i> <strong>Bitcoin Treasure Hunt</strong> <i class="fa-solid fa-coins text-bitcoin"></i>
							<br/>
							April 29th, 2023 @ 1PM
							<br/>
							Hosted by <strong>Dublin Bitcoiners</strong>
							<br/>
							dublinbitcoiners.com/treasure-hunt
							<br/>
							Everyone welcome!
						</p>
	
						${
							theme === 'dark'
								? `
								<style>
								.leaflet-tooltip {
										background-color: #06171C;
										border: 1px solid #e5e7eb
								}

								.leaflet-tooltip-left::before {
								
										border-left-color: #e5e7eb
								}

								.leaflet-tooltip-right::before {
									
										border-right-color: #e5e7eb
								}
								</style>`
								: ''
						}`,
						{ sticky: true }
					)
					.addTo(map);
			}

			// change default icons
			// eslint-disable-next-line no-undef
			changeDefaultIcons('layers', L, mapElement, DomEvent);

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
				excludeQuerySelectorAll={['#search-button', '#search-div', '#search-input']}
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
											: 'text-mapButton dark:text-white'} {result.tags.name.match('([^ ]{21})')
											? 'break-all'
											: ''}"
									>
										{result.tags.name}
									</p>
									<p
										class="text-xs {result.boosted ? 'text-bitcoin' : 'text-searchSubtext'} {(result
											.tags['addr:street'] &&
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

	<Boost />
	<ShowTags />

	<div bind:this={mapElement} class="absolute h-[100%] w-full !bg-teal dark:!bg-dark" />
</main>

<style>
	@import 'leaflet/dist/leaflet.css';
	@import 'leaflet.locatecontrol/dist/L.Control.Locate.min.css';
	@import 'leaflet.markercluster/dist/MarkerCluster.css';
	@import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
</style>

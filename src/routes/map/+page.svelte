<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { Boost, Icon, MapLoading, ShowTags, Socials } from '$lib/comp';
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
	import {
		areaError,
		areas,
		elementError,
		elements,
		elementsSyncCount,
		mapUpdates,
		reportError,
		reports
	} from '$lib/store';
	import type { MapGroups, OSMTags, SearchElement, SearchResult } from '$lib/types';
	import { detectTheme, errToast } from '$lib/utils';
	// @ts-expect-error
	import rewind from '@mapbox/geojson-rewind';
	import axios from 'axios';
	import { geoArea } from 'd3-geo';
	import type { LatLng, LatLngBounds, Map } from 'leaflet';
	import localforage from 'localforage';
	import { onDestroy, onMount, tick } from 'svelte';
	import OutClick from 'svelte-outclick';

	let mapElement: HTMLDivElement;
	let map: Map;
	let mapLoaded = false;

	let mapCenter: LatLng;
	let elementsCopy: SearchElement[] = [];

	let customSearchBar: HTMLDivElement;
	let clearSearchButton: HTMLButtonElement;
	let showSearch = false;
	let search: string;
	let searchStatus: boolean;
	let searchResults: SearchResult[] = [];

	//search functions
	function debounce(func: () => void, timeout = 500) {
		let timer: ReturnType<typeof setTimeout>;
		// @ts-expect-error
		return (...args) => {
			clearTimeout(timer);
			timer = setTimeout(() => {
				// @ts-expect-error
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

	// allow to view map with only boosted locations
	const boosts = $page.url.searchParams.has('boosts');

	// allow to view map for hike event
	const hikeEvent = $page.url.searchParams.has('mount-kili-hike');

	// allow to view map centered on a community
	const communityQuery = $page.url.searchParams.get('community');
	const communitySelected = $areas.find((area) => area.id === communityQuery);

	// allow to view map with communities only
	const communitiesOnly = $page.url.searchParams.has('communitiesOnly');

	// allow to view map with only certain language communities
	const language = $page.url.searchParams.get('language');

	// allow to view map with only certain org communities
	const organization = $page.url.searchParams.get('organization');

	// filter communities
	let communitiesFiltered = $areas.filter(
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
	let communities = communitiesFiltered.map((community) => {
		rewind(community.tags.geo_json, true);
		return { ...community, area: geoArea(community.tags.geo_json) };
	});

	communities.sort((a, b) => b.area - a.area);

	// displays a button in controls if there is new data available
	const showDataRefresh = () => {
		const refreshDiv: HTMLDivElement | null = document.querySelector('.data-refresh-div');
		if (!refreshDiv) return;
		refreshDiv.style.display = 'block';
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
			// @ts-expect-error
			const DomEvent = await import('leaflet/src/dom/DomEvent');
			/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
			const leafletLocateControl = await import('leaflet.locatecontrol');
			const leafletMarkerCluster = await import('leaflet.markercluster');
			const leafletFeaturegroupSubgroup = await import('leaflet.featuregroup.subgroup');
			/* eslint-enable no-unused-vars, @typescript-eslint/no-unused-vars */

			// add map and tiles
			map = leaflet.map(mapElement);

			if (!hikeEvent) {
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

				// set view to community if in url params
				else if (communityQuery && communitySelected) {
					try {
						map.fitBounds(leaflet.geoJSON(communitySelected.tags.geo_json).getBounds());
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
							// @ts-expect-error
							communities.map((community) => leaflet.geoJSON(community.tags.geo_json).getBounds())
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
			}

			// add tiles and basemaps
			const baseMaps = layers(leaflet, map);

			// add click event to help devs find lat/long of desired location for iframe embeds
			map.on('click', () => {
				const coords = map.getBounds();
				// @ts-expect-error
				console.log(`Here is your iframe embed URL: https://btcmap.org/map?lat=${coords._northEast.lat}&long=${coords._northEast.lng}&lat=${coords._southWest.lat}&long=${coords._southWest.lng}
Thanks for using BTC Map!`);
			});

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

				if (
					!communityQuery &&
					!communitiesOnly &&
					!urlLat.length &&
					!urlLong.length &&
					!hikeEvent
				) {
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

			// add search button to map
			const customSearchButton = leaflet.Control.extend({
				options: {
					position: 'topleft'
				},
				onAdd: () => {
					const searchButtonDiv = leaflet.DomUtil.create('div');
					searchButtonDiv.classList.add('leaflet-bar');
					searchButtonDiv.style.border = 'none';
					searchButtonDiv.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';

					const searchButton = leaflet.DomUtil.create('a');
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

					searchButtonDiv.append(searchButton);

					return searchButtonDiv;
				}
			});

			map.addControl(new customSearchButton());

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

			// add boost layer button

			const customBoostLayerButton = leaflet.Control.extend({
				options: {
					position: 'topleft'
				},
				onAdd: () => {
					const boostLayerDiv = leaflet.DomUtil.create('div');
					boostLayerDiv.classList.add('leaflet-bar');
					boostLayerDiv.style.border = 'none';
					boostLayerDiv.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';

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

					boostLayerDiv.append(boostLayerButton);

					return boostLayerDiv;
				}
			});

			map.addControl(new customBoostLayerButton());
			DomEvent.disableClickPropagation(document.querySelector('.leaflet-control-boost-layer'));

			// add home and marker buttons to map
			homeMarkerButtons(leaflet, map, DomEvent);

			// add data refresh button to map
			dataRefresh(leaflet, map, DomEvent);

			// get date from 1 year ago to add verified check if survey is current
			let verifiedDate = calcVerifiedDate();

			// create marker cluster group and layers
			let communitiesLayer = leaflet.layerGroup();
			// eslint-disable-next-line no-undef
			let markers = L.markerClusterGroup({ maxClusterRadius: 60 });
			let upToDateLayer = leaflet.featureGroup.subGroup(markers);
			let outdatedLayer = leaflet.featureGroup.subGroup(markers);
			let legacyLayer = leaflet.featureGroup.subGroup(markers);
			let categories: MapGroups = {};

			// add communities to map
			communities.forEach((community) => {
				const popupContainer = leaflet.DomUtil.create('div');

				popupContainer.innerHTML = `
				<div class='text-center space-y-2'>
					<img src=${
						community.tags['icon:square']
					} alt='avatar' class='w-24 h-24 rounded-full mx-auto' title='Community icon' ${
						communityQuery || communitiesOnly
							? 'decoding="sync" fetchpriority="high"'
							: 'loading="lazy"'
					} onerror="this.src='/images/communities/bitcoin.svg'" />

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
				if (socials) {
					new Socials({
						target: socials,
						props: {
							website: community.tags['contact:website'],
							email: community.tags['contact:email'],
							nostr: community.tags['contact:nostr'],
							twitter: community.tags['contact:twitter'],
							secondTwitter: community.tags['contact:second_twitter'],
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
				}

				try {
					let communityLayer = leaflet
						.geoJSON(community.tags.geo_json, {
							style: { color: '#000000', fillColor: '#F7931A', fillOpacity: 0.5 }
						})
						.bindPopup(popupContainer, { minWidth: 300 });

					communityLayer.on('click', () => communityLayer.bringToBack());

					communityLayer.addTo(communitiesLayer);
				} catch (error) {
					console.log(error, community);
				}
			});

			if ((communityQuery && communitySelected) || communitiesOnly) {
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

				const elementOSM = element['osm_json'];

				if (
					(onchain ? elementOSM.tags && elementOSM.tags['payment:onchain'] === 'yes' : true) &&
					(lightning ? elementOSM.tags && elementOSM.tags['payment:lightning'] === 'yes' : true) &&
					(nfc
						? elementOSM.tags && elementOSM.tags['payment:lightning_contactless'] === 'yes'
						: true) &&
					(legacy ? elementOSM.tags && elementOSM.tags['payment:bitcoin'] === 'yes' : true) &&
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
						boosted
					);

					let verified = verifiedArr(elementOSM);

					if (verified.length && Date.parse(verified[0]) > verifiedDate) {
						upToDateLayer.addLayer(marker);
					} else {
						outdatedLayer.addLayer(marker);
					}

					if (elementOSM.tags && elementOSM.tags['payment:bitcoin']) {
						legacyLayer.addLayer(marker);
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

			leaflet.control.layers(baseMaps, overlayMaps).addTo(map);

			// treasure hunt event
			if (Date.now() < new Date('April 30, 2023 00:00:00').getTime()) {
				const treasureIcon = leaflet.divIcon({
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

				leaflet
					.marker([53.37225, -6.17711], { icon: treasureIcon })
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

			// mount kili hike event
			if (Date.now() < new Date('September 4, 2023 00:00:00').getTime()) {
				try {
					const hikeData = await axios.get('https://static.btcmap.org/mount-kili-hike/data.json');
					const hikeDataFiltered = hikeData.data.filter(
						(update: any) =>
							update.id !== undefined &&
							update.lat &&
							update.lon &&
							update.title &&
							update.comment &&
							update.timestamp &&
							update.url &&
							update.lightning &&
							update.active === true
					);

					const hikerIcon = leaflet.icon({
						iconUrl: '/icons/hiker-icon.png',
						iconSize: [44, 44],
						iconAnchor: [22, 44],
						popupAnchor: [0, -44]
					});

					hikeDataFiltered.forEach((update: any) => {
						const { lat, lon, title, comment, timestamp, url, lightning } = update;
						const dateFormatted = new Intl.DateTimeFormat('en-US', {
							dateStyle: 'medium',
							timeStyle: 'short',
							hour12: false
						}).format(new Date(timestamp));

						leaflet
							.marker([lat, lon], { icon: hikerIcon })
							.bindPopup(
								`<p class='text-primary dark:text-white text-base text-center'>
									<i class="fa-solid fa-person-hiking text-bitcoin"></i> <strong>${title}</strong> <i class="fa-solid fa-person-hiking text-bitcoin"></i>
									<br/>
									${comment}
									<br/>
									<span class='text-sm'><i class='fa-solid fa-clock mr-1'></i>
									${dateFormatted}
									</span>
									<br/>
									<span class='text-sm'><i class='fa-solid fa-location-dot mr-1'></i> ${lat}, ${lon}</span>
									<br/>
									<a href='${url}' target='_blank' rel='noreferrer' class='!text-link hover:!text-hover transition-colors'>Read More</a> | 
									<a href='lightning:${lightning}' class='!text-link hover:!text-hover transition-colors'>Donate</a>
								</p>
	
								${
									theme === 'dark'
										? `
										<style>
											.leaflet-popup-content-wrapper, .leaflet-popup-tip {
												background-color: #06171C;
												border: 1px solid #e5e7eb
										}
										</style>`
										: ''
								}`,
								{ closeButton: false, maxWidth: 300, minWidth: 300 }
							)
							.addTo(map);
					});

					if (hikeEvent) {
						try {
							map.fitBounds(
								hikeDataFiltered.map((update: any) => [update.lat, update.lon]),
								{ animate: false }
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
				} catch (error) {
					console.error(error);
				}
			}

			// change default icons
			changeDefaultIcons(true, leaflet, mapElement, DomEvent);

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

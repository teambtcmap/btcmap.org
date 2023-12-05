<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { MapLoading, Socials } from '$lib/comp';
	import {
		attribution,
		changeDefaultIcons,
		geolocate,
		homeMarkerButtons,
		layers,
		scaleBars,
		support
	} from '$lib/map/setup';
	import { areaError, areas, reportError, reports } from '$lib/store';
	import { detectTheme, errToast } from '$lib/utils';
	// @ts-expect-error
	import rewind from '@mapbox/geojson-rewind';
	import { geoArea } from 'd3-geo';
	import type { Map } from 'leaflet';
	import { onDestroy, onMount } from 'svelte';

	let mapElement: HTMLDivElement;
	let map: Map;
	let mapLoaded = false;

	// allow to view map centered on a community
	const communityQuery = $page.url.searchParams.get('community');
	const communitySelected = $areas.find((area) => area.id === communityQuery);

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
			/* eslint-enable no-unused-vars, @typescript-eslint/no-unused-vars */

			// add map and tiles
			map = leaflet.map(mapElement);

			// use url hash if present
			if (location.hash) {
				try {
					const coords = location.hash.split('/');
					map.setView([Number(coords[1]), Number(coords[2])], Number(coords[0].slice(1)));
				} catch (error) {
					map.setView([0, 0], 3);
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
				} catch (error) {
					map.setView([0, 0], 3);
					errToast(
						'Could not set map view to provided coordinates, please try again or contact BTC Map.'
					);
					console.log(error);
				}
			}

			// set view to all communities as default
			else if (communities.length) {
				try {
					map.fitBounds(
						// @ts-expect-error
						communities.map((community) => leaflet.geoJSON(community.tags.geo_json).getBounds())
					);
				} catch (error) {
					map.setView([0, 0], 3);
					errToast(
						'Could not set map view to provided coordinates, please try again or contact BTC Map.'
					);
					console.log(error);
				}
			} else {
				map.setView([0, 0], 3);
			}

			// add tiles and basemaps
			const baseMaps = layers(leaflet, map);

			map.on('moveend', () => {
				if (!communityQuery) {
					const zoom = map.getZoom();
					const mapCenter = map.getCenter();
					location.hash = zoom + '/' + mapCenter.lat.toFixed(5) + '/' + mapCenter.lng.toFixed(5);
				}
			});

			// add support attribution
			support();

			// add OSM attribution
			attribution(leaflet, map);

			// add scale
			scaleBars(leaflet, map);

			// add locate button to map
			geolocate(leaflet, map);

			// add home and marker buttons to map
			homeMarkerButtons(leaflet, map, DomEvent);

			// add communities to map
			communities.forEach((community) => {
				const popupContainer = leaflet.DomUtil.create('div');

				popupContainer.innerHTML = `
				<div class='text-center space-y-2'>
					<img src=${
						community.tags['icon:square']
					} alt='avatar' class='w-24 h-24 rounded-full mx-auto' title='Community icon' loading='lazy' onerror="this.src='/images/communities/bitcoin.svg'" />

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

					communityLayer.addTo(map);
				} catch (error) {
					console.log(error, community);
				}
			});

			leaflet.control.layers(baseMaps).addTo(map);

			// change default icons
			changeDefaultIcons(true, leaflet, mapElement, DomEvent);

			// final map setup
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
		<MapLoading
			type="main"
			message="Rendering community map..."
			style="absolute top-0 left-0 z-[10000]"
		/>
	{/if}

	<div bind:this={mapElement} class="absolute h-[100%] w-full !bg-teal dark:!bg-dark" />
</main>

<style>
	@import 'leaflet/dist/leaflet.css';
	@import 'leaflet.locatecontrol/dist/L.Control.Locate.min.css';
</style>

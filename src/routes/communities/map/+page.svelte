<script lang="ts">
import rewind from "@mapbox/geojson-rewind";
import { geoArea } from "d3-geo";
import type { Map } from "leaflet";
import { onDestroy, onMount } from "svelte";
import { get } from "svelte/store";

import MapLoadingMain from "$components/MapLoadingMain.svelte";
import Socials from "$components/Socials.svelte";
import { _ } from "$lib/i18n";
import { loadMapDependencies } from "$lib/map/imports";
import {
	attribution,
	changeDefaultIcons,
	geolocate,
	homeMarkerButtons,
	layers,
	scaleBars,
	support,
	updateMapHash,
} from "$lib/map/setup";
import { areaError, areas, reportError, reports } from "$lib/store";
import { areasSync } from "$lib/sync/areas";
import { batchSync } from "$lib/sync/batchSync";
import { reportsSync } from "$lib/sync/reports";
import { theme } from "$lib/theme";
import type { Leaflet, Theme } from "$lib/types";
import { areaIconSrc, errToast } from "$lib/utils";

import { browser } from "$app/environment";
import { resolve } from "$app/paths";
import { page } from "$app/stores";

let mapLoading = 0;

let leaflet: Leaflet;
let DomEvent: typeof import("leaflet/src/dom/DomEvent");
let currentMapTheme: Theme;

let mapElement: HTMLDivElement;
let map: Map;
let mapLoaded = false;
let communitiesLoaded = false;

// allow to view map centered on a community
const communityQuery = $page.url.searchParams.get("community");

// allow to view map with only certain language communities
const communityLang = $page.url.searchParams.get("communityLang");

// allow to view map with only certain org communities
const organization = $page.url.searchParams.get("organization");

// alert for area errors
$: $areaError && errToast($areaError);

// alert for report errors
$: $reportError && errToast($reportError);

const initializeCommunities = () => {
	if (communitiesLoaded) return;

	const communitySelected = $areas.find((area) => area.id === communityQuery);

	// filter communities
	const communitiesFiltered = $areas.filter(
		(area) =>
			area.tags.type === "community" &&
			area.tags.geo_json &&
			area.tags.name &&
			area.tags["icon:square"] &&
			area.tags.continent &&
			$reports.find((report) => report.area_id === area.id) &&
			(communityLang ? area.tags.language === communityLang : true) &&
			(organization ? area.tags.organization === organization : true),
	);

	// sort communities by largest to smallest
	const communities = communitiesFiltered
		.map((community) => {
			rewind(community.tags.geo_json, true);
			return { ...community, area: geoArea(community.tags.geo_json) };
		})
		.sort((a, b) => b.area - a.area);

	// add communities to map
	communities.forEach((community) => {
		const popupContainer = leaflet.DomUtil.create("div");

		popupContainer.innerHTML = `
				<div class='text-center space-y-2'>
					<img loading='lazy' src='${areaIconSrc(community.tags["icon:square"])}' alt='${get(_)("communityMap.avatarAlt")}' class='w-24 h-24 rounded-full mx-auto' title='${get(_)("communityMap.communityIconTitle")}' onerror="this.src='/images/bitcoin.svg'" />

					<span class='text-primary dark:text-white font-semibold text-xl' title='${get(_)("communityMap.communityNameTitle")}'>${
						community.tags.name
					}</span>

					${
						community.tags.organization
							? `<span
						class="mx-auto whitespace-nowrap w-fit block rounded-full bg-[#10B981] px-3.5 py-1 text-xs font-semibold uppercase text-white" title="${get(_)("communityMap.organization")}"
					>
					${community.tags.organization}
					</span>`
							: ""
					}

					${
						community.tags.sponsor
							? `<span class="block gradient-bg w-32 mx-auto py-1 text-xs text-white font-semibold rounded-full" title="${get(_)("communityMap.supporter")}">
						${get(_)("communityMap.sponsor")}
					</span>`
							: ""
					}

					<div id='socials'>
					</div>

					<a href="${resolve(`/community/${encodeURIComponent(community.id)}`)}" class='block bg-link hover:bg-hover !text-white text-center font-semibold py-3 rounded-xl transition-colors' title='${get(_)("communityMap.communityPageTitle")}'>${get(_)("communityMap.viewCommunity")}</a>
				</div>

					${
						currentMapTheme === "dark"
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
							: ""
					}`;

		const socials = popupContainer.querySelector("#socials");
		if (socials) {
			new Socials({
				target: socials,
				props: {
					website: community.tags["contact:website"],
					email: community.tags["contact:email"],
					phone: community.tags["contact:phone"],
					nostr: community.tags["contact:nostr"],
					twitter: community.tags["contact:twitter"],
					meetup: community.tags["contact:meetup"],
					telegram: community.tags["contact:telegram"],
					discord: community.tags["contact:discord"],
					youtube: community.tags["contact:youtube"],
					github: community.tags["contact:github"],
					matrix: community.tags["contact:matrix"],
					geyser: community.tags["contact:geyser"],
					satlantis: community.tags["contact:satlantis"],
					eventbrite: community.tags["contact:eventbrite"],
					reddit: community.tags["contact:reddit"],
					simplex: community.tags["contact:simplex"],
					instagram: community.tags["contact:instagram"],
					whatsapp: community.tags["contact:whatsapp"],
					facebook: community.tags["contact:facebook"],
					linkedin: community.tags["contact:linkedin"],
					rss: community.tags["contact:rss"],
					signal: community.tags["contact:signal"],
				},
			});
		}

		try {
			let communityLayer = leaflet
				.geoJSON(community.tags.geo_json, {
					style: { color: "#000000", fillColor: "#F7931A", fillOpacity: 0.5 },
				})
				.bindPopup(popupContainer, { minWidth: 300 });

			communityLayer.on("click", () => communityLayer.bringToBack());

			communityLayer.addTo(map);
		} catch (error) {
			console.error(error, community);
		}
	});

	// set view to community if in url params
	if (communityQuery && communitySelected) {
		try {
			map.fitBounds(
				leaflet.geoJSON(communitySelected.tags.geo_json).getBounds(),
			);
		} catch (error) {
			map.setView([0, 0], 3);
			errToast(get(_)("errors.mapView"));
			console.error(error);
		}
	}

	mapLoading = 100;

	communitiesLoaded = true;
};

$: $areas?.length &&
	$reports?.length &&
	mapLoaded &&
	!communitiesLoaded &&
	initializeCommunities();

onMount(async () => {
	batchSync([areasSync, reportsSync]);

	if (browser) {
		currentMapTheme = theme.current;

		const deps = await loadMapDependencies();
		leaflet = deps.leaflet;
		DomEvent = deps.DomEvent;
		const LocateControl = deps.LocateControl;

		// add map and tiles
		map = leaflet.map(mapElement);

		// use url hash if present
		if (location.hash) {
			try {
				const coords = location.hash.split("/");
				map.setView(
					[Number(coords[1]), Number(coords[2])],
					Number(coords[0].slice(1)),
				);
			} catch (error) {
				map.setView([0, 0], 3);
				errToast(get(_)("errors.mapView"));
				console.error(error);
			}
		} else {
			map.setView([0, 0], 3);
		}

		// add tiles and basemaps
		const { baseMaps } = layers(leaflet, map);

		map.on("moveend", () => {
			if (!communityQuery) {
				const zoom = map.getZoom();
				const mapCenter = map.getCenter();
				updateMapHash(zoom, mapCenter);
			}
		});

		// add support attribution
		support();

		// add OSM attribution
		attribution(leaflet, map);

		// add scale
		scaleBars(leaflet, map);

		// add locate button to map
		geolocate(leaflet, map, LocateControl);

		// add home and marker buttons to map
		homeMarkerButtons(leaflet, map, DomEvent);

		leaflet.control.layers(baseMaps).addTo(map);

		// change default icons
		changeDefaultIcons(true, leaflet, mapElement, DomEvent);

		// final map setup
		mapLoading = 40;

		mapLoaded = true;
	}
});

onDestroy(async () => {
	if (map) {
		console.info("Unloading Leaflet map.");
		map.remove();
	}
});
</script>

<svelte:head>
	<title>BTC Map - {$_('meta.communityMap')}</title>
	<meta property="og:image" content="https://btcmap.org/images/og/communities.png" />
	<meta property="og:title" content="BTC Map - {$_('meta.communityMap')}" />
	<meta name="twitter:title" content="BTC Map - {$_('meta.communityMap')}" />
	<meta name="twitter:image" content="https://btcmap.org/images/og/communities.png" />
</svelte:head>

<div>
	<h1 class="hidden">{$_('communityMap.pageTitle')}</h1>

	<MapLoadingMain progress={mapLoading} />

	<div bind:this={mapElement} class="absolute h-[100%] w-full !bg-teal dark:!bg-dark" />
</div>

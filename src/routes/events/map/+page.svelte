<script lang="ts">
import axios from "axios";
import type { Map, Marker } from "leaflet";
import { onDestroy, onMount } from "svelte";

import MapLoadingMain from "$components/MapLoadingMain.svelte";
import { loadMapDependencies } from "$lib/map/imports";
import {
	attribution,
	changeDefaultIcons,
	generateIcon,
	geolocate,
	homeMarkerButtons,
	layers,
	scaleBars,
	support,
	updateMapHash,
} from "$lib/map/setup";
import { theme } from "$lib/theme";
import type { EventMapEvent, Leaflet, Theme } from "$lib/types";
import { errToast } from "$lib/utils";

import { browser } from "$app/environment";

let mapLoading = 0;

let leaflet: Leaflet;
let DomEvent: typeof import("leaflet/src/dom/DomEvent");
let currentMapTheme: Theme;

let mapElement: HTMLDivElement;
let map: Map;
let mapLoaded = false;
let eventsLoaded = false;
let markers: Marker[] = [];
let events: EventMapEvent[] = [];

const initializeEvents = () => {
	if (eventsLoaded) return;

	events.forEach((event: EventMapEvent) => {
		const popupContainer = leaflet.DomUtil.create("div");

		popupContainer.innerHTML = `
			<div class='text-center space-y-2'>
				<span class='text-primary dark:text-white font-semibold text-xl' title='Event name'>${event.name}</span>

				${
					event.website
						? `<a href="${event.website}" target="_blank" rel="noopener noreferrer" class='block mt-4 bg-link hover:bg-hover !text-white text-center font-semibold py-3 rounded-xl transition-colors' title='Event website'>Visit Website</a>`
						: ""
				}
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

		try {
			const calendarIcon = generateIcon(leaflet, "event", false, 0);

			const marker = leaflet
				.marker([event.lat, event.lon], { icon: calendarIcon })
				.bindPopup(popupContainer, { minWidth: 250 });

			marker.addTo(map);
			markers.push(marker);
		} catch (error) {
			console.error(error, event);
		}
	});

	mapLoading = 100;

	eventsLoaded = true;
};

$: events?.length && mapLoaded && !eventsLoaded && initializeEvents();

const loadEvents = async () => {
	try {
		const response = await axios.get<EventMapEvent[]>(
			"https://api.btcmap.org/v4/events?include_past=true",
		);
		events = response.data;
	} catch (error) {
		errToast("Could not load events, please try again or contact BTC Map.");
		console.error(error);
	}
};

onMount(async () => {
	await loadEvents();

	if (browser) {
		currentMapTheme = theme.current;

		const deps = await loadMapDependencies();
		leaflet = deps.leaflet;
		DomEvent = deps.DomEvent;
		const LocateControl = deps.LocateControl;

		map = leaflet.map(mapElement);

		if (location.hash) {
			try {
				const coords = location.hash.split("/");
				map.setView(
					[Number(coords[1]), Number(coords[2])],
					Number(coords[0].slice(1)),
				);
			} catch (error) {
				map.setView([0, 0], 3);
				errToast(
					"Could not set map view to provided coordinates, please try again or contact BTC Map.",
				);
				console.error(error);
			}
		} else {
			map.setView([20, 0], 2);
		}

		const { baseMaps } = layers(leaflet, map);

		map.on("moveend", () => {
			const zoom = map.getZoom();
			const mapCenter = map.getCenter();
			updateMapHash(zoom, mapCenter);
		});

		support();

		attribution(leaflet, map);

		scaleBars(leaflet, map);

		geolocate(leaflet, map, LocateControl);

		homeMarkerButtons(leaflet, map, DomEvent);

		leaflet.control.layers(baseMaps).addTo(map);

		changeDefaultIcons(true, leaflet, mapElement, DomEvent);

		mapLoading = 40;

		mapLoaded = true;
	}
});

onDestroy(async () => {
	markers.forEach((marker) => marker.remove());
	markers = [];

	if (map) {
		console.info("Unloading Leaflet map.");
		map.remove();
	}
});
</script>

<svelte:head>
	<title>BTC Map - Event Map</title>
	<meta property="og:image" content="https://btcmap.org/images/og/communities.png" />
	<meta property="twitter:title" content="BTC Map - Event Map" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/communities.png" />
</svelte:head>

<div>
	<h1 class="hidden">Event Map</h1>

	<MapLoadingMain progress={mapLoading} />

	<div bind:this={mapElement} class="absolute h-screen w-full !bg-teal dark:!bg-dark" />
</div>

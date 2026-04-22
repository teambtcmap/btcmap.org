<script lang="ts">
import type { FeatureGroup, Map } from "leaflet";
import { onDestroy, onMount } from "svelte";

import AreaMerchantDrawer from "$components/area/AreaMerchantDrawer.svelte";
import MapLoadingEmbed from "$components/MapLoadingEmbed.svelte";
import { loadMapDependencies } from "$lib/map/imports";
import {
	applyThemeToBaseMaps,
	attribution,
	changeDefaultIcons,
	generateIcon,
	generateMarker,
	geolocate,
	layers,
} from "$lib/map/setup";
import { theme } from "$lib/theme";
import type { BaseMaps, DomEventType, Leaflet, SavedPlace } from "$lib/types";

import { browser } from "$app/environment";

export let places: SavedPlace[];

let selectedMerchantId: number | null = null;

const openDrawer = (id: number | string) => {
	selectedMerchantId = Number(id);
};

const closeDrawer = () => {
	selectedMerchantId = null;
};

let mapElement: HTMLDivElement;
let map: Map;
let mapLoaded = false;

let baseMaps: BaseMaps;

let leaflet: Leaflet;
let DomEvent: DomEventType;
let LocateControl: typeof import("leaflet.locatecontrol").LocateControl;

const closePopup = () => {
	map.closePopup();
};

$: $theme !== undefined && mapLoaded && closePopup();

$: $theme !== undefined &&
	mapLoaded &&
	applyThemeToBaseMaps($theme, baseMaps, map);

onMount(async () => {
	if (browser) {
		const deps = await loadMapDependencies();
		leaflet = deps.leaflet;
		DomEvent = deps.leaflet.DomEvent;
		LocateControl = deps.LocateControl;

		initialRenderComplete = true;
	}
});

onDestroy(() => {
	if (map) {
		console.info("Unloading Leaflet map.");
		map.remove();
	}
});

let initialRenderComplete = false;
let dataInitialized = false;
// markerClusterGroup extends FeatureGroup; its own type isn't bundled
let markers: FeatureGroup;

const renderPlaces = () => {
	markers.clearLayers();

	places.forEach((place) => {
		const divIcon = generateIcon(leaflet, "currency_bitcoin", false, 0);

		const marker = generateMarker({
			lat: place.lat,
			long: place.lon,
			icon: divIcon,
			placeId: place.id,
			leaflet,
			verify: false,
			onMarkerClick: (id) => openDrawer(id),
		});

		markers.addLayer(marker);
	});

	if (places.length > 0) {
		const coords = places.map((p) => [p.lat, p.lon] as [number, number]);
		map.fitBounds(leaflet.latLngBounds(coords), {
			maxZoom: 14,
			padding: [20, 20],
		});
	} else {
		map.setView([20, 0], 2);
	}

	// If the currently-open drawer's place was removed from the list,
	// close it — the user's context is gone.
	if (
		selectedMerchantId !== null &&
		!places.some((p) => p.id === selectedMerchantId)
	) {
		closeDrawer();
	}
};

const initializeData = () => {
	if (dataInitialized) return;

	map = leaflet.map(mapElement, { attributionControl: false, maxZoom: 19 });

	const layersResult = layers(leaflet, map);
	baseMaps = layersResult.baseMaps;

	leaflet.Icon.Default.prototype.options.imagePath = "/icons/";

	attribution(leaflet, map);

	// @ts-expect-error L is injected globally by leaflet.markercluster
	markers = L.markerClusterGroup();
	map.addLayer(markers);

	geolocate(leaflet, map, LocateControl);

	changeDefaultIcons(true, leaflet, mapElement, DomEvent);

	map.on("click", () => {
		if (selectedMerchantId) {
			closeDrawer();
		}
	});

	renderPlaces();

	mapLoaded = true;
	dataInitialized = true;
};

$: if (places && initialRenderComplete && !dataInitialized) {
	initializeData();
} else if (places && dataInitialized) {
	renderPlaces();
}
</script>

<section>
	<div class="relative">
		<div class="overflow-hidden rounded-3xl">
			<!-- prettier-ignore -->
			<div
				bind:this={mapElement}
				class="z-10 h-[300px] rounded-3xl border border-gray-300 !bg-teal text-left md:h-[500px] dark:border-white/95 dark:!bg-[#202f33]"
			/>
			{#if !mapLoaded}
				<MapLoadingEmbed
					style="h-[300px] md:h-[500px] rounded-3xl border border-gray-300 dark:border-white/95"
				/>
			{/if}
		</div>
		<AreaMerchantDrawer merchantId={selectedMerchantId} onClose={closeDrawer} />
	</div>
</section>
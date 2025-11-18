<script lang="ts">
	import { browser } from '$app/environment';
	import { GradeTable } from '$lib/constants';
	import Icon from '$components/Icon.svelte';
	import MapLoadingEmbed from '$components/MapLoadingEmbed.svelte';
	import ShowTags from '$components/ShowTags.svelte';
	import TaggingIssues from '$components/TaggingIssues.svelte';
	import {
		attribution,
		changeDefaultIcons,
		generateIcon,
		generateMarker,
		geolocate,
		layers,
		toggleMapButtons
	} from '$lib/map/setup';
	import { theme } from '$lib/store';
	import type { BaseMaps, DomEventType, Grade, Leaflet, Place } from '$lib/types';
	import { getGrade } from '$lib/utils';
	import type { GeoJSON } from 'geojson';
	import type { Map } from 'leaflet';
	import { onDestroy, onMount } from 'svelte';
	import tippy from 'tippy.js';

	export let name: string;
	export let geoJSON: GeoJSON;
	export let filteredPlaces: Place[];

	let total: number | undefined;
	let upToDate: number | undefined;
	let upToDatePercent: string | undefined;

	let grade: Grade;

	let gradeTooltip: HTMLButtonElement;

	$: gradeTooltip &&
		tippy([gradeTooltip], {
			content: GradeTable,
			allowHTML: true
		});

	let mapElement: HTMLDivElement;
	let map: Map;
	let mapLoaded = false;

	let baseMaps: BaseMaps;

	let leaflet: Leaflet;
	let DomEvent: DomEventType;

	$: $theme !== undefined && mapLoaded && toggleMapButtons();

	const closePopup = () => {
		map.closePopup();
	};

	$: $theme !== undefined && mapLoaded && closePopup();

	const toggleTheme = () => {
		if ($theme === 'dark') {
			baseMaps['OpenFreeMap Liberty'].remove();
			baseMaps['OpenFreeMap Dark'].addTo(map);
		} else {
			baseMaps['OpenFreeMap Dark'].remove();
			baseMaps['OpenFreeMap Liberty'].addTo(map);
		}
	};

	$: $theme !== undefined && mapLoaded && toggleTheme();

	onMount(async () => {
		if (browser) {
			//import packages
			leaflet = await import('leaflet');
			DomEvent = leaflet.DomEvent;
			/* eslint-disable @typescript-eslint/no-unused-vars */
			const maplibreGl = await import('maplibre-gl');
			const maplibreGlLeaflet = await import('@maplibre/maplibre-gl-leaflet');
			const leafletMarkerCluster = await import('leaflet.markercluster');
			const leafletFeaturegroupSubgroup = await import('leaflet.featuregroup.subgroup');
			const leafletLocateControl = await import('leaflet.locatecontrol');
			/* eslint-enable @typescript-eslint/no-unused-vars */

			initialRenderComplete = true;
		}
	});

	onDestroy(async () => {
		if (map) {
			console.info('Unloading Leaflet map.');
			map.remove();
		}
	});

	let initialRenderComplete = false;
	let dataInitialized = false;

	const initializeData = () => {
		if (dataInitialized) return;

		const populateMap = () => {
			// add map
			map = leaflet.map(mapElement, { attributionControl: false, maxZoom: 19 });

			// add tiles and basemaps
			const layersResult = layers(leaflet, map);
			baseMaps = layersResult.baseMaps;

			// change broken marker image path in prod
			leaflet.Icon.Default.prototype.options.imagePath = '/icons/';

			// add OSM attribution
			attribution(leaflet, map);

			// create marker cluster groups

			/* eslint-disable no-undef */
			// @ts-expect-error L is injected globally by leaflet.markercluster
			let markers = L.markerClusterGroup();
			/* eslint-enable no-undef */
			let upToDateLayer = leaflet.featureGroup.subGroup(markers);

			// add locate button to map
			geolocate(leaflet, map);

			// change default icons
			changeDefaultIcons(true, leaflet, mapElement, DomEvent);

			// add area poly to map
			leaflet.geoJSON(geoJSON, { style: { fill: false } }).addTo(map);

			// add places to map
			filteredPlaces.forEach((place) => {
				const commentsCount = place.comments || 0;
				const boosted = place.boosted_until ? Date.parse(place.boosted_until) > Date.now() : false;

				let divIcon = generateIcon(leaflet, place.icon, boosted, commentsCount);

				let marker = generateMarker({
					lat: place.lat,
					long: place.lon,
					icon: divIcon,
					placeId: place.id,
					leaflet,
					verify: true
				});

				upToDateLayer.addLayer(marker);

				if (upToDate === undefined) {
					upToDate = 1;
				} else {
					upToDate++;
				}

				if (total === undefined) {
					total = 1;
				} else {
					total++;
				}
			});

			map.addLayer(markers);
			map.addLayer(upToDateLayer);

			map.fitBounds(leaflet.geoJSON(geoJSON).getBounds());

			mapLoaded = true;
		};

		populateMap();

		if (!upToDate) {
			upToDate = 0;
		}

		if (!total) {
			total = 0;
		}

		upToDatePercent = upToDate ? (upToDate / (total / 100)).toFixed(0) : '0';

		grade = getGrade(Number(upToDatePercent));

		dataInitialized = true;
	};

	$: geoJSON && filteredPlaces && initialRenderComplete && !dataInitialized && initializeData();
</script>

<section id="map-section">
	<!-- prettier-ignore -->
	<h3
		class="rounded-t-3xl border border-b-0 border-gray-300 p-5 text-center text-lg font-semibold text-primary md:text-left dark:border-white/95 dark:bg-white/10 dark:text-white"
	>
		{name || 'BTC Map Area'} Map
		<div class="flex items-center space-x-1 text-link">
			{#if dataInitialized}
				<div class="flex items-center space-x-1">
					{#each Array(grade) as _, index (index)}
						<Icon type="fa" icon="star" w="16" h="16" />
					{/each}
				</div>

				<div class="flex items-center space-x-1">
					{#each Array(5 - grade) as _, index (index)}
						<Icon type="fa" icon="star" w="16" h="16" style="opacity-25" />
					{/each}
				</div>
			{:else}
				<div class="flex items-center space-x-1">
					{#each Array(5) as _, index (index)}
						<Icon type="fa" icon="star" w="16" h="16" style="animate-pulse text-link/50" />
					{/each}
				</div>
			{/if}

			<button bind:this={gradeTooltip}>
				<Icon type="fa" icon="circle-info" w="14" h="14" style="text-sm" />
			</button>
		</div>
	</h3>

	<div class="relative">
		<!-- prettier-ignore -->
		<div
			bind:this={mapElement}
			class="z-10 h-[300px] rounded-b-3xl border border-gray-300 !bg-teal text-left md:h-[600px] dark:border-white/95 dark:!bg-[#202f33]"
		/>
		{#if !mapLoaded}
			<MapLoadingEmbed
				style="h-[300px] md:h-[600px] rounded-b-3xl border border-gray-300 dark:border-white/95"
			/>
		{/if}
	</div>

	<ShowTags />
	<TaggingIssues />
</section>

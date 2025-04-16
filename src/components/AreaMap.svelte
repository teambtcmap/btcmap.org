<script lang="ts">
	import { browser } from '$app/environment';
	import { GradeTable, MapLoadingEmbed, ShowTags, TaggingIssues } from '$lib/comp';
	import {
		attribution,
		calcVerifiedDate,
		changeDefaultIcons,
		generateIcon,
		generateMarker,
		geolocate,
		latCalc,
		layers,
		longCalc,
		toggleMapButtons,
		verifiedArr
	} from '$lib/map/setup';
	import { theme } from '$lib/store';
	import type { BaseMaps, DomEventType, Grade, Leaflet } from '$lib/types';
	import { type Element } from '$lib/types.js';
	import { getGrade } from '$lib/utils';
	import type { GeoJSON } from 'geojson';
	import type { Map } from 'leaflet';
	import { onDestroy, onMount } from 'svelte';
	import tippy from 'tippy.js';

	export let name: string;
	export let geoJSON: GeoJSON;
	export let filteredElements: Element[];

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
			// @ts-expect-error
			DomEvent = await import('leaflet/src/dom/DomEvent');
			/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
			const maplibreGl = await import('maplibre-gl');
			const maplibreGlLeaflet = await import('@maplibre/maplibre-gl-leaflet');
			const leafletMarkerCluster = await import('leaflet.markercluster');
			const leafletFeaturegroupSubgroup = await import('leaflet.featuregroup.subgroup');
			const leafletLocateControl = await import('leaflet.locatecontrol');
			/* eslint-enable no-unused-vars, @typescript-eslint/no-unused-vars */

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
			baseMaps = layers(leaflet, map);

			// change broken marker image path in prod
			leaflet.Icon.Default.prototype.options.imagePath = '/icons/';

			// add OSM attribution
			attribution(leaflet, map);

			// create marker cluster groups

			// @ts-expect-error
			let markers = L.markerClusterGroup();
			// @ts-expect-error
			let upToDateLayer = leaflet.featureGroup.subGroup(markers);
			// @ts-expect-error
			let outdatedLayer = leaflet.featureGroup.subGroup(markers);
			// @ts-expect-error
			let legacyLayer = leaflet.featureGroup.subGroup(markers);

			let overlayMaps = {
				'Up-To-Date': upToDateLayer,
				Outdated: outdatedLayer,
				Legacy: legacyLayer
			};

			leaflet.control.layers(baseMaps, overlayMaps).addTo(map);

			// add locate button to map
			geolocate(leaflet, map);

			// change default icons
			changeDefaultIcons(true, leaflet, mapElement, DomEvent);

			// get date from 1 year ago to add verified check if survey is current
			let verifiedDate = calcVerifiedDate();

			// add area poly to map
			leaflet.geoJSON(geoJSON, { style: { fill: false } }).addTo(map);

			// add elements to map
			filteredElements.forEach((element) => {
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

					if (upToDate === undefined) {
						upToDate = 1;
					} else {
						upToDate++;
					}
				} else {
					outdatedLayer.addLayer(marker);
				}

				if (elementOSM.tags && elementOSM.tags['payment:bitcoin']) {
					legacyLayer.addLayer(marker);
				}

				if (total === undefined) {
					total = 1;
				} else {
					total++;
				}
			});

			map.addLayer(markers);
			map.addLayer(upToDateLayer);
			map.addLayer(outdatedLayer);
			map.addLayer(legacyLayer);

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

	$: geoJSON && filteredElements && initialRenderComplete && !dataInitialized && initializeData();
</script>

<section id="map-section">
	<h3
		class="rounded-t-3xl border border-b-0 border-statBorder p-5 text-center text-lg font-semibold text-primary dark:bg-white/10 dark:text-white md:text-left"
	>
		{name || 'BTC Map Area'} Map
		<div class="flex items-center space-x-1 text-link">
			{#if dataInitialized}
				<div class="flex items-center space-x-1">
					<!-- eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars -->
					{#each Array(grade) as star}
						<i class="fa-solid fa-star" />
					{/each}
				</div>

				<div class="flex items-center space-x-1">
					<!-- eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars -->
					{#each Array(5 - grade) as star}
						<i class="fa-solid fa-star opacity-25" />
					{/each}
				</div>
			{:else}
				<div class="flex items-center space-x-1">
					<!-- eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars -->
					{#each Array(5) as star}
						<i class="fa-solid fa-star animate-pulse text-link/50" />
					{/each}
				</div>
			{/if}

			<button bind:this={gradeTooltip}>
				<i class="fa-solid fa-circle-info text-sm" />
			</button>
		</div>
	</h3>

	<div class="relative">
		<div
			bind:this={mapElement}
			class="z-10 h-[300px] rounded-b-3xl border border-statBorder !bg-teal text-left dark:!bg-[#202f33] md:h-[600px]"
		/>
		{#if !mapLoaded}
			<MapLoadingEmbed style="h-[300px] md:h-[600px] border border-statBorder rounded-b-3xl" />
		{/if}
	</div>

	<ShowTags />
	<TaggingIssues />
</section>

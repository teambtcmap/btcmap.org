<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { onDestroy, onMount } from 'svelte';

	import { trackEvent } from '$lib/analytics';
	import { dataRefresh, homeMarkerButtons } from '$lib/map/setup';
	import type { Leaflet } from '$lib/types';
	import type { Control, Map } from 'leaflet';

	export let map: Map | undefined;
	export let leaflet: Leaflet | undefined;
	export let DomEvent: typeof import('leaflet/src/dom/DomEvent') | undefined;

	let boostControl: Control | null = null;

	const addBoostControl = () => {
		if (!leaflet || !map) return;

		const BoostControl = leaflet.Control.extend({
			options: {
				position: 'topright'
			},
			onAdd: () => {
				const addControlDiv = leaflet.DomUtil.create('div');
				addControlDiv.classList.add('leaflet-control-boost', 'leaflet-bar', 'leaflet-control');

				const boostLayerButton = leaflet.DomUtil.create('a');
				boostLayerButton.classList.add('leaflet-control-boost-layer');
				boostLayerButton.href = '#';
				boostLayerButton.tabIndex = 0;
				boostLayerButton.title = 'Boosted locations';
				boostLayerButton.role = 'button';
				boostLayerButton.ariaLabel = 'Boosted locations';
				boostLayerButton.ariaDisabled = 'false';
				boostLayerButton.innerHTML = `<img src='${$page.url.searchParams.has('boosts') ? '/icons/boost-solid.svg' : '/icons/boost.svg'}' alt='boost' id='boost-layer' style='width: 16px; height: 16px;'/>`;
				boostLayerButton.onclick = (e) => {
					e.preventDefault();
					trackEvent('boost_layer_toggle');
					const currentUrl = new URL($page.url);
					const boosts = currentUrl.searchParams.has('boosts');
					if (boosts) {
						currentUrl.searchParams.delete('boosts');
					} else {
						currentUrl.searchParams.set('boosts', 'true');
					}
					location.search = currentUrl.search;
				};
				addControlDiv.append(boostLayerButton);

				return addControlDiv;
			}
		});

		boostControl = new BoostControl();
		map.addControl(boostControl);

		const boostLayer = document.querySelector('.leaflet-control-boost-layer');
		if (boostLayer && DomEvent) {
			DomEvent.disableClickPropagation(boostLayer as HTMLElement);
		}
	};

	onMount(() => {
		if (!browser || !map || !leaflet || !DomEvent) return;

		addBoostControl();
		homeMarkerButtons(leaflet, map, DomEvent, true);
		dataRefresh(leaflet, map, DomEvent);
	});

	onDestroy(() => {
		if (map && boostControl) {
			map.removeControl(boostControl);
		}
	});
</script>

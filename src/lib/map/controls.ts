import type { Leaflet } from '$lib/types';
import type { Map } from 'leaflet';

type DomEventModule = typeof import('leaflet/src/dom/DomEvent');

interface SearchBoostControlOptions {
	theme: 'dark' | 'light';
	boostsActive: boolean;
	onSearchClick: () => void;
	onBoostToggle: () => void;
}

// Create the search and boost layer control buttons
export const createSearchBoostControl = (
	leaflet: Leaflet,
	DomEvent: DomEventModule,
	map: Map,
	options: SearchBoostControlOptions
): void => {
	const { theme, boostsActive, onSearchClick, onBoostToggle } = options;

	const CustomControls = leaflet.Control.extend({
		options: {
			position: 'topleft'
		},
		onAdd: () => {
			const addControlDiv = leaflet.DomUtil.create('div');
			addControlDiv.style.border = 'none';
			addControlDiv.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';
			addControlDiv.classList.add('leaflet-control-search-boost', 'leaflet-bar', 'leaflet-control');

			// Search button - opens panel in search mode
			const searchButton = leaflet.DomUtil.create('a');
			searchButton.classList.add('leaflet-control-search-toggle');
			searchButton.title = 'Search';
			searchButton.role = 'button';
			searchButton.ariaLabel = 'Search';
			searchButton.ariaDisabled = 'false';
			searchButton.innerHTML = `<img src=${
				theme === 'dark' ? '/icons/search-white.svg' : '/icons/search.svg'
			} alt='search' class='inline' id='search-button'/>`;
			searchButton.style.borderRadius = '8px 8px 0 0';
			searchButton.onclick = onSearchClick;

			if (theme === 'light') {
				searchButton.onmouseenter = () => {
					const img = document.querySelector('#search-button') as HTMLImageElement | null;
					if (img) img.src = '/icons/search-black.svg';
				};
				searchButton.onmouseleave = () => {
					const img = document.querySelector('#search-button') as HTMLImageElement | null;
					if (img) img.src = '/icons/search.svg';
				};
			}
			searchButton.classList.add(
				'dark:!bg-dark',
				'dark:hover:!bg-dark/75',
				'dark:border',
				'dark:border-white/95'
			);

			addControlDiv.append(searchButton);

			// Boost layer button
			const boostLayerButton = leaflet.DomUtil.create('a');
			boostLayerButton.classList.add('leaflet-control-boost-layer');
			boostLayerButton.title = 'Boosted locations';
			boostLayerButton.role = 'button';
			boostLayerButton.ariaLabel = 'Boosted locations';
			boostLayerButton.ariaDisabled = 'false';
			boostLayerButton.innerHTML = `<img src=${
				boostsActive
					? theme === 'dark'
						? '/icons/boost-solid-white.svg'
						: '/icons/boost-solid.svg'
					: theme === 'dark'
						? '/icons/boost-white.svg'
						: '/icons/boost.svg'
			} alt='boost' class='inline' id='boost-layer'/>`;
			boostLayerButton.style.borderRadius = '0 0 8px 8px';
			boostLayerButton.style.borderBottom = '1px solid #ccc';
			boostLayerButton.onclick = onBoostToggle;

			if (theme === 'light') {
				boostLayerButton.onmouseenter = () => {
					const img = document.querySelector('#boost-layer') as HTMLImageElement | null;
					if (img)
						img.src = boostsActive ? '/icons/boost-solid-black.svg' : '/icons/boost-black.svg';
				};
				boostLayerButton.onmouseleave = () => {
					const img = document.querySelector('#boost-layer') as HTMLImageElement | null;
					if (img) img.src = boostsActive ? '/icons/boost-solid.svg' : '/icons/boost.svg';
				};
			}
			boostLayerButton.classList.add(
				'dark:!bg-dark',
				'dark:hover:!bg-dark/75',
				'dark:border',
				'dark:border-white/95'
			);

			addControlDiv.append(boostLayerButton);

			return addControlDiv;
		}
	});

	map.addControl(new CustomControls());

	// Disable map click propagation on boost layer button
	const boostLayer = document.querySelector('.leaflet-control-boost-layer');
	if (boostLayer) {
		DomEvent.disableClickPropagation(boostLayer as HTMLElement);
	}

	// Disable map click propagation on search toggle
	const searchToggle = document.querySelector('.leaflet-control-search-toggle');
	if (searchToggle) {
		DomEvent.disableClickPropagation(searchToggle as HTMLElement);
	}
};

// Create top-center control container for search bar
export const createTopCenterContainer = (map: Map, leaflet: Leaflet): void => {
	// @ts-expect-error accessing private Leaflet map internals for custom control placement
	map._controlCorners['topcenter'] = leaflet.DomUtil.create(
		'div',
		'leaflet-top leaflet-center',
		// @ts-expect-error accessing private Leaflet map internals
		map._controlContainer
	);
};

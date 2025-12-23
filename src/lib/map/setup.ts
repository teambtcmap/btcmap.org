import type { Map, LatLng, DivIcon } from 'leaflet';

import { replaceState } from '$app/navigation';
import axios from 'axios';
import axiosRetry from 'axios-retry';

import Icon from '$components/Icon.svelte';
import { trackEvent } from '$lib/analytics';
import { PLACE_FIELD_SETS, buildFieldsParam } from '$lib/api-fields';
import { selectedMerchant } from '$lib/store';
import type { DomEventType, Leaflet, Place } from '$lib/types';
import { detectTheme, errToast, humanizeIconName } from '$lib/utils';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export const updateMapHash = (zoom: number, center: LatLng): void => {
	// Preserve any existing query parameters (like &merchant=123)
	const currentHash = window.location.hash.substring(1);
	const ampIndex = currentHash.indexOf('&');
	const existingParams = ampIndex !== -1 ? currentHash.substring(ampIndex) : '';

	const newHash = `#${zoom}/${center.lat.toFixed(5)}/${center.lng.toFixed(5)}${existingParams}`;
	// Use SvelteKit's replaceState to preserve current pathname while updating hash
	const url = window.location.pathname + newHash;
	// eslint-disable-next-line svelte/no-navigation-without-resolve
	replaceState(url, {});
};

export const layers = (leaflet: Leaflet, map: Map) => {
	const theme = detectTheme();

	const osm = leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
		noWrap: true,
		maxZoom: 19
	});

	const openFreeMapLiberty = window.L.maplibreGL({
		style: 'https://tiles.openfreemap.org/styles/liberty'
	});

	const openFreeMapDark = window.L.maplibreGL({
		style: 'https://static.btcmap.org/map-styles/dark.json'
	});

	const cartoPositron = window.L.maplibreGL({
		style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
	});

	const cartoDarkMatter = window.L.maplibreGL({
		style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
	});

	let activeLayer;
	if (theme === 'dark') {
		cartoDarkMatter.addTo(map);
		activeLayer = cartoDarkMatter;
	} else {
		openFreeMapLiberty.addTo(map);
		activeLayer = openFreeMapLiberty;
	}

	const baseMaps = {
		'OpenFreeMap Liberty': openFreeMapLiberty,
		'OpenFreeMap Dark': openFreeMapDark,
		'Carto Positron': cartoPositron,
		'Carto Dark Matter': cartoDarkMatter,
		OpenStreetMap: osm
	};

	return { baseMaps, activeLayer };
};

export const attribution = (L: Leaflet, map: Map) => {
	// Use Leaflet's default attribution control
	L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);
};

export const support = () => {
	// Add "Support BTC Map" link to right attribution
	const supportAttribution: HTMLDivElement | null = document.querySelector(
		'.leaflet-bottom.leaflet-right > .leaflet-control-attribution'
	);

	if (!supportAttribution) return;

	supportAttribution.innerHTML =
		'<a href="/support-us" title="Support with sats">Support</a> BTC Map';
};

export const scaleBars = (L: Leaflet, map: Map) => {
	// Use Leaflet's default scale control
	L.control.scale({ position: 'bottomleft' }).addTo(map);
};

export const changeDefaultIcons = (
	_layers: boolean,
	L: Leaflet,
	mapElement: HTMLDivElement,
	DomEvent: DomEventType
) => {
	// Add analytics tracking to zoom controls (keep Leaflet's default +/- text)
	const zoomIn: HTMLAnchorElement | null = document.querySelector('.leaflet-control-zoom-in');
	if (zoomIn) {
		zoomIn.addEventListener('click', () => {
			trackEvent('zoom_in_click');
		});
	}

	const zoomOut: HTMLAnchorElement | null = document.querySelector('.leaflet-control-zoom-out');
	if (zoomOut) {
		zoomOut.addEventListener('click', () => {
			trackEvent('zoom_out_click');
		});
	}

	// Add fullscreen button (custom control, not native to Leaflet)
	const leafletBar: HTMLDivElement | null = document.querySelector('.leaflet-bar');
	const fullscreenButton = L.DomUtil.create('a');
	fullscreenButton.classList.add('leaflet-control-full-screen');
	fullscreenButton.title = 'Full screen';
	fullscreenButton.role = 'button';
	fullscreenButton.ariaLabel = 'Full screen';
	fullscreenButton.ariaDisabled = 'false';
	fullscreenButton.innerHTML = `<img src='/icons/expand.svg' alt='fullscreen' class='inline' style='width: 16px; height: 16px;'/>`;
	fullscreenButton.onclick = function toggleFullscreen() {
		trackEvent('fullscreen_click');
		if (!document.fullscreenElement) {
			mapElement.requestFullscreen().catch((err) => {
				errToast(`Error attempting to enable fullscreen mode: ${err.message} (${err.name})`);
			});
		} else {
			document.exitFullscreen();
		}
	};

	zoomBar?.append(fullscreenButton);

	if (DomEvent) {
		DomEvent.disableClickPropagation(fullscreenButton);
	}
};

export const geolocate = (
	_L: Leaflet,
	map: Map,
	LocateControl: typeof import('leaflet.locatecontrol').LocateControl
) => {
	// Use plugin defaults, just add analytics tracking
	new LocateControl({ position: 'topleft' }).addTo(map);

	const locateButton: HTMLAnchorElement | null = document.querySelector(
		'.leaflet-bar-part.leaflet-bar-part-single'
	);
	if (locateButton) {
		// Replace default arrow icon with custom crosshairs icon
		locateButton.innerHTML = `<img src='/icons/locate.svg' alt='locate' style='width: 16px; height: 16px;'/>`;

		locateButton.addEventListener('click', () => {
			trackEvent('locate_click');
		});
	}
};

export const homeMarkerButtons = (
	L: Leaflet,
	map: Map,
	DomEvent: DomEventType,
	mainMap?: boolean
) => {
	const addControlDiv = L.DomUtil.create('div');

	const customControls = L.Control.extend({
		options: {
			position: 'bottomright'
		},
		onAdd: () => {
			addControlDiv.classList.add('leaflet-control-site-links', 'leaflet-bar', 'leaflet-control');

			// Home button
			const addHomeButton = L.DomUtil.create('a');
			addHomeButton.href = '/';
			addHomeButton.title = 'Go to home page';
			addHomeButton.role = 'button';
			addHomeButton.ariaLabel = 'Go to home page';
			addHomeButton.innerHTML = `<img src='/icons/home.svg' alt='home' style='width: 16px; height: 16px;'/>`;
			addHomeButton.onclick = () => {
				trackEvent('home_button_click');
			};
			addControlDiv.append(addHomeButton);

			if (mainMap) {
				// Add location button
				const addLocationButton = L.DomUtil.create('a');
				addLocationButton.href = '/add-location';
				addLocationButton.title = 'Add location';
				addLocationButton.role = 'button';
				addLocationButton.ariaLabel = 'Add location';
				addLocationButton.innerHTML = `<img src='/icons/marker.svg' alt='marker' style='width: 16px; height: 16px;'/>`;
				addLocationButton.onclick = () => {
					trackEvent('add_location_click');
				};
				addControlDiv.append(addLocationButton);

				// Community map button
				const communityMapButton = L.DomUtil.create('a');
				communityMapButton.href = '/communities/map';
				communityMapButton.title = 'Community map';
				communityMapButton.role = 'button';
				communityMapButton.ariaLabel = 'Community map';
				communityMapButton.innerHTML = `<img src='/icons/group.svg' alt='group' style='width: 16px; height: 16px;'/>`;
				communityMapButton.onclick = () => {
					trackEvent('community_map_click');
				};
				addControlDiv.append(communityMapButton);
			} else {
				// Merchant map button (for community map page)
				const merchantMapButton = L.DomUtil.create('a');
				merchantMapButton.href = '/map';
				merchantMapButton.title = 'Merchant map';
				merchantMapButton.role = 'button';
				merchantMapButton.ariaLabel = 'Merchant map';
				merchantMapButton.innerHTML = `<img src='/icons/shopping.svg' alt='shopping' style='width: 16px; height: 16px;'/>`;
				addControlDiv.append(merchantMapButton);
			}

			return addControlDiv;
		}
	});

	map.addControl(new customControls());
	DomEvent.disableClickPropagation(addControlDiv);
};

export const dataRefresh = (L: Leaflet, map: Map, DomEvent: DomEventType) => {
	const dataRefreshButton = L.DomUtil.create('a');

	const customDataRefreshButton = L.Control.extend({
		options: {
			position: 'bottomright'
		},
		onAdd: () => {
			const dataRefreshDiv = L.DomUtil.create('div');
			dataRefreshDiv.classList.add('leaflet-bar', 'leaflet-control', 'data-refresh-div');
			dataRefreshDiv.style.display = 'none';

			dataRefreshButton.classList.add('leaflet-control-data-refresh');
			dataRefreshButton.title = 'Data refresh available';
			dataRefreshButton.role = 'button';
			dataRefreshButton.ariaLabel = 'Data refresh available';
			dataRefreshButton.ariaDisabled = 'false';
			dataRefreshButton.innerHTML = `<img src='/icons/refresh.svg' alt='refresh' style='width: 16px; height: 16px;'/>`;
			dataRefreshButton.onclick = () => {
				trackEvent('data_refresh_click');
				location.reload();
			};

			dataRefreshDiv.append(dataRefreshButton);

			return dataRefreshDiv;
		}
	});

	map.addControl(new customDataRefreshButton());
	DomEvent.disableClickPropagation(dataRefreshButton);
};

export const calcVerifiedDate = () => {
	const verifiedDate = new Date();
	const previousYear = verifiedDate.getFullYear() - 1;
	return verifiedDate.setFullYear(previousYear);
};

export const generateLocationIcon = (L: Leaflet) => {
	return L.divIcon({
		className: 'div-icon',
		iconSize: [32, 43],
		iconAnchor: [16, 43],
		popupAnchor: [0, -43]
	});
};

export const generateIcon = (L: Leaflet, icon: string, boosted: boolean, commentsCount: number) => {
	const className = boosted ? 'animate-wiggle' : '';
	const iconTmp = icon !== 'question_mark' ? icon : 'currency_bitcoin';

	const iconContainer = document.createElement('div');
	iconContainer.className = 'icon-container relative flex items-center justify-center';

	const iconElement = document.createElement('div');
	new Icon({
		target: iconElement,
		props: {
			w: '20',
			h: '20',
			class: `${className} mt-[5.75px] text-white`,
			icon: iconTmp,
			type: 'material'
		}
	});
	iconContainer.appendChild(iconElement);

	if (commentsCount > 0) {
		const commentsCountSpan = document.createElement('span');
		commentsCountSpan.textContent = `${commentsCount}`;
		commentsCountSpan.className =
			'absolute top-1 right-1 transform translate-x-1/2 -translate-y-1/2 ' +
			'bg-green-600 text-white text-[10px] font-bold ' +
			'rounded-full w-4 h-4 flex items-center justify-center';
		iconContainer.appendChild(commentsCountSpan);
	}

	// Accessible label for screen readers
	const accessibleLabel = document.createElement('span');
	accessibleLabel.className = 'sr-only';
	accessibleLabel.textContent = humanizeIconName(icon);
	iconContainer.appendChild(accessibleLabel);

	return L.divIcon({
		className: boosted ? 'boosted-icon' : 'div-icon',
		iconSize: [32, 43],
		iconAnchor: [16, 43],
		popupAnchor: [0, -43],
		html: iconContainer
	});
};

export const verifiedArr = (place: Place) => {
	const verified = [];

	if (place['osm:survey:date'] && Date.parse(place['osm:survey:date'])) {
		verified.push(place['osm:survey:date']);
	}

	if (place['osm:check_date'] && Date.parse(place['osm:check_date'])) {
		verified.push(place['osm:check_date']);
	}

	if (place['osm:check_date:currency:XBT'] && Date.parse(place['osm:check_date:currency:XBT'])) {
		verified.push(place['osm:check_date:currency:XBT']);
	}

	if (verified.length > 1) {
		verified.sort((a, b) => Date.parse(b) - Date.parse(a));
	}

	return verified;
};

export const generateMarker = ({
	lat,
	long,
	icon,
	placeId,
	// element,
	// payment,
	leaflet: L,
	onMarkerClick
	// verifiedDate,
	// verify,
	// boosted
	// issues
}: {
	lat: number;
	long: number;
	icon: DivIcon;
	placeId: number | string;
	leaflet: Leaflet;
	onMarkerClick?: (placeId: number | string) => void;
	// verifiedDate: number;
	verify: boolean;
	boosted?: boolean;
	// issues?: Issue[];
}) => {
	const marker = L.marker([lat, long], { icon });

	marker.on('click', async () => {
		if (onMarkerClick) {
			onMarkerClick(placeId);
		} else {
			// Fallback to old store-based behavior
			try {
				const response = await axios.get(
					`https://api.btcmap.org/v4/places/${placeId}?fields=${buildFieldsParam(PLACE_FIELD_SETS.COMPLETE_PLACE)}`
				);
				const placeDetails = response.data;
				selectedMerchant.set(placeDetails);
			} catch (error) {
				console.error('Error fetching place details:', error);
				errToast('Error loading merchant details. Please try again.');
			}
		}
	});

	return marker;
};

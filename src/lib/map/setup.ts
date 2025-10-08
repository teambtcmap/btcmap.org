import { boost, exchangeRate, resetBoost, theme } from '$lib/store';
import { Icon } from '$lib/comp';
import type { DomEventType, ElementOSM, Leaflet, OSMTags } from '$lib/types';
import { detectTheme, errToast, formatVerifiedHuman } from '$lib/utils';
import { PLACE_FIELD_SETS, buildFieldsParam } from '$lib/api-fields';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import type { Map, LatLng } from 'leaflet';
import { get } from 'svelte/store';
import type { DivIcon } from 'leaflet';
import Time from 'svelte-time';

const BORDER_BOTTOM_STYLE = '1.5px solid #ccc';
const BOTTOM_BUTTON_RADIUS = '0 0 8px 8px';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export const updateMapHash = (zoom: number, center: LatLng): void => {
	const newHash = `#${zoom}/${center.lat.toFixed(5)}/${center.lng.toFixed(5)}`;
	// Use history.replaceState for hash-only updates to avoid history pollution
	// This is appropriate for SvelteKit as hash changes don't affect routing
	history.replaceState(null, '', newHash);
};

export const toggleMapButtons = () => {
	const zoomInBtn: HTMLAnchorElement | null = document.querySelector('.leaflet-control-zoom-in');
	const zoomOutBtn: HTMLAnchorElement | null = document.querySelector('.leaflet-control-zoom-out');
	const fullScreenBtn: HTMLAnchorElement | null = document.querySelector(
		'.leaflet-control-full-screen'
	);
	const locateBtn: HTMLAnchorElement | null = document.querySelector(
		'.leaflet-bar-part.leaflet-bar-part-single'
	);
	const zoomInImg: HTMLImageElement | null = document.querySelector('#zoomin');
	const zoomOutImg: HTMLImageElement | null = document.querySelector('#zoomout');
	const fullScreenImg: HTMLImageElement | null = document.querySelector('#fullscreen');
	const locateImg: HTMLImageElement | null = document.querySelector('#locatebutton');

	if (
		zoomInBtn &&
		zoomOutBtn &&
		fullScreenBtn &&
		locateBtn &&
		zoomInImg &&
		zoomOutImg &&
		fullScreenImg &&
		locateImg
	) {
		if (get(theme) === 'dark') {
			zoomInImg.src = '/icons/plus-white.svg';
			zoomOutImg.src = '/icons/minus-white.svg';
			fullScreenImg.src = '/icons/expand-white.svg';
			locateImg.src = '/icons/locate-white.svg';

			zoomInBtn.onmouseenter = null;
			zoomInBtn.onmouseleave = null;
			zoomOutBtn.onmouseenter = null;
			zoomOutBtn.onmouseleave = null;
			fullScreenBtn.onmouseenter = null;
			fullScreenBtn.onmouseleave = null;
			locateBtn.onmouseenter = null;
			locateBtn.onmouseleave = null;
		} else {
			zoomInImg.src = '/icons/plus.svg';
			zoomOutImg.src = '/icons/minus.svg';
			fullScreenImg.src = '/icons/expand.svg';
			locateImg.src = '/icons/locate.svg';

			zoomInBtn.onmouseenter = () => {
				zoomInImg.src = '/icons/plus-black.svg';
			};
			zoomInBtn.onmouseleave = () => {
				zoomInImg.src = '/icons/plus.svg';
			};

			zoomOutBtn.onmouseenter = () => {
				zoomOutImg.src = '/icons/minus-black.svg';
			};
			zoomOutBtn.onmouseleave = () => {
				zoomOutImg.src = '/icons/minus.svg';
			};

			fullScreenBtn.onmouseenter = () => {
				fullScreenImg.src = '/icons/expand-black.svg';
			};
			fullScreenBtn.onmouseleave = () => {
				fullScreenImg.src = '/icons/expand.svg';
			};

			locateBtn.onmouseenter = () => {
				locateImg.src = '/icons/locate-black.svg';
			};
			locateBtn.onmouseleave = () => {
				locateImg.src = '/icons/locate.svg';
			};
		}
	}
};

export const layers = (leaflet: Leaflet, map: Map) => {
	const theme = detectTheme();

	const osm = leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
		noWrap: true,
		maxZoom: 19
	});

	// @ts-ignore
	const openFreeMapLiberty = window.L.maplibreGL({
		style: 'https://tiles.openfreemap.org/styles/liberty'
	});

	// @ts-ignore
	const openFreeMapDark = window.L.maplibreGL({
		style: 'https://static.btcmap.org/map-styles/dark.json'
	});

	if (theme === 'dark') {
		openFreeMapDark.addTo(map);
	} else {
		openFreeMapLiberty.addTo(map);
	}

	const baseMaps = {
		'OpenFreeMap Liberty': openFreeMapLiberty,
		'OpenFreeMap Dark': openFreeMapDark,
		OpenStreetMap: osm
	};

	return baseMaps;
};

export const attribution = (L: Leaflet, map: Map) => {
	L.control.attribution({ position: 'bottomleft' }).addTo(map);

	const OSMAttribution: HTMLDivElement | null = document.querySelector(
		'.leaflet-bottom.leaflet-left > .leaflet-control-attribution'
	);

	if (!OSMAttribution) return;

	OSMAttribution.style.borderRadius = '0 8px 0 0';
	OSMAttribution.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';
	OSMAttribution.innerHTML =
		'<a href="http://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" class="!text-link hover:!text-hover !no-underline transition-colors block md:inline"><span class="text-map dark:text-white">&copy;</span> OpenStreetMap <span class="text-map dark:text-white">contributors</span></a>';
	OSMAttribution.classList.add(
		'dark:!bg-dark',
		'dark:!text-white',
		'dark:border-t',
		'dark:border-r'
	);
};

export const support = () => {
	const supportAttribution: HTMLDivElement | null = document.querySelector(
		'.leaflet-bottom.leaflet-right > .leaflet-control-attribution'
	);

	if (!supportAttribution) return;

	supportAttribution.style.borderRadius = '8px 0 0 0';
	supportAttribution.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';
	supportAttribution.innerHTML =
		'<a href="/support-us" class="!text-link hover:!text-hover !no-underline transition-colors" title="Support with sats">Support</a> BTC Map';
	supportAttribution.classList.add(
		'dark:!bg-dark',
		'dark:!text-white',
		'dark:border-t',
		'dark:border-l'
	);
};

export const scaleBars = (L: Leaflet, map: Map) => {
	const theme = detectTheme();

	L.control.scale({ position: 'bottomleft' }).addTo(map);
	const scaleBars: NodeListOf<HTMLDivElement> = document.querySelectorAll(
		'.leaflet-control-scale-line'
	);
	scaleBars.forEach((bar) => {
		bar.classList.add('dark:!bg-dark', 'dark:!text-white');
		if (theme === 'dark') {
			bar.style.textShadow = 'none';
		}
	});
};

export const changeDefaultIcons = (
	layers: boolean,
	L: Leaflet,
	mapElement: HTMLDivElement,
	DomEvent: DomEventType
) => {
	const theme = detectTheme();

	if (layers) {
		const layers: HTMLDivElement | null = document.querySelector('.leaflet-control-layers');
		if (layers) {
			layers.style.border = theme === 'dark' ? '1px solid #e5e7eb' : 'none';
			layers.style.borderRadius = '8px';
			layers.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';
			layers.classList.add('dark:!bg-dark', 'dark:!text-white');
		}
	}

	const leafletBar: HTMLDivElement | null = document.querySelector('.leaflet-bar');
	if (leafletBar) {
		leafletBar.style.border = 'none';
		leafletBar.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';
	}

	const zoomIn: HTMLAnchorElement | null = document.querySelector('.leaflet-control-zoom-in');
	if (zoomIn) {
		zoomIn.style.borderRadius = '8px 8px 0 0';
		zoomIn.innerHTML = `<img src=${
			theme === 'dark' ? '/icons/plus-white.svg' : '/icons/plus.svg'
		} alt='zoomin' class='inline' id='zoomin'/>`;
		if (theme === 'light') {
			const zoomInIcon: HTMLImageElement | null = document.querySelector('#zoomin');
			if (zoomInIcon) {
				zoomIn.onmouseenter = () => {
					zoomInIcon.src = '/icons/plus-black.svg';
				};
				zoomIn.onmouseleave = () => {
					zoomInIcon.src = '/icons/plus.svg';
				};
			}
		}
		zoomIn.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');
	}

	const zoomOut: HTMLAnchorElement | null = document.querySelector('.leaflet-control-zoom-out');
	if (zoomOut) {
		zoomOut.innerHTML = `<img src=${
			theme === 'dark' ? '/icons/minus-white.svg' : '/icons/minus.svg'
		} alt='zoomout' class='inline' id='zoomout'/>`;
		if (theme === 'light') {
			const zoomOutIcon: HTMLImageElement | null = document.querySelector('#zoomout');
			if (zoomOutIcon) {
				zoomOut.onmouseenter = () => {
					zoomOutIcon.src = '/icons/minus-black.svg';
				};
				zoomOut.onmouseleave = () => {
					zoomOutIcon.src = '/icons/minus.svg';
				};
			}
		}
		zoomOut.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');
	}

	const fullscreenButton = L.DomUtil.create('a');
	fullscreenButton.classList.add('leaflet-control-full-screen');
	fullscreenButton.title = 'Full screen';
	fullscreenButton.role = 'button';
	fullscreenButton.ariaLabel = 'Full screen';
	fullscreenButton.ariaDisabled = 'false';
	fullscreenButton.innerHTML = `<img src=${
		theme === 'dark' ? '/icons/expand-white.svg' : '/icons/expand.svg'
	} alt='fullscreen' class='inline' id='fullscreen'/>`;
	fullscreenButton.style.borderRadius = BOTTOM_BUTTON_RADIUS;
	fullscreenButton.onclick = function toggleFullscreen() {
		if (!document.fullscreenElement) {
			mapElement.requestFullscreen().catch((err) => {
				errToast(`Error attempting to enable fullscreen mode: ${err.message} (${err.name})`);
			});
		} else {
			document.exitFullscreen();
		}
	};
	if (theme === 'light') {
		fullscreenButton.onmouseenter = () => {
			const fullscreenIcon = document.querySelector('#fullscreen') as HTMLImageElement;
			if (fullscreenIcon) {
				fullscreenIcon.src = '/icons/expand-black.svg';
			}
		};
		fullscreenButton.onmouseleave = () => {
			const fullscreenIcon = document.querySelector('#fullscreen') as HTMLImageElement;
			if (fullscreenIcon) {
				fullscreenIcon.src = '/icons/expand.svg';
			}
		};
	}
	fullscreenButton.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');
	fullscreenButton.style.borderBottom = BORDER_BOTTOM_STYLE;

	leafletBar?.append(fullscreenButton);

	if (DomEvent) {
		DomEvent.disableClickPropagation(fullscreenButton);
	}
};

export const geolocate = (L: Leaflet, map: Map) => {
	const theme = detectTheme();

	L.control.locate({ position: 'topleft' }).addTo(map);

	const newLocateIcon = L.DomUtil.create('img');
	newLocateIcon.src = theme === 'dark' ? '/icons/locate-white.svg' : '/icons/locate.svg';
	newLocateIcon.alt = 'locate';
	newLocateIcon.classList.add('inline');
	newLocateIcon.id = 'locatebutton';
	document.querySelector('.leaflet-control-locate-location-arrow')?.replaceWith(newLocateIcon);

	const locateDiv: HTMLDivElement | null = document.querySelector('.leaflet-control-locate');
	if (locateDiv) {
		locateDiv.style.border = 'none';
		locateDiv.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';
	}

	const locateButton: HTMLAnchorElement | null = document.querySelector(
		'.leaflet-bar-part.leaflet-bar-part-single'
	);
	if (locateButton) {
		locateButton.style.borderRadius = '8px';
		locateButton.style.borderBottom = BORDER_BOTTOM_STYLE;
		if (theme === 'light') {
			const locateIcon: HTMLImageElement | null = document.querySelector('#locatebutton');
			if (locateIcon) {
				locateButton.onmouseenter = () => {
					locateIcon.src = '/icons/locate-black.svg';
				};
				locateButton.onmouseleave = () => {
					locateIcon.src = '/icons/locate.svg';
				};
			}
		}
		locateButton.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');
	}
};

export const homeMarkerButtons = (
	L: Leaflet,
	map: Map,
	DomEvent: DomEventType,
	mainMap?: boolean
) => {
	const theme = detectTheme();

	const addControlDiv = L.DomUtil.create('div');

	const customControls = L.Control.extend({
		options: {
			position: 'topleft'
		},
		onAdd: () => {
			addControlDiv.style.border = 'none';
			addControlDiv.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';
			addControlDiv.classList.add('leaflet-control-site-links', 'leaflet-bar', 'leaflet-control');

			const addHomeButton = L.DomUtil.create('a');
			addHomeButton.classList.add('leaflet-bar-part');
			addHomeButton.href = '/';
			addHomeButton.title = 'Go to home page';
			addHomeButton.role = 'button';
			addHomeButton.ariaLabel = 'Go to home page';
			addHomeButton.ariaDisabled = 'false';
			addHomeButton.innerHTML = `<img src=${
				theme === 'dark' ? '/icons/home-white.svg' : '/icons/home.svg'
			} alt='home' class='inline' id='homebutton'/>`;
			addHomeButton.style.borderRadius = '8px 8px 0 0';
			if (theme === 'light') {
				addHomeButton.onmouseenter = () => {
					const homeIcon = document.querySelector('#homebutton') as HTMLImageElement;
					if (homeIcon) {
						homeIcon.src = '/icons/home-black.svg';
					}
				};
				addHomeButton.onmouseleave = () => {
					const homeIcon = document.querySelector('#homebutton') as HTMLImageElement;
					if (homeIcon) {
						homeIcon.src = '/icons/home.svg';
					}
				};
			}
			addHomeButton.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');

			addControlDiv.append(addHomeButton);

			if (mainMap) {
				const addLocationButton = L.DomUtil.create('a');
				addLocationButton.classList.add('leaflet-bar-part');
				addLocationButton.href = '/add-location';
				addLocationButton.title = 'Add location';
				addLocationButton.role = 'button';
				addLocationButton.ariaLabel = 'Add location';
				addLocationButton.ariaDisabled = 'false';
				addLocationButton.innerHTML = `<img src=${
					theme === 'dark' ? '/icons/marker-white.svg' : '/icons/marker.svg'
				} alt='marker' class='inline' id='marker'/>`;
				addLocationButton.style.borderRadius = '0';
				if (theme === 'light') {
					addLocationButton.onmouseenter = () => {
						const markerIcon = document.querySelector('#marker') as HTMLImageElement;
						if (markerIcon) {
							markerIcon.src = '/icons/marker-black.svg';
						}
					};
					addLocationButton.onmouseleave = () => {
						const markerIcon = document.querySelector('#marker') as HTMLImageElement;
						if (markerIcon) {
							markerIcon.src = '/icons/marker.svg';
						}
					};
				}
				addLocationButton.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');

				addControlDiv.append(addLocationButton);

				const communityMapButton = L.DomUtil.create('a');
				communityMapButton.classList.add('leaflet-bar-part');
				communityMapButton.href = '/communities/map';
				communityMapButton.title = 'Community map';
				communityMapButton.role = 'button';
				communityMapButton.ariaLabel = 'Community map';
				communityMapButton.ariaDisabled = 'false';
				communityMapButton.innerHTML = `<img src=${
					theme === 'dark' ? '/icons/group-white.svg' : '/icons/group.svg'
				} alt='group' class='inline' id='group'/>`;
				communityMapButton.style.borderRadius = BOTTOM_BUTTON_RADIUS;
				if (theme === 'light') {
					communityMapButton.onmouseenter = () => {
						const groupIcon = document.querySelector('#group') as HTMLImageElement;
						if (groupIcon) {
							groupIcon.src = '/icons/group-black.svg';
						}
					};
					communityMapButton.onmouseleave = () => {
						const groupIcon = document.querySelector('#group') as HTMLImageElement;
						if (groupIcon) {
							groupIcon.src = '/icons/group.svg';
						}
					};
				}
				communityMapButton.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');
				communityMapButton.style.borderBottom = BORDER_BOTTOM_STYLE;

				addControlDiv.append(communityMapButton);
			} else {
				const merchantMapButton = L.DomUtil.create('a');
				merchantMapButton.classList.add('leaflet-bar-part');
				merchantMapButton.href = '/map';
				merchantMapButton.title = 'Merchant map';
				merchantMapButton.role = 'button';
				merchantMapButton.ariaLabel = 'Merchant map';
				merchantMapButton.ariaDisabled = 'false';
				merchantMapButton.innerHTML = `<img src=${
					theme === 'dark' ? '/icons/shopping-white.svg' : '/icons/shopping.svg'
				} alt='shopping' class='inline' id='shopping'/>`;
				merchantMapButton.style.borderRadius = BOTTOM_BUTTON_RADIUS;
				merchantMapButton.style.borderBottom = BORDER_BOTTOM_STYLE;
				if (theme === 'light') {
					merchantMapButton.onmouseenter = () => {
						const shoppingIcon = document.querySelector('#shopping') as HTMLImageElement;
						if (shoppingIcon) {
							shoppingIcon.src = '/icons/shopping-black.svg';
						}
					};
					merchantMapButton.onmouseleave = () => {
						const shoppingIcon = document.querySelector('#shopping') as HTMLImageElement;
						if (shoppingIcon) {
							shoppingIcon.src = '/icons/shopping.svg';
						}
					};
				}
				merchantMapButton.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');

				addControlDiv.append(merchantMapButton);
			}

			return addControlDiv;
		}
	});

	map.addControl(new customControls());
	DomEvent.disableClickPropagation(addControlDiv);
};

export const dataRefresh = (L: Leaflet, map: Map, DomEvent: DomEventType) => {
	const theme = detectTheme();

	const dataRefreshButton = L.DomUtil.create('a');

	const customDataRefreshButton = L.Control.extend({
		options: {
			position: 'topleft'
		},
		onAdd: () => {
			const dataRefreshDiv = L.DomUtil.create('div');
			dataRefreshDiv.classList.add('leaflet-bar', 'leafet-control', 'data-refresh-div');
			dataRefreshDiv.style.border = 'none';
			dataRefreshDiv.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';
			dataRefreshDiv.style.display = 'none';

			dataRefreshButton.classList.add('leaflet-control-data-refresh');
			dataRefreshButton.title = 'Data refresh available';
			dataRefreshButton.role = 'button';
			dataRefreshButton.ariaLabel = 'Data refresh available';
			dataRefreshButton.ariaDisabled = 'false';
			dataRefreshButton.innerHTML = `<img src=${
				theme === 'dark' ? '/icons/refresh-white.svg' : '/icons/refresh.svg'
			} alt='refresh' class='inline' id='refresh'/>`;
			dataRefreshButton.style.borderRadius = '8px';
			dataRefreshButton.onclick = () => {
				location.reload();
			};
			if (theme === 'light') {
				dataRefreshButton.onmouseenter = () => {
					const refreshIcon = document.querySelector('#refresh') as HTMLImageElement;
					if (refreshIcon) {
						refreshIcon.src = '/icons/refresh-black.svg';
					}
				};
				dataRefreshButton.onmouseleave = () => {
					const refreshIcon = document.querySelector('#refresh') as HTMLImageElement;
					if (refreshIcon) {
						refreshIcon.src = '/icons/refresh.svg';
					}
				};
			}
			dataRefreshButton.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');

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

export const checkAddress = (element: OSMTags) => {
	let address = '';

	if (element['addr:housenumber'] && element['addr:street']) {
		address = `${element['addr:housenumber']} ${element['addr:street']}`;
	} else if (element['addr:street']) {
		address = element['addr:street'];
	}

	if (element['addr:city']) {
		if (address) {
			address += `, ${element['addr:city']}`;
		} else {
			address = element['addr:city'];
		}
	}

	if (element['addr:postcode']) {
		if (address) {
			address += ` ${element['addr:postcode']}`;
		} else {
			address = element['addr:postcode'];
		}
	}

	return address;
};

export const latCalc = (element: ElementOSM) => {
	if (element.type === 'node') {
		return element.lat;
	} else {
		if (element.bounds && 'minlat' in element.bounds && 'maxlat' in element.bounds) {
			return (element.bounds.minlat + element.bounds.maxlat) / 2;
		}
		return 0;
	}
};

export const longCalc = (element: ElementOSM) => {
	if (element.type === 'node') {
		return element.lon;
	} else {
		if (element.bounds && 'minlon' in element.bounds && 'maxlon' in element.bounds) {
			return (element.bounds.minlon + element.bounds.maxlon) / 2;
		}
		return 0;
	}
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
			style: `${className} mt-[5.75px] text-white`,
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

	return L.divIcon({
		className: boosted ? 'boosted-icon' : 'div-icon',
		iconSize: [32, 43],
		iconAnchor: [16, 43],
		popupAnchor: [0, -43],
		html: iconContainer
	});
};

export const verifiedArr = (element: ElementOSM) => {
	const verified = [];

	if (element.tags) {
		if (element.tags['survey:date'] && Date.parse(element.tags['survey:date'])) {
			verified.push(element.tags['survey:date']);
		}

		if (element.tags['check_date'] && Date.parse(element.tags['check_date'])) {
			verified.push(element.tags['check_date']);
		}

		if (
			element.tags['check_date:currency:XBT'] &&
			Date.parse(element.tags['check_date:currency:XBT'])
		) {
			verified.push(element.tags['check_date:currency:XBT']);
		}

		if (verified.length > 1) {
			verified.sort((a, b) => Date.parse(b) - Date.parse(a));
		}
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
	leaflet: L
	// verifiedDate,
	// verify,
	// boosted
	// issues
}: {
	lat: number;
	long: number;
	icon: DivIcon;
	placeId: number | string;
	// element: ElementOSM;
	// payment: PayMerchant;
	leaflet: Leaflet;
	// verifiedDate: number;
	verify: boolean;
	boosted?: boolean;
	// issues?: Issue[];
}) => {
	const marker = L.marker([lat, long], { icon });

	marker.on('click', async () => {
		if (marker.isPopupOpen()) {
			marker.closePopup();
		} else {
			// Fetch place details from v4 API
			try {
				const response = await axios.get(
					`https://api.btcmap.org/v4/places/${placeId}?fields=${buildFieldsParam(PLACE_FIELD_SETS.COMPLETE_PLACE)}`
				);
				const placeDetails = response.data;

				// Calculate verification status
				const verifiedDate = calcVerifiedDate(); // 1 year ago

				const isUpToDate =
					placeDetails.verified_at && Date.parse(placeDetails.verified_at) > verifiedDate;

				// Calculate boosted status
				const isBoosted =
					placeDetails.boosted_until && Date.parse(placeDetails.boosted_until) > Date.now();

				// Create popup with proper styling structure
				const popupContent = L.DomUtil.create('div');
				const theme = detectTheme();

				// Check if we have an OSM URL to extract type and id for links
				let osmType = 'node';
				let osmId = placeDetails.id;
				if (placeDetails.osm_url) {
					const osmMatch = placeDetails.osm_url.match(/openstreetmap\.org\/([^/]+)\/(\d+)/);
					if (osmMatch) {
						osmType = osmMatch[1];
						osmId = osmMatch[2];
					}
				}

				popupContent.innerHTML = `
					${
						placeDetails.name
							? `<a href='/merchant/${placeId}' class='inline-block font-bold text-lg leading-snug max-w-[300px]' title='Merchant name'>
							<span class='!text-link hover:!text-hover transition-colors'>${placeDetails.name}</span>
						   </a>`
							: ''
					}

					<span class='block text-body dark:text-white max-w-[300px]' title='Address'>${
						placeDetails.address || ''
					}</span>

					${
						placeDetails.opening_hours
							? `<div class='my-1 w-full max-w-[300px]' title='Opening hours'>
							<svg width='16px' height='16px' class='inline text-primary dark:text-white'>
								<use width='16px' height='16px' href="/icons/spritesheet-popup.svg#clock"></use>
							</svg>
							<span class='text-body dark:text-white'>${placeDetails.opening_hours}</span>
						   </div>`
							: ''
					}

					<div class='flex space-x-2 mt-2.5 mb-1'>
						<a id='navigate' href='geo:${lat},${long}' class='border border-mapBorder hover:border-link !text-primary dark:!text-white hover:!text-link dark:hover:!text-link rounded-lg py-1 w-full transition-colors'>
							<svg width='24px' height='24px' class='mx-auto'>
								<use width='24px' height='24px' href="/icons/spritesheet-popup.svg#compass"></use>
							</svg>
							<span class='block text-xs text-center mt-1'>Navigate</span>
						</a>

						<a id='edit' href='${placeDetails.osm_url || `https://www.openstreetmap.org/edit?${osmType}=${osmId}`}' target="_blank" rel="noreferrer" class='border border-mapBorder hover:border-link !text-primary dark:!text-white hover:!text-link dark:hover:!text-link rounded-lg py-1 w-full transition-colors'>
							<svg width='24px' height='24px' class='mx-auto'>
								<use width='24px' height='24px' href="/icons/spritesheet-popup.svg#pencil"></use>
							</svg>
							<span class='block text-xs text-center mt-1'>Edit</span>
						</a>

						<a id='share' href='/merchant/${placeId}' target="_blank" rel="noreferrer" class='border border-mapBorder hover:border-link !text-primary dark:!text-white hover:!text-link dark:hover:!text-link rounded-lg py-1 w-full transition-colors'>
							<svg width='24px' height='24px' class='mx-auto'>
								<use width='24px' height='24px' href="/icons/spritesheet-popup.svg#share"></use>
							</svg>
							<span class='block text-xs text-center mt-1'>Share</span>
						</a>

						<a href='/merchant/${placeId}#comments' class='border border-mapBorder hover:border-link !text-primary dark:!text-white hover:!text-link dark:hover:!text-link rounded-lg py-1 w-full transition-colors'>
							<div class='flex items-center justify-center h-6 text-lg font-bold mx-auto'>
								${typeof placeDetails.comments === 'number' ? placeDetails.comments : placeDetails.comments?.length || 0}
							</div>
							<span class='block text-xs text-center mt-1'>Comments</span>
						</a>
					</div>

					<div class='w-full border-t-[0.5px] border-mapBorder mt-3 mb-2 opacity-80'></div>

					<div class='flex space-x-4'>
						${
							placeDetails['osm:payment:onchain'] ||
							placeDetails['osm:payment:lightning'] ||
							placeDetails['osm:payment:lightning_contactless'] ||
							placeDetails['osm:payment:bitcoin']
								? `<div>
									<span class='block text-mapLabel text-xs'>Payment Methods</span>
									<div class='w-full flex space-x-2 mt-0.5'>
										<img src="${
											placeDetails['osm:payment:onchain'] === 'yes'
												? theme === 'dark'
													? '/icons/btc-highlight-dark.svg'
													: '/icons/btc-highlight.svg'
												: placeDetails['osm:payment:onchain'] === 'no'
													? theme === 'dark'
														? '/icons/btc-no-dark.svg'
														: '/icons/btc-no.svg'
													: theme === 'dark'
														? '/icons/btc-dark.svg'
														: '/icons/btc.svg'
										}" alt="bitcoin" class="w-6 h-6" title="${
											placeDetails['osm:payment:onchain'] === 'yes'
												? 'On-chain accepted'
												: placeDetails['osm:payment:onchain'] === 'no'
													? 'On-chain not accepted'
													: 'On-chain unknown'
										}"/>
										<img src="${
											placeDetails['osm:payment:lightning'] === 'yes'
												? theme === 'dark'
													? '/icons/ln-highlight-dark.svg'
													: '/icons/ln-highlight.svg'
												: placeDetails['osm:payment:lightning'] === 'no'
													? theme === 'dark'
														? '/icons/ln-no-dark.svg'
														: '/icons/ln-no.svg'
													: theme === 'dark'
														? '/icons/ln-dark.svg'
														: '/icons/ln.svg'
										}" alt="lightning" class="w-6 h-6" title="${
											placeDetails['osm:payment:lightning'] === 'yes'
												? 'Lightning accepted'
												: placeDetails['osm:payment:lightning'] === 'no'
													? 'Lightning not accepted'
													: 'Lightning unknown'
										}"/>
										<img src="${
											placeDetails['osm:payment:lightning_contactless'] === 'yes'
												? theme === 'dark'
													? '/icons/nfc-highlight-dark.svg'
													: '/icons/nfc-highlight.svg'
												: placeDetails['osm:payment:lightning_contactless'] === 'no'
													? theme === 'dark'
														? '/icons/nfc-no-dark.svg'
														: '/icons/nfc-no.svg'
													: theme === 'dark'
														? '/icons/nfc-dark.svg'
														: '/icons/nfc.svg'
										}" alt="nfc" class="w-6 h-6" title="${
											placeDetails['osm:payment:lightning_contactless'] === 'yes'
												? 'Lightning Contactless accepted'
												: placeDetails['osm:payment:lightning_contactless'] === 'no'
													? 'Lightning contactless not accepted'
													: 'Lightning contactless unknown'
										}"/>
									</div>
								   </div>`
								: ''
						}

						<div>
							<span class='block text-mapLabel text-xs' title="Completed by BTC Map community members">Last Surveyed</span>
							<span class='block text-body dark:text-white'>
								${
									placeDetails.verified_at
										? `${formatVerifiedHuman(placeDetails.verified_at)} ${
												isUpToDate
													? `<span title="Verified within the last year"><svg width='16px' height='16px' class='inline text-primary dark:text-white'>
												<use width='16px' height='16px' href="/icons/spritesheet-popup.svg#verified"></use>
											</svg></span>`
													: `<span title="Outdated please re-verify"><svg width='16px' height='16px' class='inline text-primary dark:text-white'>
												<use width='16px' height='16px' href="/icons/spritesheet-popup.svg#outdated"></use>
											</svg></span>`
											}`
										: '<span title="Not verified">---</span>'
								}
							</span>
							
							${
								location.pathname === '/map'
									? `<a href="/verify-location?id=${placeId}" class='!text-link hover:!text-hover text-xs transition-colors' title="Help improve the data for everyone">Verify Location</a>`
									: ''
							}
						</div>

						<div>
							${
								isBoosted
									? `<span class='block text-mapLabel text-xs' title="This location is boosted!">Boost Expires</span>
									   <span class='block text-body dark:text-white'><span id="boosted-time"></span></span>`
									: ''
							}

							<button title='${isBoosted ? 'Extend Boost' : 'Boost'}' id='boost-button' class='flex justify-center items-center space-x-2 text-primary dark:text-white hover:text-link dark:hover:text-link border border-mapBorder hover:border-link rounded-lg px-3 h-[32px] transition-colors mt-1'>
								<svg width='16px' height='16px'>
									<use width='16px' height='16px' href="/icons/spritesheet-popup.svg#${
										isBoosted ? 'boost-solid' : 'boost'
									}"></use>
								</svg>
								<span class='text-xs'>${isBoosted ? 'Extend' : 'Boost'}</span>
							</button>
						</div>
					</div>

					${
						theme === 'dark'
							? `<style>
							.leaflet-popup-content-wrapper, .leaflet-popup-tip {
								background-color: #06171C;
								border: 1px solid #e5e7eb
							}
						   </style>`
							: ''
					}
				`;

				marker
					.bindPopup(popupContent, { closeButton: false, maxWidth: 1000, minWidth: 300 })
					.openPopup()
					.on('popupclose', () => {
						marker.unbindPopup();
					});

				// Hydrate the boost expiration time with the Time component
				if (isBoosted) {
					const boostedTimeElement = popupContent.querySelector('#boosted-time');
					if (boostedTimeElement) {
						new Time({
							target: boostedTimeElement,
							props: {
								live: 3000,
								relative: true,
								timestamp: placeDetails.boosted_until
							}
						});
					}
				}

				// Boost button event handler
				const boostBtn: HTMLButtonElement | null = popupContent.querySelector('#boost-button');
				if (boostBtn) {
					const boostButtonText: HTMLSpanElement | null = boostBtn.querySelector('span');
					const boostButtonIcon: SVGElement | null = boostBtn.querySelector('svg');

					const resetButton = () => {
						if (boostBtn && boostButtonText && boostButtonIcon) {
							boostBtn.disabled = false;
							boostButtonText.innerText = isBoosted ? 'Extend' : 'Boost';
							boostBtn.classList.add('space-x-2');
							boostButtonIcon.classList.remove('hidden');
						}
					};

					boostBtn.onclick = async (e) => {
						e.preventDefault();

						// Set up boost data similar to BoostButton.svelte
						const boostStore = get(boost);
						if (boostStore) return; // Prevent multiple boost flows

						// Update button to loading state
						if (boostBtn && boostButtonText && boostButtonIcon) {
							boostBtn.disabled = true;
							boostButtonIcon.classList.add('hidden');
							boostBtn.classList.remove('space-x-2');
							boostButtonText.innerText = 'Boosting...';
						}

						// Set the boost data in the global store
						boost.set({
							id: placeDetails.id.toString(),
							name: placeDetails.name || '',
							boost: isBoosted ? placeDetails.boosted_until || '' : ''
						});

						// Fetch exchange rate
						try {
							const response = await axios.get('https://blockchain.info/ticker');
							exchangeRate.set(response.data['USD']['15m']);
						} catch (error) {
							console.error('Error fetching exchange rate:', error);
							// Reset boost store on error
							boost.set(undefined);
							resetButton();
							errToast(
								'Could not fetch bitcoin exchange rate, please try again or contact BTC Map.'
							);
						}
					};

					// Subscribe to resetBoost store for external resets
					resetBoost.subscribe(resetButton);
				}
			} catch (error) {
				console.error('Error fetching place details:', error);

				// Fallback popup with basic info
				const errorPopup = L.DomUtil.create('div');
				errorPopup.innerHTML = `
					<div style="padding: 10px;">
						<h3>Place ${placeId}</h3>
						<p>Error loading details. Please try again.</p>
						<p>Lat: ${lat}, Lon: ${long}</p>
					</div>
				`;

				marker
					.bindPopup(errorPopup, { closeButton: true, maxWidth: 250 })
					.openPopup()
					.on('popupclose', () => {
						marker.unbindPopup();
					});
			}
		}
	});

	return marker;
};

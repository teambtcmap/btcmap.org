import { selectedMerchant, theme } from '$lib/store';
import { Icon } from '$lib/comp';
import { detectTheme, errToast } from '$lib/utils';
import type { DomEventType, Leaflet, Place } from '$lib/types';
import { PLACE_FIELD_SETS, buildFieldsParam } from '$lib/api-fields';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import type { Map, LatLng } from 'leaflet';
import { get } from 'svelte/store';
import type { DivIcon } from 'leaflet';
import { replaceState } from '$app/navigation';

const BORDER_BOTTOM_STYLE = '1.5px solid #ccc';
const BOTTOM_BUTTON_RADIUS = '0 0 8px 8px';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export const updateMapHash = (zoom: number, center: LatLng): void => {
	const newHash = `#${zoom}/${center.lat.toFixed(5)}/${center.lng.toFixed(5)}`;
	// Use SvelteKit's replaceState to preserve current pathname while updating hash
	const url = window.location.pathname + newHash;
	// eslint-disable-next-line svelte/no-navigation-without-resolve
	replaceState(url, {});
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
	L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

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
		'dark:border-t-white/95',
		'dark:border-r',
		'dark:border-r-white/95'
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
		'dark:border-t-white/95',
		'dark:border-l',
		'dark:border-l-white/95'
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
		zoomIn.classList.add(
			'dark:!bg-dark',
			'dark:hover:!bg-dark/75',
			'dark:border',
			'dark:border-white/95'
		);
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
		zoomOut.classList.add(
			'dark:!bg-dark',
			'dark:hover:!bg-dark/75',
			'dark:border',
			'dark:border-white/95'
		);
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
	fullscreenButton.classList.add(
		'dark:!bg-dark',
		'dark:hover:!bg-dark/75',
		'dark:border',
		'dark:border-white/95'
	);
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
		locateButton.classList.add(
			'dark:!bg-dark',
			'dark:hover:!bg-dark/75',
			'dark:border',
			'dark:border-white/95'
		);
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
			addHomeButton.classList.add(
				'dark:!bg-dark',
				'dark:hover:!bg-dark/75',
				'dark:border',
				'dark:border-white/95'
			);

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
				addLocationButton.classList.add(
					'dark:!bg-dark',
					'dark:hover:!bg-dark/75',
					'dark:border',
					'dark:border-white/95'
				);

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
				communityMapButton.classList.add(
					'dark:!bg-dark',
					'dark:hover:!bg-dark/75',
					'dark:border',
					'dark:border-white/95'
				);
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
				merchantMapButton.classList.add(
					'dark:!bg-dark',
					'dark:hover:!bg-dark/75',
					'dark:border',
					'dark:border-white/95'
				);

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
			dataRefreshButton.classList.add(
				'dark:!bg-dark',
				'dark:hover:!bg-dark/75',
				'dark:border',
				'dark:border-white/95'
			);

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
	leaflet: Leaflet;
	verify: boolean;
	boosted?: boolean;
	// issues?: Issue[];
}) => {
	const marker = L.marker([lat, long], { icon });

	marker.on('click', async () => {
		// Fetch place details from v4 API and set the selectedMerchant store
		try {
			const response = await axios.get(
				`https://api.btcmap.org/v4/places/${placeId}?fields=${buildFieldsParam(PLACE_FIELD_SETS.COMPLETE_PLACE)}`
			);
			const placeDetails = response.data;

			// Set the selected merchant to open the drawer
			selectedMerchant.set(placeDetails);
		} catch (error) {
			console.error('Error fetching place details:', error);
			errToast('Error loading merchant details. Please try again.');
		}
	});

	return marker;
};
